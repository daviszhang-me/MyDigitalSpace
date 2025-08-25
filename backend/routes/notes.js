const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateNote, validateNoteUpdate, validateNotesQuery } = require('../middleware/validation');
const router = express.Router();

// Get all notes for authenticated user
router.get('/', authenticateToken, validateNotesQuery, async (req, res) => {
    const { category, tags, search, limit, offset, sort, order, archived } = req.query;
    const userId = req.user.id;

    try {
        let query = 'SELECT * FROM notes WHERE user_id = $1 AND is_archived = $2';
        let params = [userId, archived];
        let paramCount = 2;

        // Add category filter
        if (category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            params.push(category);
        }

        // Add tags filter
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagArray.length > 0) {
                paramCount++;
                query += ` AND tags && $${paramCount}`;
                params.push(tagArray);
            }
        }

        // Add search filter
        if (search) {
            paramCount++;
            query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // Add sorting
        query += ` ORDER BY ${sort} ${order.toUpperCase()}`;

        // Add pagination
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(limit);

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);

        const result = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM notes WHERE user_id = $1 AND is_archived = $2';
        let countParams = [userId, archived];
        let countParamCount = 2;

        if (category) {
            countParamCount++;
            countQuery += ` AND category = $${countParamCount}`;
            countParams.push(category);
        }

        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagArray.length > 0) {
                countParamCount++;
                countQuery += ` AND tags && $${countParamCount}`;
                countParams.push(tagArray);
            }
        }

        if (search) {
            countParamCount++;
            countQuery += ` AND (title ILIKE $${countParamCount} OR content ILIKE $${countParamCount})`;
            countParams.push(`%${search}%`);
        }

        const countResult = await pool.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                notes: result.rows,
                pagination: {
                    total: totalCount,
                    limit: limit,
                    offset: offset,
                    hasMore: offset + limit < totalCount
                }
            }
        });

    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notes'
        });
    }
});

// Get a single note by ID
router.get('/:id', authenticateToken, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        res.json({
            success: true,
            data: {
                note: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch note'
        });
    }
});

// Create a new note
router.post('/', authenticateToken, validateNote, async (req, res) => {
    const { title, content, category, tags } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'INSERT INTO notes (user_id, title, content, category, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, title, content, category, tags]
        );

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: {
                note: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create note'
        });
    }
});

// Update a note
router.put('/:id', authenticateToken, validateNoteUpdate, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;
    const updates = req.body;

    try {
        // Check if note exists and belongs to user
        const existingNote = await pool.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );

        if (existingNote.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 0;

        Object.keys(updates).forEach(key => {
            paramCount++;
            updateFields.push(`${key} = $${paramCount}`);
            updateValues.push(updates[key]);
        });

        // Add updated_at timestamp
        paramCount++;
        updateFields.push(`updated_at = $${paramCount}`);
        updateValues.push(new Date());

        // Add WHERE conditions
        paramCount++;
        updateValues.push(noteId);
        paramCount++;
        updateValues.push(userId);

        const query = `
            UPDATE notes 
            SET ${updateFields.join(', ')} 
            WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, updateValues);

        res.json({
            success: true,
            message: 'Note updated successfully',
            data: {
                note: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update note'
        });
    }
});

// Delete a note
router.delete('/:id', authenticateToken, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
            [noteId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        res.json({
            success: true,
            message: 'Note deleted successfully',
            data: {
                deletedNoteId: result.rows[0].id
            }
        });

    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete note'
        });
    }
});

// Get user statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_notes,
                COUNT(CASE WHEN category = 'ideas' THEN 1 END) as ideas_count,
                COUNT(CASE WHEN category = 'projects' THEN 1 END) as projects_count,
                COUNT(CASE WHEN category = 'learning' THEN 1 END) as learning_count,
                COUNT(CASE WHEN category = 'resources' THEN 1 END) as resources_count,
                COUNT(DISTINCT unnest(tags)) as unique_tags_count,
                MAX(updated_at) as last_note_update
            FROM notes 
            WHERE user_id = $1 AND is_archived = false
        `, [userId]);

        // Get all unique tags
        const tagsResult = await pool.query(`
            SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count
            FROM notes 
            WHERE user_id = $1 AND is_archived = false
            GROUP BY tag
            ORDER BY count DESC, tag ASC
            LIMIT 50
        `, [userId]);

        res.json({
            success: true,
            data: {
                stats: result.rows[0],
                tags: tagsResult.rows
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// Duplicate a note
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
    const noteId = req.params.id;
    const userId = req.user.id;

    try {
        // Get original note
        const originalNote = await pool.query(
            'SELECT title, content, category, tags FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, userId]
        );

        if (originalNote.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const original = originalNote.rows[0];
        
        // Create duplicate with "(Copy)" suffix
        const duplicateTitle = `${original.title} (Copy)`;

        const result = await pool.query(
            'INSERT INTO notes (user_id, title, content, category, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, duplicateTitle, original.content, original.category, original.tags]
        );

        res.status(201).json({
            success: true,
            message: 'Note duplicated successfully',
            data: {
                note: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Duplicate note error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to duplicate note'
        });
    }
});

module.exports = router;