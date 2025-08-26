const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database and routes
const { testConnection } = require('./config/database');
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const workflowRoutes = require('./routes/workflows');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:8000',
            'http://localhost:3000',
            'http://127.0.0.1:8000',
            'http://127.0.0.1:3000'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', limiter);

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.originalUrl} - ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'KnowledgeHub API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/workflows', workflowRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'KnowledgeHub API v1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/register': 'Register a new user',
                'POST /api/auth/login': 'Login user',
                'GET /api/auth/profile': 'Get user profile (requires auth)',
                'PUT /api/auth/profile': 'Update user profile (requires auth)',
                'GET /api/auth/verify': 'Verify JWT token (requires auth)'
            },
            notes: {
                'GET /api/notes': 'Get all user notes with filtering (requires auth)',
                'GET /api/notes/:id': 'Get specific note (requires auth)',
                'POST /api/notes': 'Create new note (requires auth)',
                'PUT /api/notes/:id': 'Update note (requires auth)',
                'DELETE /api/notes/:id': 'Delete note (requires auth)',
                'POST /api/notes/:id/duplicate': 'Duplicate note (requires auth)',
                'GET /api/notes/stats/summary': 'Get user statistics (requires auth)'
            },
            workflows: {
                'GET /api/workflows': 'Get all user workflows with filtering (requires auth)',
                'GET /api/workflows/:id': 'Get specific workflow with steps (requires auth)',
                'POST /api/workflows': 'Create new workflow (requires auth)',
                'PUT /api/workflows/:id': 'Update workflow (requires auth)',
                'DELETE /api/workflows/:id': 'Delete workflow (requires auth)',
                'POST /api/workflows/:id/steps': 'Create workflow step (requires auth)',
                'PUT /api/workflows/:id/steps/:stepId': 'Update workflow step (requires auth)',
                'DELETE /api/workflows/:id/steps/:stepId': 'Delete workflow step (requires auth)',
                'POST /api/workflows/:id/attachments': 'Attach note/url to workflow (requires auth)',
                'GET /api/workflows/stats/summary': 'Get workflow statistics (requires auth)'
            }
        },
        headers: {
            'Authorization': 'Bearer <jwt_token>',
            'Content-Type': 'application/json'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // Handle specific error types
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body'
        });
    }
    
    if (error.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'CORS policy violation'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📦 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📦 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Exiting...');
            process.exit(1);
        }

        // Start listening
        app.listen(PORT, () => {
            console.log('🚀 KnowledgeHub API Server Started');
            console.log(`📍 Server running on http://localhost:${PORT}`);
            console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
            console.log(`💚 Health Check: http://localhost:${PORT}/health`);
            console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('✅ Ready to handle requests!');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Initialize server
startServer();

module.exports = app;