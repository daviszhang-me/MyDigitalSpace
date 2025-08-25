import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export class KnowledgeHubStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'KnowledgeHubVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // EFS for persistent data storage
    const fileSystem = new efs.FileSystem(this, 'KnowledgeHubFileSystem', {
      vpc,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      encrypted: true,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'KnowledgeHubCluster', {
      vpc,
      containerInsights: true,
    });

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'KnowledgeHubLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'KnowledgeHubTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Add EFS volume to task
    const volumeName = 'knowledgehub-data';
    taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
        rootDirectory: '/data',
        transitEncryption: 'ENABLED',
      },
    });

    // Container Definition
    const container = taskDefinition.addContainer('KnowledgeHubContainer', {
      image: ecs.ContainerImage.fromRegistry('your-docker-registry/knowledgehub:latest'),
      environment: {
        NODE_ENV: 'production',
        PORT: '3001',
        DB_TYPE: 'sqlite',
        DB_NAME: '/app/data/knowledgehub_production.db',
        JWT_SECRET: 'your-super-secure-jwt-secret-here', // Use Secrets Manager in production
        JWT_EXPIRE: '7d',
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'knowledgehub',
        logGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'node backend/scripts/health-check.js || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Mount EFS volume
    container.addMountPoints({
      sourceVolume: volumeName,
      containerPath: '/app/data',
      readOnly: false,
    });

    container.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    });

    // Application Load Balancer
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'KnowledgeHubService', {
      cluster,
      cpu: 512,
      desiredCount: 1,
      taskDefinition,
      memoryLimitMiB: 1024,
      publicLoadBalancer: true,
      listenerPort: 80,
      platformVersion: ecs.FargatePlatformVersion.LATEST,
    });

    // Allow EFS connections from ECS
    fileSystem.connections.allowDefaultPortFrom(service.service.connections);

    // Health check configuration
    service.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
    });

    // Auto Scaling
    const scaling = service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(300),
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: service.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
    });

    new cdk.CfnOutput(this, 'ServiceURL', {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
      description: 'KnowledgeHub Service URL',
    });
  }
}