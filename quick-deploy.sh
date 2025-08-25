#!/bin/bash

# Quick deployment script for AWS instance
SERVER_IP="52.221.181.208"
SERVER_USER="ubuntu"

echo "🚀 Quick deploying to $SERVER_IP..."

# Sync files (excluding node_modules and other files)
echo "📤 Syncing files..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='deploy.sh' \
    --exclude='quick-deploy.sh' \
    /Users/daviszhang/project/MyDigitalSpace/ \
    $SERVER_USER@$SERVER_IP:/var/www/MyDigitalSpace/

# Execute remote commands
echo "🔧 Setting up on server..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
cd /var/www/MyDigitalSpace/backend

# Install/update dependencies
echo "Installing dependencies..."
npm install --production

# Create database directory if it doesn't exist
mkdir -p database

# Run database setup
echo "Setting up database..."
node scripts/add-users.js 2>/dev/null || echo "Users already exist or script not found"

# Restart the application
echo "Restarting application..."
pm2 restart mydigitalspace-backend 2>/dev/null || pm2 start server-sqlite.js --name mydigitalspace-backend

# Check status
pm2 status
EOF

echo "✅ Deployment completed!"
echo "🌐 Check your site at: http://$SERVER_IP"