import { App } from 'aws-cdk-lib';
import { FitBayBetaStack } from '../lib/fitbay-beta-stack';

const app = new App();
// Блок A: аккаунт BewerGO. Аккаунт берётся из профиля AWS CLI (--profile bewergo).
new FitBayBetaStack(app, 'FitBayBetaStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' },
  tags: { project: 'fitbay', stage: 'beta' },
});
