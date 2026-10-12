import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

// A2.1: таблицы fitbay-main и fitbay-shared-food (GSI1-3, PITR, TTL), S3 для фото, HTTP API + Lambda.
// Всё с префиксом fitbay-, таблицы BewerGO не трогаем.
export class FitBayBetaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  }
}
