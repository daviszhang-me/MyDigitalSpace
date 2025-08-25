# KnowledgeHub AWS Deployment Guide

This guide will help you deploy your KnowledgeHub application to AWS using containers and infrastructure as code.

## 🏗️ Architecture Overview

The deployment uses:
- **AWS ECS Fargate** - Serverless containers for the application
- **Application Load Balancer** - Load balancing and health checks
- **Amazon EFS** - Persistent storage for SQLite database
- **Amazon ECR** - Container registry
- **CloudWatch** - Logging and monitoring
- **Auto Scaling** - Automatic scaling based on CPU/memory

## 📋 Prerequisites

### 1. AWS Account Setup
- AWS account with appropriate permissions
- AWS CLI installed and configured
- AWS CDK installed globally: `npm install -g aws-cdk`

### 2. Required Tools
- Docker Desktop
- Node.js 18+
- Git

### 3. AWS Permissions
Your AWS user/role needs these permissions:
- ECR (full access)
- ECS (full access)
- CloudFormation (full access)
- VPC, EC2, EFS (full access)
- CloudWatch Logs (full access)
- IAM (limited - for creating service roles)

## 🚀 Quick Start Deployment

### Option 1: One-Click Deployment
```bash
# Clone the repository
git clone <your-repo-url>
cd MyDigitalSpace

# Run the deployment script
./scripts/deploy.sh
```

### Option 2: Step-by-Step Deployment

#### Step 1: Configure AWS
```bash
aws configure
# Enter your AWS Access Key, Secret Key, Region (e.g., us-east-1)
```

#### Step 2: Create ECR Repository
```bash
aws ecr create-repository \
    --repository-name knowledgehub \
    --region us-east-1
```

#### Step 3: Build and Push Docker Image
```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag image
docker build -t knowledgehub:latest .
docker tag knowledgehub:latest <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/knowledgehub:latest

# Push to ECR
docker push <your-account-id>.dkr.ecr.us-east-1.amazonaws.com/knowledgehub:latest
```

#### Step 4: Deploy Infrastructure
```bash
cd aws/cdk
npm install
cdk bootstrap
cdk deploy
```

## 🔧 Configuration

### Environment Variables

Update `.env.production` with your production settings:

```bash
NODE_ENV=production
PORT=3001
DB_TYPE=sqlite
DB_NAME=/app/data/knowledgehub_production.db
JWT_SECRET=your-super-secure-jwt-secret-here-CHANGE-THIS
JWT_EXPIRE=7d
CORS_ORIGIN=https://your-domain.com
```

### Custom Domain (Optional)

To use a custom domain:

1. **Purchase/configure domain in Route 53**
2. **Update CDK stack** to include SSL certificate and domain configuration
3. **Uncomment domain configuration** in `knowledgehub-stack.ts`

```typescript
// Add to the stack
const certificate = new acm.Certificate(this, 'Certificate', {
  domainName: 'your-domain.com',
  validation: acm.CertificateValidation.fromDns(),
});
```

## 📊 Monitoring & Logs

### CloudWatch Logs
- Application logs: `/aws/ecs/knowledgehub`
- Access pattern monitoring
- Error tracking and alerting

### Health Checks
- Load balancer health checks on `/health`
- Container health checks
- Auto-restart on failures

### Scaling
- **CPU-based scaling**: Scales when CPU > 70%
- **Memory-based scaling**: Scales when memory > 80%
- **Min instances**: 1
- **Max instances**: 10

## 🔒 Security Best Practices

### 1. Secrets Management
Replace hardcoded secrets with AWS Secrets Manager:

```typescript
const jwtSecret = ecs.Secret.fromSecretsManager(
  secretsmanager.Secret.fromSecretNameV2(this, 'JWTSecret', 'knowledgehub/jwt-secret')
);
```

### 2. Network Security
- Private subnets for containers
- Security groups with minimal required access
- EFS encryption at rest and in transit

### 3. Container Security
- Non-root user in container
- Minimal base image
- Regular security scanning with Trivy

## 🔄 CI/CD Pipeline

The GitHub Actions pipeline automatically:

1. **Tests** code on every PR
2. **Builds** Docker image on main branch
3. **Scans** for security vulnerabilities
4. **Deploys** to AWS ECS

### Required GitHub Secrets
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

## 💾 Data Persistence

### Database Backup
The SQLite database is stored on EFS. To backup:

```bash
# Connect to ECS container
aws ecs execute-command \
    --cluster KnowledgeHubCluster \
    --task <task-id> \
    --container KnowledgeHubContainer \
    --command "sh" \
    --interactive

# Inside container, backup database
cp /app/data/knowledgehub_production.db /app/data/backup-$(date +%Y%m%d-%H%M%S).db
```

### Automated Backups
Consider setting up:
- EFS backup policies
- Lambda functions for database snapshots
- Cross-region replication for disaster recovery

## 🐛 Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check ECS service events
aws ecs describe-services --cluster KnowledgeHubCluster --services KnowledgeHubService

# Check container logs
aws logs tail /aws/ecs/knowledgehub --follow
```

#### 2. Database Connection Issues
- Verify EFS mount is working
- Check file permissions
- Ensure data directory exists

#### 3. Load Balancer Health Check Failures
- Verify `/health` endpoint responds
- Check security group allows port 3001
- Review container logs for startup errors

### Useful Commands

```bash
# Check service status
aws ecs describe-services --cluster KnowledgeHubCluster --services KnowledgeHubService

# View recent logs
aws logs tail /aws/ecs/knowledgehub --since 1h

# Force new deployment
aws ecs update-service --cluster KnowledgeHubCluster --service KnowledgeHubService --force-new-deployment

# Scale service
aws ecs update-service --cluster KnowledgeHubCluster --service KnowledgeHubService --desired-count 2
```

## 💰 Cost Optimization

### Expected Monthly Costs (us-east-1)
- **ECS Fargate**: ~$15-30/month (1 task, 0.5 vCPU, 1GB RAM)
- **Application Load Balancer**: ~$16/month
- **EFS**: ~$1-5/month (depending on data size)
- **CloudWatch Logs**: ~$1-3/month
- **Data Transfer**: Variable based on usage

### Cost Reduction Tips
- Use Fargate Spot for non-production environments
- Set up CloudWatch alarms for cost monitoring
- Enable EFS Intelligent Tiering
- Use Reserved Instances for consistent workloads

## 🔄 Updates and Maintenance

### Application Updates
```bash
# Update application code
git push origin main  # Triggers automatic deployment

# Manual update
./scripts/deploy.sh --build-only
aws ecs update-service --cluster KnowledgeHubCluster --service KnowledgeHubService --force-new-deployment
```

### Infrastructure Updates
```bash
cd aws/cdk
cdk diff    # Preview changes
cdk deploy  # Apply changes
```

## 📞 Support

For deployment issues:
1. Check CloudWatch logs
2. Review ECS service events
3. Verify security group settings
4. Check EFS mount status

---

**🎉 Congratulations!** Your KnowledgeHub is now running on AWS with enterprise-grade scalability, security, and monitoring.