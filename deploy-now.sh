#!/bin/bash

# 🚀 One-Click KnowledgeHub Deployment for Davis
# Configured for AWS Account: 801532171791, Region: ap-southeast-1

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║        🚀 KnowledgeHub Deployment             ║"
echo "║        Account: 801532171791                  ║"
echo "║        Region: ap-southeast-1                 ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check prerequisites
log "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Please install it first."
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured. Run: aws configure"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    warning "Docker not found. Please install Docker first:"
    echo ""
    echo "Option 1 (Recommended):"
    echo "  brew install --cask docker"
    echo ""
    echo "Option 2 (Lightweight):"
    echo "  brew install colima docker && colima start"
    echo ""
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker Desktop or run 'colima start'"
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    log "Installing AWS CDK..."
    npm install -g aws-cdk
fi

success "All prerequisites met!"

# Confirm deployment
echo ""
log "About to deploy KnowledgeHub to AWS..."
echo -e "  ${BLUE}Account:${NC} 801532171791"
echo -e "  ${BLUE}Region:${NC} ap-southeast-1"
echo -e "  ${BLUE}Estimated Cost:${NC} ~$35-60 SGD/month"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Step 1: Test locally first
log "Step 1/4: Testing locally..."
if ./scripts/test-local.sh --no-wait; then
    success "Local test passed!"
else
    error "Local test failed. Check the output above."
fi

# Step 2: Create ECR repository
log "Step 2/4: Setting up ECR repository..."
if ! aws ecr describe-repositories --repository-names knowledgehub --region ap-southeast-1 &> /dev/null; then
    aws ecr create-repository \
        --repository-name knowledgehub \
        --region ap-southeast-1
    success "ECR repository created!"
else
    success "ECR repository already exists!"
fi

# Step 3: Deploy infrastructure
log "Step 3/4: Deploying infrastructure with CDK..."
cd aws/cdk
npm install
cdk bootstrap aws://801532171791/ap-southeast-1
cdk deploy --require-approval never
cd ../..
success "Infrastructure deployed!"

# Step 4: Build and push image
log "Step 4/4: Building and deploying application..."
AWS_REGION=ap-southeast-1
ECR_REPOSITORY=knowledgehub
ECR_URI=801532171791.dkr.ecr.ap-southeast-1.amazonaws.com/$ECR_REPOSITORY

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com

# Build and push
docker build -t $ECR_REPOSITORY:latest .
docker tag $ECR_REPOSITORY:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force deployment
aws ecs update-service \
    --cluster KnowledgeHubCluster \
    --service KnowledgeHubService \
    --force-new-deployment \
    --region ap-southeast-1

success "Application deployed!"

# Get the URL
log "Getting your application URL..."
sleep 10

URL=$(aws cloudformation describe-stacks \
  --stack-name KnowledgeHubStack \
  --region ap-southeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceURL`].OutputValue' \
  --output text)

echo ""
echo -e "${GREEN}"
echo "🎉 Deployment Complete!"
echo ""
echo "Your KnowledgeHub is now running at:"
echo "  $URL"
echo ""
echo "It may take 2-3 minutes for the service to be fully available."
echo -e "${NC}"
echo ""
echo "To check status:"
echo "  aws ecs describe-services --cluster KnowledgeHubCluster --services KnowledgeHubService --region ap-southeast-1"
echo ""
echo "To view logs:"
echo "  aws logs tail /aws/ecs/knowledgehub --region ap-southeast-1"