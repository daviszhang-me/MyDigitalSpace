const express = require('express');
const Parser = require('rss-parser');
const axios = require('axios');
const { query } = require('../config/database-sqlite');
// Auth middleware (same as in server.js)
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
const Joi = require('joi');

const router = express.Router();
const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'KnowledgeHub RSS Reader 1.0'
    }
});

// Validation schemas
const rssSourceSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    url: Joi.string().uri().required(),
    category: Joi.string().valid('ideas', 'projects', 'learning', 'resources').required()
});

// GET /api/content/rss-sources - Get user's RSS sources
router.get('/rss-sources', verifyToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM rss_sources WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );

        res.json({
            success: true,
            data: { sources: result.rows }
        });
    } catch (error) {
        console.error('Error fetching RSS sources:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch RSS sources'
        });
    }
});

// POST /api/content/rss-sources - Add new RSS source
router.post('/rss-sources', verifyToken, async (req, res) => {
    try {
        const { error, value } = rssSourceSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { name, url, category } = value;

        // Test the RSS feed first
        try {
            await parser.parseURL(url);
        } catch (rssError) {
            return res.status(400).json({
                success: false,
                message: 'Invalid RSS feed URL or feed is not accessible'
            });
        }

        const result = await query(`
            INSERT INTO rss_sources (user_id, name, url, category)
            VALUES (?, ?, ?, ?)
        `, [req.user.id, name, url, category]);

        res.json({
            success: true,
            data: {
                id: result.rows[0].id,
                message: 'RSS source added successfully'
            }
        });
    } catch (error) {
        console.error('Error adding RSS source:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add RSS source'
        });
    }
});

// POST /api/content/fetch-rss/:id - Fetch content from specific RSS source
router.post('/fetch-rss/:id', verifyToken, async (req, res) => {
    try {
        const sourceId = req.params.id;
        const limit = parseInt(req.query.limit) || 10; // Default to 10, allow customization

        // Get the RSS source
        const sourceResult = await query(
            'SELECT * FROM rss_sources WHERE id = ? AND user_id = ? AND is_active = 1',
            [sourceId, req.user.id]
        );

        if (sourceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'RSS source not found'
            });
        }

        const source = sourceResult.rows[0];

        // Parse the RSS feed
        const feed = await parser.parseURL(source.url);
        const articles = feed.items.slice(0, Math.min(limit, 50)); // Limit to max 50 articles
        let importedCount = 0;

        // Import articles as notes
        for (const article of articles) {
            const title = article.title || 'Untitled Article';
            const content = `${article.contentSnippet || article.content || 'No content available'}\n\n---\nSource: ${article.link || source.url}`;
            const tags = JSON.stringify(['rss-import', source.name.toLowerCase().replace(/\s+/g, '-')]);

            // Check if article already exists (by URL)
            const existingResult = await query(
                'SELECT id FROM notes WHERE user_id = ? AND source_url = ?',
                [req.user.id, article.link]
            );

            if (existingResult.rows.length === 0) {
                await query(`
                    INSERT INTO notes (user_id, title, content, category, tags, source_url, source_type, source_title)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [req.user.id, title, content, source.category, tags, article.link, 'rss', source.name]);
                importedCount++;
            }
        }

        // Update last fetched time
        await query(
            'UPDATE rss_sources SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?',
            [sourceId]
        );

        res.json({
            success: true,
            data: {
                imported: importedCount,
                total: articles.length,
                message: `Imported ${importedCount} new articles from ${source.name}`
            }
        });
    } catch (error) {
        console.error('Error fetching RSS:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch RSS content'
        });
    }
});

// POST /api/content/quick-capture - Quick capture from external URL
router.post('/quick-capture', verifyToken, async (req, res) => {
    try {
        const schema = Joi.object({
            url: Joi.string().uri().required(),
            title: Joi.string().min(1).max(200),
            content: Joi.string().max(10000),
            category: Joi.string().valid('ideas', 'projects', 'learning', 'resources').required(),
            tags: Joi.array().items(Joi.string().max(50)).default([])
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { url, title, content, category, tags } = value;

        // If no title/content provided, try to fetch basic info
        let finalTitle = title;
        let finalContent = content;

        if (!title || !content) {
            try {
                const response = await axios.get(url, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'KnowledgeHub Content Capture 1.0'
                    }
                });

                const html = response.data;
                
                // Extract title if not provided
                if (!finalTitle) {
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    finalTitle = titleMatch ? titleMatch[1].trim() : 'Captured Article';
                }

                // Extract description if no content provided
                if (!finalContent) {
                    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i) ||
                                     html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
                    finalContent = descMatch ? descMatch[1].trim() : 'Content captured from external source.';
                }
            } catch (fetchError) {
                console.log('Could not fetch URL metadata:', fetchError.message);
                finalTitle = finalTitle || 'Captured Article';
                finalContent = finalContent || 'Content captured from external source.';
            }
        }

        const finalTags = JSON.stringify([...tags, 'quick-capture']);

        const result = await query(`
            INSERT INTO notes (user_id, title, content, category, tags, source_url, source_type, source_title)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.user.id, finalTitle, finalContent, category, finalTags, url, 'quick-capture', 'External Link']);

        res.json({
            success: true,
            data: {
                id: result.rows[0].id,
                message: 'Content captured successfully'
            }
        });
    } catch (error) {
        console.error('Error in quick capture:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to capture content'
        });
    }
});

