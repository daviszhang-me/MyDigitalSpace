#!/bin/bash

# Upgrade the working instance to full Node.js KnowledgeHub
exec > /var/log/nodejs-upgrade.log 2>&1

echo "=== Starting Node.js KnowledgeHub Upgrade ==="
date

# Stop the Python server first
pkill -f "python3 -m http.server"

# Install Node.js 18
echo "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install PM2 for process management
npm install -g pm2

# Create application directory
mkdir -p /opt/knowledgehub
cd /opt/knowledgehub

# Create package.json with all your dependencies
cat > package.json << 'EOF'
{
  "name": "knowledgehub",
  "version": "1.0.0",
  "description": "Davis Zhang's Personal Knowledge Management System",
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
    "multer": "^1.4.5-lts.1",
    "path": "^0.12.7",
    "fs": "^0.0.1-security"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Create backend directory structure
mkdir -p backend/{config,routes,scripts,data}

# Create database configuration
cat > backend/config/database-sqlite.js << 'EOF'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/knowledgehub.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database:', dbPath);
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Create notes table
    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        source_url TEXT,
        source_title TEXT,
        source_type TEXT
    )`);

    // Create categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default categories
    const defaultCategories = [
        { name: 'ideas', display_name: 'Ideas', color: '#e74c3c' },
        { name: 'projects', display_name: 'Projects', color: '#2ecc71' },
        { name: 'learning', display_name: 'Learning', color: '#3498db' },
        { name: 'resources', display_name: 'Resources', color: '#f39c12' }
    ];

    defaultCategories.forEach(cat => {
        db.run(`INSERT OR IGNORE INTO categories (name, display_name, color) VALUES (?, ?, ?)`,
            [cat.name, cat.display_name, cat.color]);
    });

    console.log('Database initialized successfully');
}

module.exports = db;
EOF

# Create basic content routes
cat > backend/routes/content.js << 'EOF'
const express = require('express');
const router = express.Router();
const db = require('../config/database-sqlite');

// Get all notes
router.get('/notes', (req, res) => {
    db.all('SELECT * FROM notes ORDER BY updated_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

// Create new note
router.post('/notes', (req, res) => {
    const { title, content, category } = req.body;
    db.run('INSERT INTO notes (title, content, category) VALUES (?, ?, ?)',
        [title, content, category],
        function(err) {
            if (err) {
                res.status(500).json({ success: false, error: err.message });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        });
});

// Get categories
router.get('/categories', (req, res) => {
    db.all('SELECT * FROM categories ORDER BY name', [], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

// Health check
router.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
EOF

# Create main server file
cat > server-sqlite.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 80;

// Import database (this will initialize it)
require('./backend/config/database-sqlite');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from root
app.use(express.static(__dirname));

// API routes
app.use('/api/content', require('./backend/routes/content'));

// Basic API info
app.get('/api', (req, res) => {
    res.json({ 
        message: 'KnowledgeHub API is running',
        version: '2.0.0',
        features: ['Notes Management', 'Categories', 'SQLite Database'],
        endpoints: {
            notes: '/api/content/notes',
            categories: '/api/content/categories',
            health: '/api/content/health'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: 'Node.js + SQLite + Ubuntu 24.04'
    });
});

// Serve main application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KnowledgeHub running on port ${PORT}`);
    console.log(`📊 Platform: Node.js ${process.version} on Ubuntu 24.04`);
    console.log(`🗄️  Database: SQLite`);
    console.log(`🌐 Access: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
EOF

# Set proper permissions
chown -R ubuntu:ubuntu /opt/knowledgehub

# Start the application with PM2
cd /opt/knowledgehub
sudo -u ubuntu pm2 start server-sqlite.js --name knowledgehub
sudo -u ubuntu pm2 startup
sudo -u ubuntu pm2 save

echo "=== Node.js KnowledgeHub deployment completed! ==="
echo "Application should be running on port 80"
echo "PM2 status:"
sudo -u ubuntu pm2 list

date