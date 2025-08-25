#!/bin/bash

# Debug and fix the Node.js deployment
exec > /var/log/nodejs-debug.log 2>&1

echo "=== Debugging Node.js KnowledgeHub Deployment ===" 
date

# Check if the original deployment ran
echo "Checking previous deployment..."
ls -la /opt/knowledgehub/
echo "Package.json exists: $(test -f /opt/knowledgehub/package.json && echo 'YES' || echo 'NO')"
echo "Server.js exists: $(test -f /opt/knowledgehub/server.js && echo 'YES' || echo 'NO')"

# Check Node.js installation
echo "Node.js version: $(node --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "NPM version: $(npm --version 2>/dev/null || echo 'NOT INSTALLED')"
echo "PM2 version: $(pm2 --version 2>/dev/null || echo 'NOT INSTALLED')"

# Check if PM2 processes are running
echo "PM2 processes:"
sudo -u ubuntu pm2 list 2>/dev/null || echo "PM2 not available or no processes"

# Check what's listening on port 80
echo "What's on port 80:"
netstat -tlnp | grep :80 || echo "Nothing on port 80"

# Check system processes
echo "Node processes:"
ps aux | grep node | grep -v grep || echo "No node processes"

# If Node.js is not installed, install it
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs build-essential
    npm install -g pm2
fi

# Navigate to app directory
cd /opt/knowledgehub

# If package.json doesn't exist, create minimal setup
if [ ! -f package.json ]; then
    echo "Creating minimal package.json..."
    cat > package.json << 'EOF'
{
  "name": "knowledgehub",
  "version": "2.0.0",
  "description": "Davis Zhang Personal Knowledge Hub",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5"
  }
}
EOF
    npm install
fi

# Create simple server if it doesn't exist
if [ ! -f server.js ]; then
    echo "Creating simple server.js..."
    cat > server.js << 'EOF'
const express = require('express');
const path = require('path');

const app = express();
const PORT = 80;

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>KnowledgeHub - Node.js Working!</title>
        <style>
            body { font-family: Arial; background: linear-gradient(135deg, #87ceeb 0%, #b0e0e6 100%); 
                   text-align: center; padding: 50px; margin: 0; min-height: 100vh; }
            .container { max-width: 800px; margin: auto; background: rgba(255,255,255,0.95); 
                        padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; margin-bottom: 20px; }
            .status { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; 
                     border-radius: 10px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 KnowledgeHub Node.js Application</h1>
            <div class="status">
                <strong>✅ Node.js Application Running Successfully!</strong>
                <p>Your KnowledgeHub is now powered by Node.js + Express</p>
            </div>
            <p><strong>Platform:</strong> Node.js ${process.version}</p>
            <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
            <p><strong>IP:</strong> 18.136.213.117</p>
            <button onclick="testAPI()" style="background: #3498db; color: white; padding: 12px 24px; 
                    border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                🧪 Test API
            </button>
        </div>
        <script>
            function testAPI() {
                fetch('/health')
                .then(res => res.json())
                .then(data => alert('API Test: ' + JSON.stringify(data, null, 2)))
                .catch(err => alert('API Error: ' + err.message));
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        platform: 'Node.js ' + process.version,
        version: '2.0.0'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ KnowledgeHub running on port ${PORT}`);
    console.log(`🌐 Access: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
EOF
fi

# Stop any existing processes on port 80
echo "Stopping existing processes on port 80..."
sudo fuser -k 80/tcp 2>/dev/null || echo "No processes to kill on port 80"
sudo -u ubuntu pm2 delete all 2>/dev/null || echo "No PM2 processes to delete"

# Set permissions
chown -R ubuntu:ubuntu /opt/knowledgehub

# Start the application
echo "Starting Node.js application..."
cd /opt/knowledgehub
sudo -u ubuntu pm2 start server.js --name knowledgehub
sudo -u ubuntu pm2 startup systemd --user ubuntu 2>/dev/null || echo "PM2 startup skipped"
sudo -u ubuntu pm2 save

echo "=== Debug deployment completed! ==="
echo "Application status:"
sudo -u ubuntu pm2 list
echo "Port 80 status:"
netstat -tlnp | grep :80
date