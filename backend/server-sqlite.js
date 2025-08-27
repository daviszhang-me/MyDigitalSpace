const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Import SQLite database
const { initDatabase, query, testConnection } = require('./config/database-sqlite');

// Initialize Express app
const app = express();
app.set("trust proxy", 1); // Trust first proxy (Nginx)
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false // Disable CSP for development
}));

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:8000', 
        'http://127.0.0.1:8000', 
        'http://localhost:8080', 
        'http://127.0.0.1:8080',
        'http://52.221.181.208',
        'https://52.221.181.208'
    ],
    credentials: true
}));

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// JWT Helper
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Check note creation permission middleware
const requireNoteCreation = (req, res, next) => {
    if (!req.user.can_create_notes && req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'You do not have permission to create or modify notes. Contact your administrator for access.',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }
    next();
};

// Auth middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await query('SELECT id, email, name, role, can_create_notes FROM users WHERE id = ? AND is_active = 1', [decoded.userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Health check with comprehensive status
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        const dbTest = await query('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"');
        const tableCount = dbTest[0].count;
        
        // Check if required tables exist
        const requiredTables = ['users', 'notes', 'workflows'];
        const existingTables = await query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
        `, requiredTables);
        
        const missingTables = requiredTables.filter(table => 
            !existingTables.some(existing => existing.name === table)
        );
        
        const healthStatus = {
            success: true,
            message: 'MyDigitalSpace API is running (SQLite)',
            timestamp: new Date().toISOString(),
            version: '1.2.0-sqlite',
            database: {
                connected: true,
                totalTables: tableCount,
                requiredTables: requiredTables.length,
                missingTables: missingTables,
                status: missingTables.length === 0 ? 'healthy' : 'degraded'
            },
            features: {
                knowledgeHub: missingTables.includes('notes') ? 'unavailable' : 'available',
                workflowHub: missingTables.includes('workflows') ? 'unavailable' : 'available',
                authentication: missingTables.includes('users') ? 'unavailable' : 'available'
            },
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime()
        };
        
        // Return 503 if critical tables are missing
        if (missingTables.length > 0) {
            return res.status(503).json({
                ...healthStatus,
                success: false,
                message: 'Service degraded - missing database tables'
            });
        }
        
        res.json(healthStatus);
        
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            success: false,
            message: 'Service unhealthy',
            timestamp: new Date().toISOString(),
            version: '1.2.0-sqlite',
            database: {
                connected: false,
                error: error.message
            },
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime()
        });
    }
});

// API Info
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'KnowledgeHub API v1.0.0 (SQLite)',
        database: 'SQLite',
        endpoints: {
            auth: {
                'POST /api/auth/register': 'Register new user',
                'POST /api/auth/login': 'Login user',
                'GET /api/auth/profile': 'Get user profile'
            },
            notes: {
                'GET /api/notes': 'Get all notes (public)',
                'GET /api/notes/stats/summary': 'Get notes statistics (public)',
                'POST /api/notes': 'Create note (requires auth)',
                'PUT /api/notes/:id': 'Update note (requires auth)',
                'DELETE /api/notes/:id': 'Delete note (requires auth)'
            }
        }
    });
});

// AUTH ROUTES

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const schema = Joi.object({
            name: Joi.string().min(2).max(100).required(),
            email: Joi.string().email().required(),
            password: Joi.string().min(6).required(),
            confirmPassword: Joi.string().valid(Joi.ref('password')).required()
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'User already exists' });
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(password, 12);
        const userId = uuidv4();

        await query(
            'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
            [userId, name, email.toLowerCase(), passwordHash]
        );

        const token = generateToken(userId);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: { 
                token, 
                user: { 
                    id: userId, 
                    name, 
                    email: email.toLowerCase(),
                    role: 'viewer',
                    can_create_notes: 0
                } 
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().required()
        });

        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const { email, password } = req.body;

        // Find user
        const userResult = await query(
            'SELECT id, name, email, password_hash, role, can_create_notes FROM users WHERE email = ? AND is_active = 1',
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(user.id);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email,
                    role: user.role,
                    can_create_notes: user.can_create_notes
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Get Profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: { user: req.user }
    });
});

// NOTES ROUTES

// Get all notes (public access - no authentication required)
app.get('/api/notes', async (req, res) => {
    try {
        const { category, search, limit = 50 } = req.query;
        
        // Allow viewers to see all notes, but admins/editors can see only their own if they prefer
        // For now, everyone sees all notes (shared knowledge base)
        let sql = 'SELECT * FROM notes WHERE is_archived = 0';
        let params = [];

        if (category && category !== 'all') {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (search) {
            sql += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY updated_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const result = await query(sql, params);
        
        // Parse tags from JSON string
        const notes = result.rows.map(note => ({
            ...note,
            tags: JSON.parse(note.tags || '[]')
        }));

        res.json({
            success: true,
            data: { notes }
        });

    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notes' });
    }
});

// Create note
app.post('/api/notes', authenticateToken, requireNoteCreation, async (req, res) => {
    try {
        // Get all valid categories (predefined + custom)
        const validCategories = ['ideas', 'projects', 'learning', 'resources'];
        const customCategoriesResult = await query('SELECT name FROM user_categories WHERE user_id = ? AND is_active = 1', [req.user.id]);
        const customCategories = customCategoriesResult.rows.map(row => row.name);
        const allValidCategories = [...validCategories, ...customCategories];
        
        const schema = Joi.object({
            title: Joi.string().min(1).max(500).required(),
            content: Joi.string().min(1).required(),
            category: Joi.string().valid(...allValidCategories).required(),
            tags: Joi.array().items(Joi.string()).default([])
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const { title, content, category, tags } = value;

        const result = await query(
            'INSERT INTO notes (user_id, title, content, category, tags) VALUES (?, ?, ?, ?, ?) RETURNING *',
            [req.user.id, title, content, category, JSON.stringify(tags)]
        );

        // SQLite doesn't support RETURNING, so fetch the created note
        const noteResult = await query('SELECT * FROM notes WHERE rowid = last_insert_rowid()');
        const note = noteResult.rows[0];
        note.tags = JSON.parse(note.tags || '[]');

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: { note }
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ success: false, message: 'Failed to create note' });
    }
});

// Update note
app.put('/api/notes/:id', authenticateToken, requireNoteCreation, async (req, res) => {
    try {
        const noteId = req.params.id;
        
        // Get all valid categories (predefined + custom)
        const validCategories = ['ideas', 'projects', 'learning', 'resources'];
        const customCategoriesResult = await query('SELECT name FROM user_categories WHERE user_id = ? AND is_active = 1', [req.user.id]);
        const customCategories = customCategoriesResult.rows.map(row => row.name);
        const allValidCategories = [...validCategories, ...customCategories];
        
        const schema = Joi.object({
            title: Joi.string().min(1).max(500),
            content: Joi.string().min(1),
            category: Joi.string().valid(...allValidCategories),
            tags: Joi.array().items(Joi.string()),
            is_archived: Joi.boolean()
        }).min(1);

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        // Check if note exists
        const existingNote = await query('SELECT id FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);
        if (existingNote.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        // Build update query
        const updateFields = [];
        const updateValues = [];

        Object.keys(value).forEach(key => {
            if (key === 'tags') {
                updateFields.push('tags = ?');
                updateValues.push(JSON.stringify(value[key]));
            } else {
                updateFields.push(`${key} = ?`);
                updateValues.push(value[key]);
            }
        });

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(noteId, req.user.id);

        await query(
            `UPDATE notes SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
            updateValues
        );

        // Fetch updated note
        const noteResult = await query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);
        const note = noteResult.rows[0];
        note.tags = JSON.parse(note.tags || '[]');

        res.json({
            success: true,
            message: 'Note updated successfully',
            data: { note }
        });

    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ success: false, message: 'Failed to update note' });
    }
});