// DELETE /api/content/rss-sources/:id - Delete RSS source
router.delete('/rss-sources/:id', verifyToken, async (req, res) => {
    try {
        const sourceId = req.params.id;

        const result = await query(
            'DELETE FROM rss_sources WHERE id = ? AND user_id = ?',
            [sourceId, req.user.id]
        );

        if (result.rows[0].changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'RSS source not found'
            });
        }

        res.json({
            success: true,
            data: { message: 'RSS source deleted successfully' }
        });
    } catch (error) {
        console.error('Error deleting RSS source:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete RSS source'
        });
    }
});

// GET /api/content/categories - Get available categories
router.get('/categories', verifyToken, async (req, res) => {
    try {
        // Get all categories currently in use from notes
        const notesResult = await query(
            'SELECT DISTINCT category FROM notes WHERE user_id = ? ORDER BY category',
            [req.user.id]
        );

        // Get custom categories from user_categories table
        const customResult = await query(
            'SELECT name, display_name, description FROM user_categories WHERE user_id = ? AND is_active = 1 ORDER BY name',
            [req.user.id]
        );

        const predefinedCategories = ['ideas', 'projects', 'learning', 'resources'];
        const noteCategories = notesResult.rows.map(row => row.category);
        const customCategories = customResult.rows || [];
        
        // Combine all categories from notes and custom categories, remove duplicates
        const allCategoryNames = [...new Set([
            ...predefinedCategories, 
            ...noteCategories,
            ...customCategories.map(cat => cat.name)
        ])];

        res.json({
            success: true,
            data: { 
                categories: allCategoryNames,
                predefined: predefinedCategories,
                custom: customCategories,
                fromNotes: noteCategories.filter(cat => !predefinedCategories.includes(cat))
            }
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// POST /api/content/categories - Create a new custom category
router.post('/categories', verifyToken, async (req, res) => {
    try {
        const schema = Joi.object({
            name: Joi.string().min(1).max(50).pattern(/^[a-z0-9-]+$/).required(),
            displayName: Joi.string().min(1).max(100).required(),
            description: Joi.string().max(255).optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { name, displayName, description } = value;

        // Check if category already exists for this user
        const existingResult = await query(
            'SELECT id FROM user_categories WHERE user_id = ? AND name = ?',
            [req.user.id, name]
        );

        if (existingResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Category already exists'
            });
        }

        // Create the category
        const result = await query(`
            INSERT INTO user_categories (user_id, name, display_name, description)
            VALUES (?, ?, ?, ?)
        `, [req.user.id, name, displayName, description || null]);

        res.json({
            success: true,
            data: {
                id: result.rows[0].id,
                name,
                displayName,
                description,
                message: 'Category created successfully'
            }
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create category'
        });
    }
});

// PUT /api/content/categories/bulk-update - Update categories for multiple notes
router.put('/categories/bulk-update', verifyToken, async (req, res) => {
    try {
        console.log('Bulk update request:', req.body);
        
        const schema = Joi.object({
            noteIds: Joi.array().items(Joi.number()).required(),
            newCategory: Joi.string().min(1).max(50).required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            console.error('Bulk update validation error:', error.details[0].message);
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { noteIds, newCategory } = value;
        console.log('Processing bulk update:', { noteIds, newCategory, userId: req.user.id });

        // Update multiple notes
        const placeholders = noteIds.map(() => '?').join(',');
        const result = await query(`
            UPDATE notes 
            SET category = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id IN (${placeholders}) AND user_id = ?
        `, [newCategory, ...noteIds, req.user.id]);

        console.log('Bulk update completed successfully:', result.rows[0].changes, 'notes updated');
        
        res.json({
            success: true,
            data: {
                updatedCount: result.rows[0].changes,
                message: `Updated ${result.rows[0].changes} notes to category: ${newCategory}`
            }
        });
    } catch (error) {
        console.error('Error updating categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update categories'
        });
    }
});

// PUT /api/content/categories/:name - Update a category
router.put('/categories/:name', verifyToken, async (req, res) => {
    try {
        const categoryName = req.params.name;
        const schema = Joi.object({
            displayName: Joi.string().min(1).max(100).required(),
            description: Joi.string().max(255).allow('', null).optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { displayName, description } = value;

        // Update the category
        const result = await query(`
            UPDATE user_categories 
            SET display_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND name = ?
        `, [displayName, description || null, req.user.id, categoryName]);

        if (result.rows[0].changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            data: {
                name: categoryName,
                displayName,
                description,
                message: 'Category updated successfully'
            }
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update category'
        });
    }
});

// DELETE /api/content/categories/:name - Delete a custom category
router.delete('/categories/:name', verifyToken, async (req, res) => {
    try {
        const categoryName = req.params.name;

        // Don't allow deletion of predefined categories
        const predefinedCategories = ['ideas', 'projects', 'learning', 'resources'];
        if (predefinedCategories.includes(categoryName)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete predefined categories'
            });
        }

        // Check if category has notes
        const notesResult = await query(
            'SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND category = ?',
            [req.user.id, categoryName]
        );

        const notesCount = notesResult.rows[0].count;
        if (notesCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category. ${notesCount} notes are using this category. Please move or delete those notes first.`
            });
        }

        // Delete the category
        const result = await query(
            'DELETE FROM user_categories WHERE user_id = ? AND name = ?',
            [req.user.id, categoryName]
        );

        if (result.rows[0].changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Category deleted successfully'
            }
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete category'
        });
    }
});

// GET /api/content/templates - Get content templates
router.get('/templates', verifyToken, (req, res) => {
    const templates = {
        'tech-article': {
            title: '[Tech] {title}',
            content: `## Summary\n{summary}\n\n## Key Points\n- \n- \n- \n\n## My Notes\n{notes}\n\n## Action Items\n- [ ] \n- [ ] \n\n---\nSource: {url}`,
            tags: ['technology', 'article'],
            category: 'learning'
        },
        'research-paper': {
            title: '[Research] {title}',
            content: `## Abstract\n{abstract}\n\n## Key Findings\n{findings}\n\n## Methodology\n{methodology}\n\n## Relevance to My Work\n{relevance}\n\n## Follow-up Questions\n{questions}\n\n---\nSource: {url}\nAuthors: {authors}`,
            tags: ['research', 'paper'],
            category: 'learning'
        },
        'tool-review': {
            title: '[Tool] {tool-name}',
            content: `## Overview\n{overview}\n\n## Features\n{features}\n\n## Pros\n{pros}\n\n## Cons\n{cons}\n\n## Use Cases\n{use-cases}\n\n## My Rating\n{rating}/10\n\n---\nSource: {url}`,
            tags: ['tools', 'review'],
            category: 'resources'
        },
        'industry-news': {
            title: '[News] {headline}',
            content: `## Summary\n{summary}\n\n## Impact Analysis\n{impact}\n\n## My Thoughts\n{thoughts}\n\n## Related Trends\n{trends}\n\n---\nSource: {url}\nDate: {date}`,
            tags: ['news', 'industry'],
            category: 'ideas'
        }
    };

    res.json({
        success: true,
        data: { templates }
    });
});

module.exports = router;