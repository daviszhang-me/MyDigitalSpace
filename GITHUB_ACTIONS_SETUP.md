# GitHub Actions CI/CD Setup Guide

This guide explains how to set up automated deployment to your AWS EC2 instance `i-0f4af27f7d4b2ee8d` using GitHub Actions.

## 🚀 Overview

The CI/CD pipeline will:
- ✅ Run tests and linting on code changes
- ✅ Validate environment configurations
- ✅ Automatically deploy to your AWS EC2 instance on main branch pushes
- ✅ Generate secure JWT secrets for each deployment
- ✅ Configure Nginx and PM2 automatically
- ✅ Verify deployment health after completion

## 🔐 Required GitHub Secrets

You need to set up the following secrets in your GitHub repository:

### Go to: GitHub Repository → Settings → Secrets and variables → Actions

#### 1. **AWS_ACCESS_KEY_ID**
- Your AWS Access Key ID for programmatic access
- Must have EC2 describe permissions

#### 2. **AWS_SECRET_ACCESS_KEY**  
- Your AWS Secret Access Key
- Corresponds to the Access Key ID above

#### 3. **EC2_SSH_PRIVATE_KEY**
- Your private SSH key for accessing the EC2 instance
- Should be the private key corresponding to your EC2 key pair
- Format: Complete private key including headers
```
-----BEGIN RSA PRIVATE KEY-----
[Your private key content]
-----END RSA PRIVATE KEY-----
```

## 🔧 AWS IAM Policy Requirements

Your AWS credentials need the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances"
            ],
            "Resource": "*"
        }
    ]
}
```

## 📋 Pre-deployment Server Requirements

Ensure your EC2 instance (`i-0f4af27f7d4b2ee8d`) has:

### Required Software:
- ✅ Node.js (v18+)
- ✅ npm
- ✅ Nginx
- ✅ PM2 (will be auto-installed if missing)

### Directory Structure:
```bash
sudo mkdir -p /var/www/MyDigitalSpace
sudo chown ubuntu:ubuntu /var/www/MyDigitalSpace
```

### Nginx Installation:
```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 🚦 Workflow Triggers

The deployment runs automatically when:
- ✅ Code is pushed to `main` or `master` branch
- ✅ Pull request is merged to `main` or `master` branch

## 🏗️ Deployment Process

### 1. **Test Phase**
- Installs Node.js dependencies
- Runs linting (if configured)
- Runs tests (if configured)  
- Validates environment configuration

### 2. **Build Phase**
- Creates deployment package
- Excludes development files (node_modules, .git, etc.)
- Generates secure production environment variables
- Creates deployment archive

### 3. **Deploy Phase**
- Retrieves current EC2 instance IP dynamically
- Uploads deployment package via SSH
- Installs/updates Node.js dependencies
- Sets up database directories
- Configures PM2 process manager
- Updates Nginx configuration
- Restarts services
- Verifies health endpoints

## 🔍 Environment Configuration

The workflow automatically creates production environment with:

```env
NODE_ENV=production
PORT=3001
DB_PATH=./data/knowledgehub.db
JWT_SECRET=[Auto-generated secure secret]
CORS_ORIGIN=http://[INSTANCE_IP],https://[INSTANCE_IP]
FRONTEND_URL=http://[INSTANCE_IP]
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 Monitoring Deployment

### GitHub Actions Logs
- View deployment progress in GitHub Actions tab
- Each step shows detailed output
- Failed deployments show error details

### Server Monitoring
```bash
# SSH into your instance
ssh ubuntu@[INSTANCE_IP]

# Check PM2 status
pm2 status

# View application logs  
pm2 logs mydigitalspace-backend

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Health Checks
- Application: `http://[INSTANCE_IP]/health`
- API: `http://[INSTANCE_IP]/api`

## 🔧 Troubleshooting

### Common Issues:

**SSH Connection Failed**
- Verify EC2_SSH_PRIVATE_KEY secret is correctly formatted
- Ensure EC2 instance is running
- Check security group allows SSH (port 22)

**AWS Permission Denied**
- Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
- Ensure IAM user has EC2 describe permissions
- Check AWS region is correct (ap-southeast-1)

**Deployment Script Failed**
- Check server has required software installed
- Verify /var/www/MyDigitalSpace directory exists and is writable
- Ensure Node.js and npm are available in PATH

**Application Not Starting**
- Check PM2 logs: `pm2 logs mydigitalspace-backend`
- Verify environment variables are correctly set
- Check database directory permissions

### Manual Deployment Test
If automated deployment fails, test manual deployment:

```bash
# On your local machine
./deploy.sh

# Or quick deployment
./quick-deploy.sh
```

## 🎯 Next Steps

1. **Set up GitHub secrets** as described above
2. **Push to main branch** to trigger first deployment
3. **Monitor deployment** in GitHub Actions
4. **Verify application** at your EC2 IP address
5. **Set up custom domain** (optional)

## 🌟 Features

- ✅ **Zero-downtime deployment** with PM2
- ✅ **Automatic SSL/TLS** ready (add certificates to Nginx)
- ✅ **Health checks** and verification
- ✅ **Rollback capability** (PM2 handles process management)
- ✅ **Secure secret generation** for each deployment
- ✅ **Static file caching** configured in Nginx
- ✅ **Security headers** included

## 📱 Instance Details

- **Instance ID**: `i-0f4af27f7d4b2ee8d`
- **Region**: `ap-southeast-1` (Singapore)
- **User**: `ubuntu`
- **Application Path**: `/var/www/MyDigitalSpace`
- **Backend Port**: `3001`
- **Frontend Port**: `80` (Nginx)

Your CI/CD pipeline is now ready for automated deployments! 🚀