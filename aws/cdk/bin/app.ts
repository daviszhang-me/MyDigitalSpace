#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KnowledgeHubStack } from '../lib/knowledgehub-stack';

const app = new cdk.App();

new KnowledgeHubStack(app, 'KnowledgeHubStack', {
  env: {
    account: '801532171791',
    region: 'ap-southeast-1',
  },
  description: 'KnowledgeHub - Personal Knowledge Management System',
  tags: {
    Project: 'KnowledgeHub',
    Environment: 'production',
    Owner: 'Davis'
  }
});