#!/bin/bash

# This script will create your frontend files on the server
cd /opt/knowledgehub

# Create the main index.html file
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Davis Zhang - Personal Website & Knowledge Hub</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #87ceeb 0%, #b0e0e6 100%);
            min-height: 100vh;
            color: #333;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: rgba(255, 255, 255, 0.9);
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            flex: 1;
        }

        .hero {
            text-align: center;
            background: rgba(255, 255, 255, 0.9);
            padding: 3rem;
            border-radius: 15px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }

        .hero h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            color: #2c3e50;
        }

        .hero p {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 2rem;
        }

        .status {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            padding: 1rem;
            border-radius: 8px;
            margin: 2rem 0;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }

        .feature {
            background: rgba(255, 255, 255, 0.9);
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .feature h3 {
            color: #2c3e50;
            margin-bottom: 1rem;
        }

        .btn {
            display: inline-block;
            background: #3498db;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            transition: background 0.3s;
        }

        .btn:hover {
            background: #2980b9;
        }

        .coming-soon {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <h2>🚀 KnowledgeHub</h2>
        </div>
    </div>

    <div class="container">
        <div class="hero">
            <h1>Welcome to KnowledgeHub</h1>
            <p>Your Personal Knowledge Management System</p>
            
            <div class="status">
                <h3>✅ Deployment Successful!</h3>
                <p>Your KnowledgeHub is now running on AWS EC2 (Direct Node.js Deployment)</p>
            </div>
        </div>

        <div class="coming-soon">
            <h3>🔧 Setting Up Full Application</h3>
            <p>The complete KnowledgeHub application with all features is being configured...</p>
        </div>

        <div class="features">
            <div class="feature">
                <h3><i class="fas fa-notes-medical"></i> Note Management</h3>
                <p>Organize your thoughts, ideas, and knowledge with a powerful note-taking system.</p>
            </div>
            
            <div class="feature">
                <h3><i class="fas fa-rss"></i> RSS Feed Integration</h3>
                <p>Stay updated with your favorite content sources through RSS feed management.</p>
            </div>
            
            <div class="feature">
                <h3><i class="fas fa-tags"></i> Category System</h3>
                <p>Organize content with flexible categories and tags for easy retrieval.</p>
            </div>
            
            <div class="feature">
                <h3><i class="fas fa-search"></i> Smart Search</h3>
                <p>Find what you need quickly with powerful search and filtering capabilities.</p>
            </div>
        </div>
    </div>

    <script>
        // Test API connectivity
        fetch('/api')
            .then(response => response.json())
            .then(data => {
                console.log('API Status:', data);
            })
            .catch(error => {
                console.log('API not yet ready:', error);
            });

        // Health check
        fetch('/health')
            .then(response => response.json())
            .then(data => {
                console.log('Health Check:', data);
                document.querySelector('.status p').innerHTML = 
                    'Your KnowledgeHub is healthy and running! ✨<br>Server Time: ' + data.timestamp;
            })
            .catch(error => {
                console.log('Health check failed:', error);
            });
    </script>
</body>
</html>
EOF

# Create basic script.js (placeholder)
cat > script.js << 'EOF'
// KnowledgeHub Frontend JavaScript
console.log('KnowledgeHub Frontend Loaded');

// Basic API test
async function testAPI() {
    try {
        const response = await fetch('/api');
        const data = await response.json();
        console.log('API Response:', data);
    } catch (error) {
        console.error('API Error:', error);
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', function() {
    testAPI();
});
EOF

echo "Frontend files created successfully"