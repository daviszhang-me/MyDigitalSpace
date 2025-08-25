# 🚀 Quick Deployment Guide for Davis

**Your AWS Account:** `801532171791`  
**Region:** `ap-southeast-1` (Singapore)  
**Status:** AWS CLI configured ✅

## Step 1: Install Docker

### Option A: Docker Desktop (Recommended)
```bash
# Install via Homebrew
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop/
```

After installation:
1. Open Docker Desktop application
2. Wait for it to start (you'll see whale icon in menu bar)
3. Test with: `docker --version`

### Option B: Lightweight Alternative
```bash
brew install colima docker
colima start
```

## Step 2: Test Docker Installation
```bash
cd /Users/daviszhang/project/MyDigitalSpace
docker --version
```

## Step 3: Install CDK (if not installed)
```bash
npm install -g aws-cdk
cdk --version
```

## Step 4: Test Local Deployment
```bash
# Test your app locally with Docker
./scripts/test-local.sh

# This will:
# - Build Docker image
# - Start container
# - Test all endpoints
# - Show you http://localhost:3001
```

## Step 5: Deploy to AWS
```bash
# One command deployment
./scripts/deploy.sh

# This will:
# - Create ECR repository
# - Build and push Docker image  
# - Deploy infrastructure with CDK
# - Start your application
```

## Step 6: Get Your Website URL
After deployment completes, get your URL:
```bash
aws cloudformation describe-stacks \
  --stack-name KnowledgeHubStack \
  --region ap-southeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceURL`].OutputValue' \
  --output text
```

## 🔧 Troubleshooting Commands

**If deployment fails:**
```bash
# Check logs
aws logs tail /aws/ecs/knowledgehub --region ap-southeast-1

# Check service status  
aws ecs describe-services \
  --cluster KnowledgeHubCluster \
  --services KnowledgeHubService \
  --region ap-southeast-1
```

**If you need to retry:**
```bash
# Clean up and retry
cdk destroy --force
./scripts/deploy.sh
```

---
**Ready to start? Run the commands above in order!**