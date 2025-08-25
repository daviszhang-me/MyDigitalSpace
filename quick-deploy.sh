#!/bin/bash

# Quick deployment script for AWS instance
set -e  # Exit on any error

SERVER_IP="52.221.181.208"
SERVER_USER="ubuntu"
APP_PORT=3001

echo "🚀 Quick deploying to $SERVER_IP..."
echo "📋 Using production configuration"

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
cd /var/www/MyDigitalSpace

# Ensure environment file exists with proper configuration
if [ ! -f backend/.env ]; then
    echo "Creating production environment file..."
    cat > backend/.env << "ENV_EOF"
NODE_ENV=production
PORT=3001
DB_PATH=./data/knowledgehub.db
JWT_SECRET=mydigitalspace-$(openssl rand -hex 32)
CORS_ORIGIN=http://52.221.181.208,https://52.221.181.208
FRONTEND_URL=http://52.221.181.208
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ENV_EOF
fi

cd backend

# Install/update dependencies
echo "Installing dependencies..."
npm install --production

# Create database directories if they don't exist
mkdir -p data database

# Run database setup
echo "Setting up database..."
node scripts/setup-database.js 2>/dev/null || echo "Database setup script not found, will initialize on first run"
node scripts/add-users.js 2>/dev/null || echo "Users already exist or script not found"

# Restart the application
echo "Restarting application..."
pm2 restart mydigitalspace-backend 2>/dev/null || pm2 start server-sqlite.js --name mydigitalspace-backend

# Check status
pm2 status
EOF

echo "✅ Deployment completed!"
echo "🌐 Check your site at: http://$SERVER_IP"