const express = require('express');
const { query } = require('../config/database-sqlite');
const { authenticateToken } = require('../middleware/auth');
const { validateWorkflow, validateWorkflowUpdate, validateWorkflowStep, validateWorkflowsQuery } = require('../middleware/validation');
const router = express.Router();

// Get all workflows for authenticated user
router.get('/', authenticateToken, validateWorkflowsQuery, async (req, res) => {
    const { category, tags, search, limit, offset, sort, order, status, priority } = req.query;
    const userId = req.user.id;

    try {
        let queryStr = 'SELECT * FROM workflows WHERE user_id = $1';
        let params = [userId];
        let paramCount = 1;

        // Add status filter
        if (status) {
            paramCount++;
            queryStr += ` AND status = $${paramCount}`;
            params.push(status);
        }

        // Add priority filter
        if (priority) {
            paramCount++;
            queryStr += ` AND priority = $${paramCount}`;
            params.push(priority);
        }

        // Add category filter
        if (category) {
            paramCount++;
            queryStr += ` AND category = $${paramCount}`;
            params.push(category);
        }

        // Add tags filter
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagArray.length > 0) {
                paramCount++;
                queryStr += ` AND tags && $${paramCount}`;
                params.push(tagArray);
            }
        }

        // Add search filter
        if (search) {
            paramCount++;
            queryStr += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // Add sorting
        queryStr += ` ORDER BY ${sort} ${order.toUpperCase()}`;

        // Add pagination
        paramCount++;
        queryStr += ` LIMIT $${paramCount}`;
        params.push(limit);

        paramCount++;
        queryStr += ` OFFSET $${paramCount}`;
        params.push(offset);

        const result = await query(queryStr, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM workflows WHERE user_id = $1';
        let countParams = [userId];

        if (status) {
            countQuery += ` AND status = $2`;
            countParams.push(status);
        }
        if (priority) {
            countQuery += ` AND priority = $${countParams.length + 1}`;
            countParams.push(priority);
        }
        if (category) {
            countQuery += ` AND category = $${countParams.length + 1}`;
            countParams.push(category);
        }

        const countResult = await query(countQuery, countParams);

        res.json({
            success: true,
            data: {
                workflows: result.rows,
                total: parseInt(countResult.rows[0].count),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workflows'
        });
    }
});

// Get workflow by ID with steps
router.get('/:id', authenticateToken, async (req, res) => {
    const workflowId = req.params.id;
    const userId = req.user.id;

    try {
        // Get workflow
        const workflowResult = await query(
            'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
            [workflowId, userId]
        );

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        // Get workflow steps
        const stepsResult = await query(
            'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC',
            [workflowId]
        );

        // Get attachments
        const attachmentsResult = await query(
            'SELECT * FROM workflow_attachments WHERE workflow_id = $1',
            [workflowId]
        );

        const workflow = workflowResult.rows[0];
        workflow.steps = stepsResult.rows;
        workflow.attachments = attachmentsResult.rows;

        res.json({
            success: true,
            data: { workflow }
        });
    } catch (error) {
        console.error('Error fetching workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workflow'
        });
    }
});

// Create new workflow
router.post('/', authenticateToken, validateWorkflow, async (req, res) => {
    const { title, description, category, priority, tags, due_date, steps } = req.body;
    const userId = req.user.id;

    try {
        // Start transaction
        await query('BEGIN');

        // Create workflow
        const workflowResult = await query(
            `INSERT INTO workflows (user_id, title, description, category, priority, tags, due_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
             RETURNING *`,
            [userId, title, description, category, priority, tags || [], due_date]
        );

        const workflow = workflowResult.rows[0];

        // Create steps if provided
        if (steps && Array.isArray(steps) && steps.length > 0) {
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                await query(
                    `INSERT INTO workflow_steps (workflow_id, title, description, step_order, due_date, assignee)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [workflow.id, step.title, step.description || null, i, step.due_date || null, step.assignee || null]
                );
            }
        }

        await query('COMMIT');

        // Fetch complete workflow with steps
        const completeWorkflowResult = await query(
            'SELECT * FROM workflows WHERE id = $1',
            [workflow.id]
        );

        const stepsResult = await query(
            'SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC',
            [workflow.id]
        );

        const completeWorkflow = completeWorkflowResult.rows[0];
        completeWorkflow.steps = stepsResult.rows;

        res.status(201).json({
            success: true,
            data: { workflow: completeWorkflow }
        });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Error creating workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workflow'
        });
    }
});

// Update workflow
router.put('/:id', authenticateToken, validateWorkflowUpdate, async (req, res) => {
    const workflowId = req.params.id;
    const userId = req.user.id;
    const { title, description, category, priority, tags, due_date, status } = req.body;

    try {
        // Check if workflow exists and belongs to user
        const existingResult = await query(
            'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
            [workflowId, userId]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        // Update workflow
        const completedAt = status === 'completed' ? new Date() : null;
        const result = await query(
            `UPDATE workflows 
             SET title = $3, description = $4, category = $5, priority = $6, 
                 tags = $7, due_date = $8, status = $9, completed_at = $10,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [workflowId, userId, title, description, category, priority, tags || [], due_date, status, completedAt]
        );

        res.json({
            success: true,
            data: { workflow: result.rows[0] }
        });
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update workflow'
        });
    }
});

