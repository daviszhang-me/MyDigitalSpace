#!/bin/bash

# Simple test deployment - just get something working
exec > /var/log/user-data.log 2>&1

echo "=== Starting Simple Test Deployment ==="
date

# Update and install basic tools
apt-get update -y
apt-get install -y python3

# Create a simple test page
mkdir -p /var/www
cat > /var/www/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>KnowledgeHub - Test Deployment</title>
    <style>
        body { font-family: Arial; background: #f0f8ff; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .status { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 KnowledgeHub Test Deployment</h1>
        <div class="status">
            <strong>✅ Basic Server Working!</strong>
            <p>This confirms your AWS EC2 instance and network setup is correct.</p>
        </div>
        <p><strong>Instance:</strong> Ubuntu 24.04 LTS</p>
        <p><strong>Date:</strong> <script>document.write(new Date().toLocaleString())</script></p>
        <p><strong>IP:</strong> 47.130.152.177</p>
        <p><strong>Next:</strong> Node.js deployment will follow</p>
    </div>
</body>
</html>
EOF

# Start simple Python HTTP server on port 80
cd /var/www
nohup python3 -m http.server 80 > /var/log/http-server.log 2>&1 &

echo "=== Simple deployment completed ==="
echo "Python HTTP server started on port 80"
echo "Serving from: /var/www/"
date