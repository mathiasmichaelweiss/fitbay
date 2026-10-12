import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, type TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { Construct } from 'constructs';
import * as path from 'node:path';

export interface FitBayStackProps extends StackProps {
  /** Префикс всех физических имён. В блоке A живём в аккаунте BewerGO, поэтому строго `fitbay-`. */
  prefix?: string;
  /** Разрешённые origin для CORS (локальный dev и хостинг беты). */
  allowedOrigins?: string[];
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

    const health = new NodejsFunction(this, 'HealthFn', {
      functionName: `${prefix}-api-health`,
      entry: path.join(__dirname, '../../services/api/src/health.ts'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: { TABLE_MAIN: main.tableName, TABLE_SHARED_FOOD: sharedFood.tableName, PHOTOS_BUCKET: photos.bucketName },
    });
    main.grantReadWriteData(health);
    sharedFood.grantReadWriteData(health);
    photos.grantReadWrite(health);

    const api = new HttpApi(this, 'Api', {
      apiName: `${prefix}-api`,
      corsPreflight: { allowOrigins: origins, allowMethods: [CorsHttpMethod.ANY], allowHeaders: ['authorization', 'content-type'] },
    });
    api.addRoutes({ path: '/health', methods: [HttpMethod.GET], integration: new HttpLambdaIntegration('HealthInt', health) });

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'MainTable', { value: main.tableName });
    new CfnOutput(this, 'PhotosBucket', { value: photos.bucketName });
  }
}
