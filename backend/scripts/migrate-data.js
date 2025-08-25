const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

// Migration script to import data from localStorage format
const migrateLocalStorageData = async (userData) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log('🔄 Starting data migration...');
        
        // 1. Create or find user
        let userId;
        if (userData.user) {
            console.log(`👤 Migrating user: ${userData.user.name}`);
            
            // Check if user already exists
            const existingUser = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [userData.user.email]
            );
            
            if (existingUser.rows.length > 0) {
                userId = existingUser.rows[0].id;
                console.log(`   ✅ User exists, using ID: ${userId}`);
            } else {
                // Create new user
                const passwordHash = await bcrypt.hash(userData.user.password || 'defaultpassword', 12);
                const newUser = await client.query(
                    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
                    [userData.user.name, userData.user.email, passwordHash]
                );
                userId = newUser.rows[0].id;
                console.log(`   ✅ User created with ID: ${userId}`);
            }
        } else {
            throw new Error('User data is required for migration');
        }
        
        // 2. Migrate notes
        if (userData.notes && userData.notes.length > 0) {
            console.log(`📝 Migrating ${userData.notes.length} notes...`);
            
            let migratedCount = 0;
            let skippedCount = 0;
            
            for (const note of userData.notes) {
                try {
                    // Validate note data
                    if (!note.title || !note.content || !note.category) {
                        console.log(`   ⚠️  Skipping invalid note: ${note.title || 'Untitled'}`);
                        skippedCount++;
                        continue;
                    }
                    
                    // Ensure category is valid
                    const validCategories = ['ideas', 'projects', 'learning', 'resources'];
                    const category = validCategories.includes(note.category) ? note.category : 'ideas';
                    
                    // Clean up tags
                    const tags = Array.isArray(note.tags) ? note.tags.filter(tag => tag && tag.trim()) : [];
                    
                    // Insert note
                    await client.query(`
                        INSERT INTO notes (user_id, title, content, category, tags, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        userId,
                        note.title.trim(),
                        note.content.trim(),
                        category,
                        tags,
                        note.createdAt || new Date().toISOString(),
                        note.updatedAt || new Date().toISOString()
                    ]);
                    
                    migratedCount++;
                    
                } catch (noteError) {
                    console.error(`   ❌ Failed to migrate note "${note.title}":`, noteError.message);
                    skippedCount++;
                }
            }
            
            console.log(`   ✅ Successfully migrated: ${migratedCount} notes`);
            if (skippedCount > 0) {
                console.log(`   ⚠️  Skipped: ${skippedCount} notes`);
            }
        }
        
        await client.query('COMMIT');
        console.log('🎉 Migration completed successfully!');
        
        // Show summary
        const stats = await client.query(`
            SELECT 
                COUNT(*) as total_notes,
                COUNT(CASE WHEN category = 'ideas' THEN 1 END) as ideas,
                COUNT(CASE WHEN category = 'projects' THEN 1 END) as projects,
                COUNT(CASE WHEN category = 'learning' THEN 1 END) as learning,
                COUNT(CASE WHEN category = 'resources' THEN 1 END) as resources
            FROM notes WHERE user_id = $1
        `, [userId]);
        
        console.log('\n📊 Migration Summary:');
        console.log(`   👤 User ID: ${userId}`);
        console.log(`   📝 Total Notes: ${stats.rows[0].total_notes}`);
        console.log(`   💡 Ideas: ${stats.rows[0].ideas}`);
        console.log(`   🚀 Projects: ${stats.rows[0].projects}`);
        console.log(`   📚 Learning: ${stats.rows[0].learning}`);
        console.log(`   🔖 Resources: ${stats.rows[0].resources}`);
        
        return {
            success: true,
            userId,
            notesCount: parseInt(stats.rows[0].total_notes)
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

// Example usage function
const exampleMigration = async () => {
    // Example data structure from localStorage
    const exampleData = {
        user: {
            name: 'Demo User',
            email: 'demo@knowledgehub.com'
        },
        notes: [
            {
                title: 'Welcome to KnowledgeHub',
                content: 'This is your personal knowledge management system.',
                category: 'ideas',
                tags: ['welcome', 'getting-started'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    };
    
    try {
        const result = await migrateLocalStorageData(exampleData);
        console.log('Migration result:', result);
    } catch (error) {
        console.error('Migration failed:', error);
    }
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('📚 KnowledgeHub Data Migration Tool');
        console.log('\nUsage:');
        console.log('  npm run migrate                    # Run example migration');
        console.log('  node scripts/migrate-data.js help  # Show this help');
        console.log('\nFor custom migration, modify the exampleData object in this file.');
        return;
    }
    
    if (args[0] === 'help') {
        console.log('📚 KnowledgeHub Data Migration Tool');
        console.log('\nThis script helps migrate data from localStorage to PostgreSQL.');
        console.log('\nData format expected:');
        console.log(JSON.stringify({
            user: {
                name: 'Your Name',
                email: 'your@email.com'
            },
            notes: [
                {
                    title: 'Note Title',
                    content: 'Note content...',
                    category: 'ideas', // ideas, projects, learning, resources
                    tags: ['tag1', 'tag2'],
                    createdAt: '2023-...',
                    updatedAt: '2023-...'
                }
            ]
        }, null, 2));
        return;
    }
    
    // Run example migration
    exampleMigration().then(() => {
        process.exit(0);
    }).catch(() => {
        process.exit(1);
    });
}

module.exports = migrateLocalStorageData;