// Delete note
app.delete('/api/notes/:id', authenticateToken, requireNoteCreation, async (req, res) => {
    try {
        const noteId = req.params.id;

        const result = await query('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, req.user.id]);

        if (result.rows[0].changes === 0) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });

    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete note' });
    }
});

// Admin: Update user permissions (admin only)
app.put('/api/admin/users/:id/permissions', authenticateToken, async (req, res) => {
    try {
        // Check if requesting user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Admin access required' 
            });
        }

        const userId = req.params.id;
        const { can_create_notes, role } = req.body;

        const schema = Joi.object({
            can_create_notes: Joi.boolean(),
            role: Joi.string().valid('admin', 'editor', 'viewer')
        }).min(1);

        const { error, value } = schema.validate({ can_create_notes, role });
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        // Build update query
        const updateFields = [];
        const updateValues = [];

        if (value.can_create_notes !== undefined) {
            updateFields.push('can_create_notes = ?');
            updateValues.push(value.can_create_notes ? 1 : 0);
        }

        if (value.role !== undefined) {
            updateFields.push('role = ?');
            updateValues.push(value.role);
        }

        updateValues.push(userId);

        await query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Fetch updated user
        const userResult = await query('SELECT id, email, name, role, can_create_notes FROM users WHERE id = ?', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User permissions updated successfully',
            data: { user: userResult.rows[0] }
        });

    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({ success: false, message: 'Failed to update permissions' });
    }
});

