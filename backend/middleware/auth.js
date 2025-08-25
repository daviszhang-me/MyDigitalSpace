const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// JWT Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }

    try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists and is active
        const userQuery = 'SELECT id, email, name, is_active FROM users WHERE id = $1 AND is_active = true';
        const userResult = await pool.query(userQuery, [decoded.userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token - user not found' 
            });
        }

        // Add user info to request
        req.user = {
            id: decoded.userId,
            email: userResult.rows[0].email,
            name: userResult.rows[0].name
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired' 
            });
        }
        
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
        });
    }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userQuery = 'SELECT id, email, name FROM users WHERE id = $1 AND is_active = true';
        const userResult = await pool.query(userQuery, [decoded.userId]);
        
        req.user = userResult.rows.length > 0 ? {
            id: decoded.userId,
            email: userResult.rows[0].email,
            name: userResult.rows[0].name
        } : null;
        
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
};

module.exports = {
    authenticateToken,
    optionalAuth,
    generateToken
};