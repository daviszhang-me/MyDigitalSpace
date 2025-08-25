#!/bin/bash

# This script will set up the KnowledgeHub application
cd /opt/knowledgehub

# Create backend directory structure
mkdir -p backend/{config,routes,scripts,data}

# Copy backend server file (simplified for direct deployment)
cat > server-sqlite.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 80;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from root
app.use(express.static(__dirname));

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API route
app.get('/api', (req, res) => {
    res.json({ message: 'KnowledgeHub API is running', version: '1.0.0' });
});

// Import content routes if they exist
try {
    const contentRoutes = require('./backend/routes/content');
    app.use('/api/content', contentRoutes);
    console.log('Content routes loaded');
} catch (err) {
    console.log('Content routes not found, using basic setup');
}

// Catch all route - serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`KnowledgeHub server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
EOF

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'knowledgehub',
    script: 'server-sqlite.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 80
    },
    error_file: '/var/log/knowledgehub-error.log',
    out_file: '/var/log/knowledgehub-out.log',
    log_file: '/var/log/knowledgehub.log',
    time: true
  }]
};
EOF

echo "Application setup completed"