// Delete workflow
router.delete('/:id', authenticateToken, async (req, res) => {
    const workflowId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await query(
            'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING id',
            [workflowId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        res.json({
            success: true,
            data: { id: workflowId }
        });
    } catch (error) {
        console.error('Error deleting workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete workflow'
        });
    }
});

// Workflow steps routes

// Create step
router.post('/:id/steps', authenticateToken, validateWorkflowStep, async (req, res) => {
    const workflowId = req.params.id;
    const userId = req.user.id;
    const { title, description, step_order, due_date, assignee } = req.body;

    try {
        // Verify workflow ownership
        const workflowResult = await query(
            'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
            [workflowId, userId]
        );

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        // Create step
        const result = await query(
            `INSERT INTO workflow_steps (workflow_id, title, description, step_order, due_date, assignee)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [workflowId, title, description, step_order || 0, due_date, assignee]
        );

        res.status(201).json({
            success: true,
            data: { step: result.rows[0] }
        });
    } catch (error) {
        console.error('Error creating workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workflow step'
        });
    }
});

// Update step
router.put('/:id/steps/:stepId', authenticateToken, async (req, res) => {
    const workflowId = req.params.id;
    const stepId = req.params.stepId;
    const userId = req.user.id;
    const { title, description, status, due_date, assignee, notes } = req.body;

    try {
        // Verify workflow ownership
        const workflowResult = await query(
            'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
            [workflowId, userId]
        );

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        // Update step
        const completedAt = status === 'completed' ? new Date() : null;
        const result = await query(
            `UPDATE workflow_steps 
             SET title = $3, description = $4, status = $5, due_date = $6, 
                 assignee = $7, notes = $8, completed_at = $9,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND workflow_id = $2
             RETURNING *`,
            [stepId, workflowId, title, description, status, due_date, assignee, notes, completedAt]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Step not found'
            });
        }

        res.json({
            success: true,
            data: { step: result.rows[0] }
        });
    } catch (error) {
        console.error('Error updating workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update workflow step'
        });
    }
});

// Delete step
router.delete('/:id/steps/:stepId', authenticateToken, async (req, res) => {
    const workflowId = req.params.id;
    const stepId = req.params.stepId;
    const userId = req.user.id;

    try {
        // Verify workflow ownership
        const workflowResult = await query(
            'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
            [workflowId, userId]
        );

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        // Delete step
        const result = await query(
            'DELETE FROM workflow_steps WHERE id = $1 AND workflow_id = $2 RETURNING id',
            [stepId, workflowId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Step not found'
            });
        }

        res.json({
            success: true,
            data: { id: stepId }
        });
    } catch (error) {
        console.error('Error deleting workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete workflow step'
        });
    }
});

// Get workflow statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await query(`
            SELECT 
                COUNT(*) as total_workflows,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_workflows,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_workflows,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_workflows,
                COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_workflows,
                COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_workflows,
                COUNT(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP AND status != 'completed' THEN 1 END) as overdue_workflows
            FROM workflows 
            WHERE user_id = $1 AND status != 'archived'
        `, [userId]);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching workflow stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workflow statistics'
        });
    }
});

// Attach note to workflow
router.post('/:id/attachments', authenticateToken, async (req, res) => {
    const workflowId = req.params.id;
    const userId = req.user.id;
    const { attachment_type, attachment_id, url, title, description } = req.body;

    try {
        // Verify workflow ownership
        const workflowResult = await query(
            'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
            [workflowId, userId]
        );

        if (workflowResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }

        // Create attachment
        const result = await query(
            `INSERT INTO workflow_attachments (workflow_id, attachment_type, attachment_id, url, title, description)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [workflowId, attachment_type, attachment_id, url, title, description]
        );

        res.status(201).json({
            success: true,
            data: { attachment: result.rows[0] }
        });
    } catch (error) {
        console.error('Error creating workflow attachment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workflow attachment'
        });
    }
});

module.exports = router;