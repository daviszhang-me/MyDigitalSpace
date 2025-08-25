#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting KnowledgeHub Direct Deployment..."

# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git

# Install PM2
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
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "rss-parser": "^3.13.0",
    "multer": "^1.4.5-lts.1"
  }
}
EOF

# Install dependencies
npm install

# Create server.js
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 80;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        message: 'KnowledgeHub is running successfully!'
    });
});

// API endpoint
app.get('/api', (req, res) => {
    res.json({ 
        message: 'KnowledgeHub API is running', 
        version: '1.0.0',
        endpoints: ['/health', '/api']
    });
});

// Serve main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`KnowledgeHub running on port ${PORT}`);
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
            min-height: 100vh; color: white; display: flex; flex-direction: column;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem; flex: 1; }
        .hero { text-align: center; background: rgba(255,255,255,0.1); padding: 3rem; border-radius: 20px; backdrop-filter: blur(10px); margin-bottom: 2rem; }
        .hero h1 { font-size: 3rem; margin-bottom: 1rem; }
        .hero p { font-size: 1.3rem; opacity: 0.9; margin-bottom: 2rem; }
        .status { background: rgba(76,175,80,0.2); border: 1px solid #4caf50; padding: 1.5rem; border-radius: 10px; margin: 2rem 0; }
        .btn { display: inline-block; background: #4caf50; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; margin: 10px; transition: transform 0.2s; }
        .btn:hover { transform: translateY(-2px); }
        .info { background: rgba(255,255,255,0.1); padding: 2rem; border-radius: 15px; margin: 1rem 0; }
        .footer { text-align: center; padding: 2rem; opacity: 0.7; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🚀 KnowledgeHub</h1>
            <p>Davis Zhang's Personal Knowledge Management System</p>
            <div class="status">
                <h3>✅ Successfully Deployed!</h3>
                <p id="status">Direct Node.js deployment on AWS EC2</p>
            </div>
            <a href="/api" class="btn">Test API</a>
            <a href="/health" class="btn">Health Check</a>
        </div>
        
        <div class="info">
            <h3>🎯 Features Coming Soon</h3>
            <ul style="list-style: none; padding: 1rem 0;">
                <li style="padding: 0.5rem 0;">📝 Smart Note Management</li>
                <li style="padding: 0.5rem 0;">🔗 RSS Feed Integration</li>
                <li style="padding: 0.5rem 0;">🏷️ Category Organization</li>
                <li style="padding: 0.5rem 0;">🔍 Advanced Search</li>
            </ul>
        </div>
    </div>
    
    <div class="footer">
        <p>Powered by Node.js • Deployed on AWS EC2 • Built with ❤️</p>
    </div>

    <script>
        // Test API and update status
        fetch('/health')
            .then(r => r.json())
            .then(data => {
                document.getElementById('status').innerHTML = 
                    data.message + '<br><small>Server Time: ' + new Date(data.timestamp).toLocaleString() + '</small>';
            })
            .catch(e => console.log('API test:', e));
    </script>
</body>
</html>
EOF

# Start with PM2
pm2 start server.js --name knowledgehub
pm2 startup
pm2 save

echo "KnowledgeHub deployment completed successfully!"