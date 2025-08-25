#!/bin/bash

echo "Starting complete KnowledgeHub deployment..."

# Wait for Node.js setup to complete
sleep 60

# Change to app directory
cd /opt/knowledgehub

# Run setup script
bash -c '$(cat << "SETUP_EOF"
#!/bin/bash
cd /opt/knowledgehub

# Create frontend files
cat > index.html << "EOF"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Davis Zhang - Personal Website & Knowledge Hub</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #87ceeb 0%, #b0e0e6 100%);
            min-height: 100vh; color: #333; display: flex; flex-direction: column;
        }
        .header { background: rgba(255, 255, 255, 0.9); padding: 1rem 2rem; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; flex: 1; }
        .hero { text-align: center; background: rgba(255, 255, 255, 0.9); padding: 3rem; border-radius: 15px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1); margin-bottom: 2rem; }
        .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; color: #2c3e50; }
        .hero p { font-size: 1.2rem; color: #666; margin-bottom: 2rem; }
        .status { background: #e8f5e8; border: 1px solid #4caf50; padding: 1rem; border-radius: 8px; margin: 2rem 0; }
        .btn { display: inline-block; background: #3498db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; transition: background 0.3s; }
        .btn:hover { background: #2980b9; }
    </style>
</head>
<body>
    <div class="header"><div class="container"><h2>🚀 KnowledgeHub</h2></div></div>
    <div class="container">
        <div class="hero">
            <h1>Welcome to Davis Zhang\'s KnowledgeHub</h1>
            <p>Your Personal Knowledge Management System</p>
            <div class="status">
                <h3>✅ Successfully Deployed!</h3>
                <p>Running on AWS EC2 with Direct Node.js Deployment</p>
                <p id="status-details">Checking server status...</p>
            </div>
            <a href="/api" class="btn">Test API</a>
        </div>
    </div>
    <script>
        fetch("/health").then(r => r.json()).then(d => {
            document.getElementById("status-details").innerHTML = 
                "Server healthy! Time: " + new Date(d.timestamp).toLocaleString();
        }).catch(e => console.log("Health check:", e));
    </script>
</body>
</html>
EOF

cat > script.js << "EOF"
console.log("KnowledgeHub loaded successfully");
EOF

# Start the application with PM2
pm2 start server-sqlite.js --name knowledgehub
pm2 startup
pm2 save

echo "KnowledgeHub deployment completed!"
SETUP_EOF
)'