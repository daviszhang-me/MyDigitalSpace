#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting direct Node.js deployment..."

# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git

# Install PM2 for process management
npm install -g pm2

# Create application directory
mkdir -p /opt/knowledgehub
cd /opt/knowledgehub

# Create package.json
cat > package.json << 'EOF'
{
  "name": "knowledgehub",
  "version": "1.0.0",
  "description": "Personal Knowledge Management System",
  "main": "server-sqlite.js",
  "scripts": {
    "start": "node server-sqlite.js",
    "dev": "nodemon server-sqlite.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "rss-parser": "^3.13.0",
    "multer": "^1.4.5-lts.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

echo "Direct deployment setup completed. Ready for application files."