#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting KnowledgeHub Ubuntu Deployment..."

# Update system
apt-get update -y
apt-get upgrade -y

# Install curl and other basics
apt-get install -y curl wget gnupg2 software-properties-common

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /opt/knowledgehub
cd /opt/knowledgehub

# Create package.json
cat > package.json << 'EOF'
{
  "name": "knowledgehub",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

# Install dependencies
npm install

# Create simple server.js
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 80;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        message: 'KnowledgeHub is running successfully on Ubuntu!',
        nodeVersion: process.version
    });
});

// API endpoint
app.get('/api', (req, res) => {
    res.json({ 
        message: 'KnowledgeHub API is running', 
        version: '1.0.0',
        platform: 'Ubuntu 24.04',
        endpoints: ['/health', '/api']
    });
});

// Serve main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`KnowledgeHub running on port ${PORT}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Platform: Ubuntu 24.04`);
});
EOF

# Create index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Davis Zhang - KnowledgeHub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .container { max-width: 900px; padding: 2rem; }
        .hero { text-align: center; background: rgba(255,255,255,0.15); padding: 4rem; border-radius: 20px; backdrop-filter: blur(15px); box-shadow: 0 8px 32px rgba(31,38,135,0.37); }
        .hero h1 { font-size: 3.5rem; margin-bottom: 1rem; font-weight: 700; }
        .hero p { font-size: 1.4rem; opacity: 0.9; margin-bottom: 2rem; }
        .status { background: rgba(76,175,80,0.3); border: 2px solid #4caf50; padding: 2rem; border-radius: 15px; margin: 2rem 0; }
        .status h3 { font-size: 1.5rem; margin-bottom: 1rem; }
        .btn { display: inline-block; background: linear-gradient(45deg, #4caf50, #45a049); color: white; padding: 18px 36px; border-radius: 10px; text-decoration: none; margin: 15px; transition: all 0.3s; font-weight: 600; }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        .info { background: rgba(255,255,255,0.1); padding: 2rem; border-radius: 15px; margin: 2rem 0; }
        .footer { text-align: center; padding: 2rem; opacity: 0.8; font-size: 0.9rem; }
        #status-details { font-size: 1rem; opacity: 0.9; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🚀 KnowledgeHub</h1>
            <p>Davis Zhang's Personal Knowledge Management System</p>
            <div class="status">
                <h3>✅ Successfully Deployed on Ubuntu!</h3>
                <p>Direct Node.js deployment on AWS EC2</p>
                <p id="status-details">Loading server information...</p>
            </div>
            <a href="/api" class="btn" target="_blank">Test API</a>
            <a href="/health" class="btn" target="_blank">Health Check</a>
        </div>
        
        <div class="info">
            <h3>🎯 System Information</h3>
            <div id="system-info">
                <p>🖥️ Platform: Ubuntu 24.04 LTS</p>
                <p>⚡ Runtime: Node.js (Direct deployment)</p>
                <p>🌐 Region: ap-southeast-1 (Singapore)</p>
                <p>💾 Instance: AWS EC2 t2.micro</p>
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p>Powered by Node.js • Ubuntu 24.04 • AWS EC2 • Built with ❤️ by Davis</p>
    </div>

    <script>
        // Test API and update status
        fetch('/health')
            .then(r => r.json())
            .then(data => {
                document.getElementById('status-details').innerHTML = 
                    `✨ ${data.message}<br>
                     🕒 Server Time: ${new Date(data.timestamp).toLocaleString()}<br>
                     📦 Node.js: ${data.nodeVersion}`;
            })
            .catch(e => {
                console.log('API test:', e);
                document.getElementById('status-details').innerHTML = 
                    '⏳ Server is starting up...';
            });
            
        // Also test API endpoint
        fetch('/api')
            .then(r => r.json())
            .then(data => {
                console.log('API Response:', data);
            })
            .catch(e => console.log('API Error:', e));
    </script>
</body>
</html>
EOF

# Set proper permissions
chown -R ubuntu:ubuntu /opt/knowledgehub
chmod +x /opt/knowledgehub/server.js

# Start with PM2 (run as ubuntu user)
cd /opt/knowledgehub
sudo -u ubuntu pm2 start server.js --name knowledgehub
sudo -u ubuntu pm2 startup
sudo -u ubuntu pm2 save

echo "KnowledgeHub Ubuntu deployment completed successfully!"
echo "Server should be running on port 80"
echo "Node.js version: $(node --version)"
echo "PM2 status: $(sudo -u ubuntu pm2 list)"