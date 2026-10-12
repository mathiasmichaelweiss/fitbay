import { describe, expect, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { FitBayBetaStack } from './fitbay-beta-stack';

const tpl = () => {
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } }); // без сборки Lambda в юнит-тестах
  const s = new FitBayBetaStack(app, 'T', { env: { account: '123456789012', region: 'eu-central-1' } });
  return Template.fromStack(s);
};

describe('FitBayBetaStack', () => {
  const t = tpl();

  it('две таблицы с префиксом fitbay-, PITR и TTL', () => {
    t.resourceCountIs('AWS::DynamoDB::Table', 2);
    for (const name of ['fitbay-main', 'fitbay-shared-food']) {
      t.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: name,
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
        TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      });
    }
  });

  it('fitbay-main имеет GSI1-3', () => {
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'fitbay-main',
      GlobalSecondaryIndexes: [
        Match.objectLike({ IndexName: 'GSI1' }),
        Match.objectLike({ IndexName: 'GSI2' }),
        Match.objectLike({ IndexName: 'GSI3' }),
      ],
    });
  });

  it('таблицы и бакет не удаляются вместе со стеком', () => {
    t.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Retain' });
    t.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  });

  it('бакет фото закрыт от публичного доступа', () => {
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
  });

  it('все физические имена начинаются с fitbay-', () => {
    const names = [
      ...Object.values(t.findResources('AWS::DynamoDB::Table')).map((r) => r.Properties.TableName),
      ...Object.values(t.findResources('AWS::Lambda::Function')).map((r) => r.Properties.FunctionName).filter(Boolean),
    ];
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(String(n)).toMatch(/^fitbay-/);
  });
});
