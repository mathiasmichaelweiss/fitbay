import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, type TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import type { Construct } from 'constructs';
import * as path from 'node:path';
import { ROUTES } from '../../services/api/src/routes';

export interface FitBayStackProps extends StackProps {
  /** Префикс всех физических имён. В блоке A живём в аккаунте BewerGO, поэтому строго `fitbay-`. */
  prefix?: string;
  /** Разрешённые origin для CORS (локальный dev и хостинг беты). */
  allowedOrigins?: string[];
  /** Auth0: домен тенанта (без https://) и audience API. */
  auth0Domain?: string;
  auth0Audience?: string;
}

// A2.1 (спека 5.1, 5.2): таблицы, бакет для фото, HTTP API + Lambda. Таблицы BewerGO не трогаем.
export class FitBayBetaStack extends Stack {
  constructor(scope: Construct, id: string, props: FitBayStackProps = {}) {
    super(scope, id, props);
    const prefix = props.prefix ?? 'fitbay';
    const origins = props.allowedOrigins ?? ['http://localhost:5173', 'http://localhost:5174'];

    const base: Partial<TableProps> = {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN, // данные о здоровье: никогда не удалять вместе со стеком
    };

    const main = new Table(this, 'Main', { ...base, tableName: `${prefix}-main` } as TableProps);
    // GSI1: слоты и заявки клиента; GSI2: каталог тренеров; GSI3: код партнёра → тренер.
    for (const n of [1, 2, 3]) {
      main.addGlobalSecondaryIndex({
        indexName: `GSI${n}`,
        partitionKey: { name: `GSI${n}PK`, type: AttributeType.STRING },
        sortKey: { name: `GSI${n}SK`, type: AttributeType.STRING },
      });
    }

    const sharedFood = new Table(this, 'SharedFood', { ...base, tableName: `${prefix}-shared-food` } as TableProps);

    const photos = new Bucket(this, 'Photos', {
      bucketName: `${prefix}-photos-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [{ allowedMethods: [HttpMethods.GET, HttpMethods.PUT], allowedOrigins: origins, allowedHeaders: ['*'], maxAge: 3000 }],
    });

    const env = { TABLE_MAIN: main.tableName, TABLE_SHARED_FOOD: sharedFood.tableName, PHOTOS_BUCKET: photos.bucketName };
    const fn = (id: string, name: string, entry: string, extra: Record<string, string> = {}) =>
      new NodejsFunction(this, id, {
        functionName: `${prefix}-${name}`,
        entry: path.join(__dirname, '../../services/api/src', entry),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { ...env, ...extra },
        bundling: { minify: true, sourceMap: true },
      });

    const health = fn('HealthFn', 'api-health', 'health.ts');

    const auth0Domain = props.auth0Domain ?? this.node.tryGetContext('auth0Domain') ?? 'CHANGE-ME.eu.auth0.com';
    const auth0Audience = props.auth0Audience ?? this.node.tryGetContext('auth0Audience') ?? 'https://api.fitbay.app';
    const authFn = fn('AuthorizerFn', 'api-authorizer', 'auth/authorizer.ts', { AUTH0_DOMAIN: auth0Domain, AUTH0_AUDIENCE: auth0Audience });
    const authorizer = new HttpLambdaAuthorizer('Auth0Authorizer', authFn, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      identitySource: ['$request.header.Authorization'],
      resultsCacheTtl: Duration.minutes(5),
    });

    // Обработчики API. Маршруты берутся из общей таблицы services/api/src/routes.ts (та же, что у локального сервера).
    const userFn = fn('UserFn', 'api-user', 'user/handler.ts');
    const trainerFn = fn('TrainerFn', 'api-trainer', 'trainer/handler.ts');
    main.grantReadWriteData(userFn);
    main.grantReadWriteData(trainerFn);
    const corrFn = fn('CorrectionsFn', 'api-corrections', 'corrections/handler.ts');
    main.grantReadWriteData(corrFn);
    sharedFood.grantReadWriteData(corrFn);

    const api = new HttpApi(this, 'Api', {
      apiName: `${prefix}-api`,
      corsPreflight: { allowOrigins: origins, allowMethods: [CorsHttpMethod.ANY], allowHeaders: ['authorization', 'content-type'] },
    });
    const integrations = {
      health: new HttpLambdaIntegration('HealthInt', health),
      user: new HttpLambdaIntegration('UserInt', userFn),
      trainer: new HttpLambdaIntegration('TrainerInt', trainerFn),
      corrections: new HttpLambdaIntegration('CorrectionsInt', corrFn),
    } as const;
    for (const r of ROUTES) {
      const integration = integrations[r.handler as keyof typeof integrations];
      if (!integration) continue; // обработчик ещё не готов (ИИ, поправки) и появится в следующих задачах
      api.addRoutes({ path: r.path, methods: [r.method as HttpMethod], integration, ...(r.auth === false ? {} : { authorizer }) });
    }

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'MainTable', { value: main.tableName });
    new CfnOutput(this, 'PhotosBucket', { value: photos.bucketName });
  }
}
