const Joi = require('joi');

// User registration validation
const validateRegistration = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(100).trim().required(),
        email: Joi.string().email().lowercase().required(),
        password: Joi.string().min(6).max(100).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
            .messages({ 'any.only': 'Passwords must match' })
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
};

// User login validation
const validateLogin = (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().lowercase().required(),
        password: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    next();
};

// Note validation
const validateNote = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().min(1).max(500).trim().required(),
        content: Joi.string().min(1).max(50000).trim().required(),
        category: Joi.string().valid('ideas', 'projects', 'learning', 'resources').required(),
        tags: Joi.array().items(Joi.string().min(1).max(50).trim()).max(20).default([])
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    // Clean up tags (remove duplicates, empty strings)
    req.body = {
        ...value,
        tags: [...new Set(value.tags.filter(tag => tag && tag.trim()))].slice(0, 20)
    };

    next();
};

// Note update validation (all fields optional)
const validateNoteUpdate = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().min(1).max(500).trim(),
        content: Joi.string().min(1).max(50000).trim(),
        category: Joi.string().valid('ideas', 'projects', 'learning', 'resources'),
        tags: Joi.array().items(Joi.string().min(1).max(50).trim()).max(20),
        is_archived: Joi.boolean()
    }).min(1); // At least one field must be present

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    // Clean up tags if provided
    if (value.tags) {
        req.body.tags = [...new Set(value.tags.filter(tag => tag && tag.trim()))].slice(0, 20);
    }

    next();
};

// Query parameters validation for notes list
const validateNotesQuery = (req, res, next) => {
    const schema = Joi.object({
        category: Joi.string().valid('ideas', 'projects', 'learning', 'resources'),
        tags: Joi.string(), // Comma-separated tags
        search: Joi.string().max(100),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0),
        sort: Joi.string().valid('created_at', 'updated_at', 'title').default('updated_at'),
        order: Joi.string().valid('asc', 'desc').default('desc'),
        archived: Joi.boolean().default(false)
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    req.query = value;
    next();
};

// Workflow validation
const validateWorkflow = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().min(1).max(500).trim().required(),
        description: Joi.string().max(10000).trim().allow(''),
        category: Joi.string().max(50).default('general'),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
        tags: Joi.array().items(Joi.string().min(1).max(50).trim()).max(20).default([]),
        due_date: Joi.date().iso().allow(null),
        steps: Joi.array().items(
            Joi.object({
                title: Joi.string().min(1).max(500).trim().required(),
                description: Joi.string().max(5000).trim().allow(''),
                due_date: Joi.date().iso().allow(null),
                assignee: Joi.string().max(255).trim().allow('')
            })
        ).max(50).default([])
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    // Clean up tags
    req.body = {
        ...value,
        tags: [...new Set(value.tags.filter(tag => tag && tag.trim()))].slice(0, 20)
    };

    next();
};

// Workflow update validation (all fields optional)
const validateWorkflowUpdate = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().min(1).max(500).trim(),
        description: Joi.string().max(10000).trim().allow(''),
        category: Joi.string().max(50),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
        status: Joi.string().valid('draft', 'active', 'completed', 'archived'),
        tags: Joi.array().items(Joi.string().min(1).max(50).trim()).max(20),
        due_date: Joi.date().iso().allow(null)
    }).min(1); // At least one field must be present

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    // Clean up tags if provided
    if (value.tags) {
        req.body.tags = [...new Set(value.tags.filter(tag => tag && tag.trim()))].slice(0, 20);
    }

    next();
};

// Workflow step validation
const validateWorkflowStep = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().min(1).max(500).trim().required(),
        description: Joi.string().max(5000).trim().allow(''),
        step_order: Joi.number().integer().min(0).default(0),
        due_date: Joi.date().iso().allow(null),
        assignee: Joi.string().max(255).trim().allow('')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    req.body = value;
    next();
};

// Query parameters validation for workflows list
const validateWorkflowsQuery = (req, res, next) => {
    const schema = Joi.object({
        category: Joi.string().max(50),
        tags: Joi.string(), // Comma-separated tags
        search: Joi.string().max(100),
        status: Joi.string().valid('draft', 'active', 'completed', 'archived'),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0),
        sort: Joi.string().valid('created_at', 'updated_at', 'title', 'due_date', 'priority', 'status').default('updated_at'),
        order: Joi.string().valid('asc', 'desc').default('desc')
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    req.query = value;
    next();
};

module.exports = {
    validateRegistration,
    validateLogin,
    validateNote,
    validateNoteUpdate,
    validateNotesQuery,
    validateWorkflow,
    validateWorkflowUpdate,
    validateWorkflowStep,
    validateWorkflowsQuery
};