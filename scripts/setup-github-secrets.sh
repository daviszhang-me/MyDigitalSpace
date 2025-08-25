#!/bin/bash

# GitHub Secrets Setup Helper Script
# This script helps you prepare the values needed for GitHub secrets

echo "🔐 GitHub Secrets Setup Helper"
echo "================================="
echo ""

echo "You need to set up the following secrets in your GitHub repository:"
echo "Repository → Settings → Secrets and variables → Actions → New repository secret"
echo ""

# AWS Credentials
echo "1️⃣  AWS_ACCESS_KEY_ID"
echo "   Description: Your AWS Access Key ID"
if command -v aws &> /dev/null; then
    CURRENT_KEY=$(aws configure get aws_access_key_id 2>/dev/null)
    if [ ! -z "$CURRENT_KEY" ]; then
        echo "   Current AWS CLI key: ${CURRENT_KEY:0:10}..."
    fi
fi
echo "   Value: [Your AWS Access Key ID]"
echo ""

echo "2️⃣  AWS_SECRET_ACCESS_KEY"  
echo "   Description: Your AWS Secret Access Key"
echo "   Value: [Your AWS Secret Access Key - keep this secret!]"
echo ""

# SSH Private Key
echo "3️⃣  EC2_SSH_PRIVATE_KEY"
echo "   Description: Private key for SSH access to EC2 instance"
echo "   Value: Complete private key including headers"
echo ""

# Check for SSH keys
echo "   Looking for SSH keys on this system:"
if [ -f ~/.ssh/id_rsa ]; then
    echo "   ✅ Found: ~/.ssh/id_rsa"
    echo "   Preview (first few lines):"
    head -3 ~/.ssh/id_rsa | while read line; do
        echo "      $line"
    done
    echo "      [... rest of key ...]"
    echo ""
    echo "   💡 Copy the ENTIRE contents of ~/.ssh/id_rsa (including headers)"
else
    echo "   ❌ No ~/.ssh/id_rsa found"
    echo ""
    echo "   Generate a new key pair:"
    echo "   ssh-keygen -t rsa -b 4096 -f ~/.ssh/mydigitalspace_key"
    echo "   Then add the public key to your EC2 instance:"
    echo "   ssh-copy-id -i ~/.ssh/mydigitalspace_key.pub ubuntu@[INSTANCE_IP]"
fi

echo ""
echo "🎯 Target EC2 Instance Information:"
echo "   Instance ID: i-0f4af27f7d4b2ee8d"
echo "   Region: ap-southeast-1"
echo "   User: ubuntu"
echo ""

# Check AWS CLI configuration
echo "🔍 Current AWS Configuration:"
if command -v aws &> /dev/null; then
    echo "   AWS CLI: ✅ Installed"
    
    REGION=$(aws configure get region 2>/dev/null)
    if [ ! -z "$REGION" ]; then
        echo "   Region: $REGION"
        if [ "$REGION" != "ap-southeast-1" ]; then
            echo "   ⚠️  Warning: Your AWS CLI region ($REGION) differs from target region (ap-southeast-1)"
        fi
    else
        echo "   Region: Not configured"
    fi
    
    # Test AWS access
    echo "   Testing AWS access..."
    if aws sts get-caller-identity &>/dev/null; then
        echo "   Credentials: ✅ Working"
        
        # Try to get instance info
        echo "   Testing EC2 access..."
        INSTANCE_IP=$(aws ec2 describe-instances \
            --instance-ids i-0f4af27f7d4b2ee8d \
            --region ap-southeast-1 \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text 2>/dev/null)
        
        if [ "$INSTANCE_IP" != "None" ] && [ ! -z "$INSTANCE_IP" ]; then
            echo "   Instance IP: ✅ $INSTANCE_IP"
        else
            echo "   Instance IP: ❌ Could not retrieve (check instance ID and region)"
        fi
    else
        echo "   Credentials: ❌ Not working or not configured"
    fi
else
    echo "   AWS CLI: ❌ Not installed"
    echo "   Install with: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
fi

echo ""
echo "📋 Setup Checklist:"
echo "   [ ] Set AWS_ACCESS_KEY_ID in GitHub secrets"
echo "   [ ] Set AWS_SECRET_ACCESS_KEY in GitHub secrets"  
echo "   [ ] Set EC2_SSH_PRIVATE_KEY in GitHub secrets"
echo "   [ ] Verify EC2 instance is running"
echo "   [ ] Ensure SSH key pair works with EC2 instance"
echo "   [ ] Push code to main/master branch to trigger deployment"
echo ""

echo "🚀 Ready to deploy!"
echo "   After setting up secrets, push to main branch:"
echo "   git add . && git commit -m 'Setup CI/CD' && git push origin main"