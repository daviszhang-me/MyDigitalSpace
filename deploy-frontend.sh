#!/bin/bash

# Deploy complete frontend files
cd /opt/knowledgehub

# Create the complete index.html based on your original
cat > index.html << 'HTMLEOF'
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

        .navbar {
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 2rem;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #2c3e50;
        }

        .nav-links {
            display: flex;
            list-style: none;
            gap: 2rem;
        }

        .nav-links a {
            text-decoration: none;
            color: #2c3e50;
            font-weight: 500;
            transition: color 0.3s;
        }

        .nav-links a:hover {
            color: #3498db;
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
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            margin-bottom: 3rem;
        }

        .hero h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #2c3e50;
        }

        .hero p {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 2rem;
        }

        .status {
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            padding: 1.5rem;
            border-radius: 12px;
            margin: 2rem 0;
        }

        .status h3 {
            margin-bottom: 0.5rem;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin: 3rem 0;
        }

        .feature {
            background: rgba(255, 255, 255, 0.9);
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }

        .feature:hover {
            transform: translateY(-5px);
        }

        .feature h3 {
            color: #2c3e50;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .feature i {
            color: #3498db;
        }

        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.3s;
            cursor: pointer;
            margin: 0.5rem;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
        }

        .btn-success {
            background: linear-gradient(135deg, #2ecc71, #27ae60);
        }

        .btn-success:hover {
            box-shadow: 0 5px 15px rgba(46, 204, 113, 0.4);
        }

        .system-info {
            background: rgba(255, 255, 255, 0.9);
            padding: 2rem;
            border-radius: 15px;
            margin: 2rem 0;
        }

        .system-info h3 {
            color: #2c3e50;
            margin-bottom: 1rem;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }

        .info-item {
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }

        .loading {
            color: #666;
            font-style: italic;
        }

        .footer {
            background: rgba(255, 255, 255, 0.9);
            padding: 2rem;
            text-align: center;
            color: #666;
            margin-top: 3rem;
        }

        @media (max-width: 768px) {
            .nav-container {
                flex-direction: column;
                gap: 1rem;
            }

            .nav-links {
                flex-direction: column;
                text-align: center;
                gap: 1rem;
            }

            .hero h1 {
                font-size: 2rem;
            }

            .container {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-container">
            <div class="logo">🚀 KnowledgeHub</div>
            <ul class="nav-links">
                <li><a href="#" onclick="showSection('dashboard')">Dashboard</a></li>
                <li><a href="#" onclick="showSection('notes')">Notes</a></li>
                <li><a href="#" onclick="testAPI()">API Test</a></li>
                <li><a href="/health" target="_blank">Health</a></li>
            </ul>
        </div>
    </nav>

    <div class="container">
        <div class="hero">
            <h1>Welcome to KnowledgeHub</h1>
            <p>Davis Zhang's Personal Knowledge Management System</p>
            
            <div class="status">
                <h3>✅ Node.js Application Deployed Successfully!</h3>
                <p id="status-text">Full-featured KnowledgeHub with SQLite database</p>
                <p id="system-details" class="loading">Loading system information...</p>
            </div>

            <div>
                <button class="btn btn-success" onclick="testAPI()">🧪 Test API</button>
                <button class="btn" onclick="loadNotes()">📝 Load Notes</button>
                <button class="btn" onclick="loadCategories()">🏷️ Categories</button>
                <a href="/health" target="_blank" class="btn">❤️ Health Check</a>
            </div>
        </div>

        <div class="features">
            <div class="feature">
                <h3><i class="fas fa-notes-medical"></i> Smart Notes</h3>
                <p>Create, edit, and organize your notes with a powerful note-taking system. Support for categories, search, and rich content.</p>
                <button class="btn" onclick="createNote()">Create Note</button>
            </div>
            
            <div class="feature">
                <h3><i class="fas fa-database"></i> SQLite Database</h3>
                <p>Reliable data storage with SQLite. All your notes and categories are safely stored and easily accessible.</p>
                <button class="btn" onclick="showDBInfo()">Database Info</button>
            </div>
            
            <div class="feature">
                <h3><i class="fas fa-tags"></i> Category System</h3>
                <p>Organize content with flexible categories. Create custom categories and manage your knowledge efficiently.</p>
                <button class="btn" onclick="loadCategories()">View Categories</button>
            </div>
            
            <div class="feature">
                <h3><i class="fas fa-search"></i> API Integration</h3>
                <p>RESTful API for all operations. Perfect for integrations and future mobile applications.</p>
                <button class="btn" onclick="showAPIInfo()">API Docs</button>
            </div>
        </div>

        <div class="system-info">
            <h3>📊 System Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <strong>🖥️ Platform:</strong> <span id="platform">Ubuntu 24.04 LTS</span>
                </div>
                <div class="info-item">
                    <strong>⚡ Runtime:</strong> <span id="runtime">Node.js</span>
                </div>
                <div class="info-item">
                    <strong>🗄️ Database:</strong> <span id="database">SQLite</span>
                </div>
                <div class="info-item">
                    <strong>🌐 Region:</strong> <span id="region">Singapore (ap-southeast-1)</span>
                </div>
                <div class="info-item">
                    <strong>📍 Instance:</strong> <span id="instance">AWS EC2 t2.micro</span>
                </div>
                <div class="info-item">
                    <strong>⏱️ Uptime:</strong> <span id="uptime" class="loading">Loading...</span>
                </div>
            </div>
        </div>

        <div id="api-results" style="display: none;">
            <div class="system-info">
                <h3>🧪 API Test Results</h3>
                <pre id="api-output" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; overflow: auto;"></pre>
            </div>
        </div>
    </div>

    <footer class="footer">
        <p>🚀 Powered by Node.js + Express.js + SQLite • Ubuntu 24.04 • AWS EC2 • Built with ❤️ by Davis Zhang</p>
        <p><small>Version 2.0.0 • Full Node.js Deployment</small></p>
    </footer>

    <script>
        // Test API functionality
        async function testAPI() {
            const resultsDiv = document.getElementById('api-results');
            const outputPre = document.getElementById('api-output');
            
            resultsDiv.style.display = 'block';
            outputPre.textContent = 'Testing API endpoints...\n\n';
            
            try {
                // Test main API endpoint
                const apiResponse = await fetch('/api');
                const apiData = await apiResponse.json();
                outputPre.textContent += '✅ /api endpoint:\n' + JSON.stringify(apiData, null, 2) + '\n\n';
                
                // Test health endpoint
                const healthResponse = await fetch('/health');
                const healthData = await healthResponse.json();
                outputPre.textContent += '✅ /health endpoint:\n' + JSON.stringify(healthData, null, 2) + '\n\n';
                
                // Test content health
                const contentHealthResponse = await fetch('/api/content/health');
                const contentHealthData = await contentHealthResponse.json();
                outputPre.textContent += '✅ /api/content/health endpoint:\n' + JSON.stringify(contentHealthData, null, 2) + '\n\n';
                
                outputPre.textContent += '🎉 All API tests passed successfully!';
                
            } catch (error) {
                outputPre.textContent += '❌ Error testing API: ' + error.message;
            }
        }
        
        // Load notes
        async function loadNotes() {
            try {
                const response = await fetch('/api/content/notes');
                const data = await response.json();
                
                const outputPre = document.getElementById('api-output');
                const resultsDiv = document.getElementById('api-results');
                resultsDiv.style.display = 'block';
                
                if (data.success) {
                    outputPre.textContent = '📝 Notes loaded successfully:\n\n' + JSON.stringify(data.data, null, 2);
                } else {
                    outputPre.textContent = '❌ Error loading notes: ' + data.error;
                }
            } catch (error) {
                console.error('Error loading notes:', error);
                alert('Error loading notes: ' + error.message);
            }
        }
        
        // Load categories
        async function loadCategories() {
            try {
                const response = await fetch('/api/content/categories');
                const data = await response.json();
                
                const outputPre = document.getElementById('api-output');
                const resultsDiv = document.getElementById('api-results');
                resultsDiv.style.display = 'block';
                
                if (data.success) {
                    outputPre.textContent = '🏷️ Categories loaded successfully:\n\n' + JSON.stringify(data.data, null, 2);
                } else {
                    outputPre.textContent = '❌ Error loading categories: ' + data.error;
                }
            } catch (error) {
                console.error('Error loading categories:', error);
                alert('Error loading categories: ' + error.message);
            }
        }
        
        // Create note (placeholder)
        function createNote() {
            alert('🚧 Note creation UI coming soon! For now, you can use the API endpoint POST /api/content/notes');
        }
        
        // Show database info
        function showDBInfo() {
            alert('🗄️ Using SQLite database stored at: /opt/knowledgehub/backend/data/knowledgehub.db');
        }
        
        // Show API info
        function showAPIInfo() {
            const info = `
🚀 KnowledgeHub API Documentation:

Base URL: ${window.location.origin}/api

Endpoints:
• GET /api - API information
• GET /health - System health check
• GET /api/content/notes - Get all notes
• POST /api/content/notes - Create new note
• GET /api/content/categories - Get all categories
• GET /api/content/health - Database health check

Example: Create a note
POST /api/content/notes
{
  "title": "My Note",
  "content": "Note content here",
  "category": "ideas"
}
            `;
            alert(info);
        }
        
        // Load system information on page load
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                
                // Update status
                document.getElementById('system-details').innerHTML = 
                    `Node.js ${data.platform || 'Unknown'} • Uptime: ${Math.floor(data.uptime || 0)}s<br>
                     Server Time: ${new Date(data.timestamp).toLocaleString()}`;
                
                // Update uptime
                document.getElementById('uptime').textContent = Math.floor(data.uptime || 0) + ' seconds';
                
                // Update runtime info
                if (data.memory) {
                    document.getElementById('runtime').textContent = 
                        `Node.js (${(data.memory.rss / 1024 / 1024).toFixed(1)}MB RAM)`;
                }
                
            } catch (error) {
                console.error('Error loading system info:', error);
                document.getElementById('system-details').innerHTML = 
                    '⚠️ Could not load system information';
            }
        });
        
        // Section management (placeholder)
        function showSection(section) {
            console.log('Switching to section:', section);
            // This would be implemented for a full SPA
        }
    </script>
</body>
</html>
HTMLEOF

echo "Frontend files deployed successfully!"