// Admin: List all users (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // Check if requesting user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Admin access required' 
            });
        }

        const users = await query('SELECT id, email, name, role, can_create_notes, created_at FROM users WHERE is_active = 1 ORDER BY created_at DESC');
        
        res.json({
            success: true,
            data: { users: users.rows }
        });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// Get statistics (public access)
app.get('/api/notes/stats/summary', async (req, res) => {
    try {
        const statsResult = await query(`
            SELECT 
                COUNT(*) as total_notes,
                SUM(CASE WHEN category = 'ideas' THEN 1 ELSE 0 END) as ideas_count,
                SUM(CASE WHEN category = 'projects' THEN 1 ELSE 0 END) as projects_count,
                SUM(CASE WHEN category = 'learning' THEN 1 ELSE 0 END) as learning_count,
                SUM(CASE WHEN category = 'resources' THEN 1 ELSE 0 END) as resources_count,
                MAX(updated_at) as last_note_update
            FROM notes WHERE is_archived = 0
        `);

        res.json({
            success: true,
            data: {
                stats: statsResult.rows[0],
                tags: [] // Simplified for now
            }
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
});

// Content routes
const contentRoutes = require('./routes/content');
app.use('/api/content', contentRoutes);

// Quick workflow creation endpoint (for testing)
app.post('/api/workflows', authenticateToken, async (req, res) => {
    try {
        const { title, description, category, priority, due_date, tags } = req.body;
        const userId = req.user.id;
        
        console.log('Creating workflow:', { title, userId });
        
        const result = await query(`
            INSERT INTO workflows (user_id, title, description, category, priority, due_date, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, title, description || '', category || 'general', priority || 'medium', due_date, JSON.stringify(tags || [])]);
        
        const workflowId = result.lastID;
        
        // Get the created workflow
        const workflow = await query('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        
        res.json({
            success: true,
            message: 'Workflow created successfully',
            data: { workflow: workflow[0] }
        });
        
    } catch (error) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ success: false, message: 'Failed to create workflow' });
    }
});

// Get workflows endpoint (public access)
app.get('/api/workflows', async (req, res) => {
    try {
        // Get all workflows (public access like notes)
        const result = await query('SELECT * FROM workflows ORDER BY created_at DESC');
        // Handle SQLite result format - it might be an array directly or have a rows property
        const workflows = Array.isArray(result) ? result : (result.rows || []);
        
        console.log('📋 Fetching all workflows (public access)');
        console.log('📊 Found workflows:', workflows?.length, 'workflows');
        console.log('🔍 Workflows data:', workflows);
        
        res.json({
            success: true,
            data: { workflows }
        });
        
    } catch (error) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch workflows' });
    }
});

// Get single workflow with details (public access)
app.get('/api/workflows/:id', async (req, res) => {
    try {
        const workflowId = req.params.id;
        
        // Get workflow (public access - no user restriction)
        const workflowResult = await query('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        const workflows = Array.isArray(workflowResult) ? workflowResult : (workflowResult.rows || []);
        
        if (workflows.length === 0) {
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }
        
        const workflow = workflows[0];
        
        // Get workflow steps
        const stepsResult = await query('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC', [workflowId]);
        const steps = Array.isArray(stepsResult) ? stepsResult : (stepsResult.rows || []);
        
        // Parse tags if they exist
        if (workflow.tags) {
            try {
                workflow.tags = JSON.parse(workflow.tags);
            } catch (e) {
                workflow.tags = [];
            }
        } else {
            workflow.tags = [];
        }
        
        workflow.steps = steps;
        
        res.json({
            success: true,
            data: { workflow }
        });
        
    } catch (error) {
        console.error('Error fetching workflow details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch workflow details' });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const startServer = async () => {
    try {
        // Initialize database
        await initDatabase();
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ Database connection failed');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log('🚀 KnowledgeHub API Server Started (SQLite)');
            console.log(`📍 Server: http://localhost:${PORT}`);
            console.log(`📚 API Docs: http://localhost:${PORT}/api`);
            console.log(`💚 Health: http://localhost:${PORT}/health`);
            console.log('✅ Ready for requests!');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();