#!/bin/bash

# Minimal Node.js deployment that should work
exec > /var/log/simple-nodejs.log 2>&1

echo "=== Simple Node.js Deployment ===" 
date

# Update system
apt-get update -y

# Install Node.js via package manager (more reliable)
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Create application directory
mkdir -p /opt/app
cd /opt/app

# Create the simplest possible Express app
cat > server.js << 'EOF'
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>KnowledgeHub - Working!</title>
        <style>
            body { font-family: Arial; background: linear-gradient(135deg, #87ceeb 0%, #b0e0e6 100%); 
                   text-align: center; padding: 50px; margin: 0; min-height: 100vh; }
            .container { max-width: 800px; margin: auto; background: rgba(255,255,255,0.95); 
                        padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; margin-bottom: 20px; }
            .status { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; 
                     border-radius: 10px; margin: 20px 0; }
            .btn { background: #3498db; color: white; padding: 12px 24px; border: none; 
                   border-radius: 8px; cursor: pointer; margin: 10px; text-decoration: none; 
                   display: inline-block; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 KnowledgeHub - Node.js Success!</h1>
            <div class="status">
                <strong>✅ Your Node.js Application is Running!</strong>
                <p>KnowledgeHub has been successfully deployed to AWS EC2</p>
            </div>
            <p><strong>Platform:</strong> Node.js ${process.version}</p>
            <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
            <p><strong>Request URL:</strong> ${req.url}</p>
            <p><strong>User Agent:</strong> ${req.headers['user-agent']}</p>
            
            <div style="margin: 30px 0;">
                <h3>🎯 Next Steps:</h3>
                <p>• Domain mapping with Route 53</p>
                <p>• Full KnowledgeHub features</p>
                <p>• Database integration</p>
            </div>
            
            <a href="/test" class="btn">🧪 Test Page</a>
            <a href="/health" class="btn">❤️ Health Check</a>
        </div>
    </body>
    </html>
    `);
});

const PORT = 80;
server.listen(PORT, '0.0.0.0', () => {
    console.log(\`✅ Server running on port \${PORT}\`);
    console.log(\`🌐 Access: http://localhost:\${PORT}\`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully'); 
    server.close(() => {
        process.exit(0);
    });
});
EOF

# Start the application
echo "Starting Node.js server..."
nohup node server.js > /var/log/nodejs-app.log 2>&1 &

# Verify it's running
sleep 5
ps aux | grep node
netstat -tlnp | grep :80

echo "=== Simple deployment completed! ==="
date