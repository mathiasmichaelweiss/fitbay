import { App } from 'aws-cdk-lib';
import { FitBayBetaStack } from '../lib/fitbay-beta-stack';

const app = new App();
new FitBayBetaStack(app, 'FitBayBetaStack', { env: { region: 'eu-central-1' } });
