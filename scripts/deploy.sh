#!/bin/bash

# KnowledgeHub Deployment Script
set -e

echo "🚀 Starting KnowledgeHub deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-"ap-southeast-1"}
ECR_REPOSITORY=${ECR_REPOSITORY:-"knowledgehub"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
APP_PORT=${PORT:-3001}

# Validate environment
if [ -f "scripts/validate-env.sh" ]; then
    log_info "Validating environment configuration..."
    bash scripts/validate-env.sh production || {
        log_error "Environment validation failed"
        exit 1
    }
fi

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if CDK is installed
    if ! command -v cdk &> /dev/null; then
        log_warning "CDK is not installed globally. Installing..."
        npm install -g aws-cdk
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured. Please run 'aws configure'."
        exit 1
    fi
    
    log_success "Prerequisites check completed!"
}

# Build and push Docker image
build_and_push() {
    log_info "Building and pushing Docker image..."
    
    # Get ECR login token
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Build image with build args
    docker build -t $ECR_REPOSITORY:$IMAGE_TAG \
        --build-arg NODE_ENV=production \
        --build-arg PORT=$APP_PORT .
    
    # Tag for ECR
    ECR_URI=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY
    docker tag $ECR_REPOSITORY:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
    docker tag $ECR_REPOSITORY:$IMAGE_TAG $ECR_URI:latest
    
    # Push to ECR
    docker push $ECR_URI:$IMAGE_TAG
    docker push $ECR_URI:latest
    
    log_success "Docker image built and pushed successfully!"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure with CDK..."
    
    cd aws/cdk
    
    # Install CDK dependencies
    npm ci
    
    # Bootstrap CDK (if not already done)
    cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$AWS_REGION
    
    # Deploy stack
    cdk deploy --require-approval never
    
    cd ../..
    
    log_success "Infrastructure deployed successfully!"
}

# Main deployment process
main() {
    log_info "Starting KnowledgeHub deployment process..."
    
    check_prerequisites
    build_and_push
    deploy_infrastructure
    
    log_success "🎉 KnowledgeHub deployed successfully!"
    log_info "Check the AWS CloudFormation console for the service URL."
}

# Handle script arguments
case "${1:-}" in
    --build-only)
        log_info "Building Docker image only..."
        check_prerequisites
        build_and_push
        ;;
    --infra-only)
        log_info "Deploying infrastructure only..."
        check_prerequisites
        deploy_infrastructure
        ;;
    --help|-h)
        echo "Usage: $0 [--build-only|--infra-only|--help]"
        echo "  --build-only   Build and push Docker image only"
        echo "  --infra-only   Deploy infrastructure only"
        echo "  --help         Show this help message"
        exit 0
        ;;
    *)
        main
        ;;
esac