#!/bin/bash

# AWS Instance Deployment Script
# Deploy MyDigitalSpace to AWS instance

set -e  # Exit on any error

# Configuration
SERVER_IP="52.221.181.208"
SERVER_USER="ubuntu"
REMOTE_PATH="/var/www/MyDigitalSpace"
LOCAL_PATH="/Users/daviszhang/project/MyDigitalSpace"
ENVIRONMENT="production"

# Environment Variables
APP_PORT=3001
NGINX_PORT=80

echo "🚀 Starting deployment to AWS instance: $SERVER_IP"
echo "📋 Environment: $ENVIRONMENT"
echo "🔌 App Port: $APP_PORT, Nginx Port: $NGINX_PORT"

# Validate environment
if [ ! -f "$LOCAL_PATH/.env.production" ]; then
    echo "❌ Production environment file not found: $LOCAL_PATH/.env.production"
    echo "Please create it from .env.example"
    exit 1
fi

# Check if SSH key exists (you may need to adjust the path)
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "❌ SSH key not found. Please ensure you have SSH access to the server."
    echo "You can generate one with: ssh-keygen -t rsa"
    exit 1
fi

echo "📦 Creating deployment package..."

# Create temporary deployment directory
TEMP_DIR="/tmp/mydigitalspace-deploy"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# Copy files to temp directory (excluding node_modules and other unnecessary files)
echo "📁 Copying application files..."
rsync -av --exclude='node_modules' \
          --exclude='.git' \
          --exclude='*.log' \
          --exclude='.DS_Store' \
          --exclude='deploy.sh' \
          $LOCAL_PATH/ $TEMP_DIR/

echo "🔧 Preparing backend configuration..."

# Generate secure JWT secret if needed
JWT_SECRET_VALUE="mydigitalspace-$(openssl rand -hex 32)"

# Create production environment file with secure defaults
cat > $TEMP_DIR/backend/.env << EOF
NODE_ENV=production
PORT=$APP_PORT
DB_PATH=./data/knowledgehub.db
JWT_SECRET=$JWT_SECRET_VALUE
CORS_ORIGIN=http://$SERVER_IP,https://$SERVER_IP,http://$SERVER_IP:$NGINX_PORT
FRONTEND_URL=http://$SERVER_IP
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

echo "✅ Generated secure JWT secret and environment configuration"

echo "📤 Uploading files to server..."

# Upload files to server
scp -r $TEMP_DIR/* $SERVER_USER@$SERVER_IP:$REMOTE_PATH/ || {
    echo "❌ Failed to upload files. Please check:"
    echo "1. SSH access is configured"
    echo "2. Server is accessible"
    echo "3. Remote directory exists"
    exit 1
}

echo "🏗️  Setting up server environment..."

# Execute commands on remote server
ssh $SERVER_USER@$SERVER_IP << 'REMOTE_COMMANDS'
cd /var/www/MyDigitalSpace

echo "Installing Node.js dependencies..."
cd backend
npm install --production

echo "Setting up database..."
mkdir -p data database
# Create database directory structure
if [ ! -f data/knowledgehub.db ]; then
    echo "Initializing database..."
    node scripts/setup-database.js 2>/dev/null || echo "Database setup script not found, will initialize on first run"
fi
node scripts/add-users.js 2>/dev/null || echo "User creation script not found or users already exist"

echo "Setting up PM2 process manager..."
# Install PM2 if not already installed
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'PM2_CONFIG'
module.exports = {
  apps: [{
    name: 'mydigitalspace-backend',
    script: 'server-sqlite.js',
    cwd: '/var/www/MyDigitalSpace/backend',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/mydigitalspace/error.log',
    out_file: '/var/log/mydigitalspace/access.log',
    log_file: '/var/log/mydigitalspace/combined.log',
    time: true
  }]
};
PM2_CONFIG

# Create log directory
sudo mkdir -p /var/log/mydigitalspace
sudo chown $USER:$USER /var/log/mydigitalspace

# Stop existing process and start new one
pm2 stop mydigitalspace-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "Setting up Nginx configuration..."
# Create Nginx site configuration
sudo tee /etc/nginx/sites-available/mydigitalspace << 'NGINX_CONFIG'
server {
    listen 80;
    server_name 52.221.181.208;

    # Serve static files
    location / {
        root /var/www/MyDigitalSpace;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
NGINX_CONFIG

# Enable site and restart Nginx
sudo ln -sf /etc/nginx/sites-available/mydigitalspace /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "🎉 Deployment completed successfully!"
echo "Your application is now running at: http://52.221.181.208"
echo "Backend API: http://52.221.181.208/api"

REMOTE_COMMANDS

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your application is now available at:"
echo "   Frontend: http://$SERVER_IP"
echo "   Backend API: http://$SERVER_IP/api"
echo ""
echo "📊 To monitor the application:"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo "   pm2 status"
echo "   pm2 logs mydigitalspace-backend"

# Cleanup
rm -rf $TEMP_DIR

echo "🧹 Cleanup completed."