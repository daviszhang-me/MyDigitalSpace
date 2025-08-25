const { initDatabase, getDb } = require('../config/database-sqlite');

async function removeCategoryConstraint() {
    console.log('🔄 Removing category CHECK constraint from notes table...');
    
    try {
        // Initialize database connection
        await initDatabase();
        const db = getDb();
        
        // SQLite doesn't support dropping constraints directly
        // We need to recreate the table without the constraint
        
        // First, create a backup table with the same structure but without the constraint
        await db.exec(`
            -- Create new notes table without the constraint
            CREATE TABLE notes_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT DEFAULT '[]',
                source_url TEXT,
                source_type TEXT,
                source_title TEXT,
                is_archived BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            
            -- Copy all data from the old table to the new table
            INSERT INTO notes_new (id, user_id, title, content, category, tags, source_url, source_type, source_title, is_archived, created_at, updated_at)
            SELECT id, user_id, title, content, category, tags, source_url, source_type, source_title, is_archived, created_at, updated_at
            FROM notes;
            
            -- Drop the old table
            DROP TABLE notes;
            
            -- Rename the new table to the original name
            ALTER TABLE notes_new RENAME TO notes;
            
            -- Recreate the indexes
            CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
            CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
            CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
            CREATE INDEX IF NOT EXISTS idx_notes_source_url ON notes(source_url);
        `);
        
        console.log('✅ Category CHECK constraint removed successfully!');
        
        // Verify the change
        const tableInfo = await db.all("PRAGMA table_info(notes)");
        console.log('📋 Updated notes table structure:');
        tableInfo.forEach(col => {
            console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? 'DEFAULT ' + col.dflt_value : ''}`);
        });
        
        // Count notes to verify data was preserved
        const noteCount = await db.get("SELECT COUNT(*) as count FROM notes");
        console.log(`📊 Notes preserved: ${noteCount.count}`);
        
    } catch (error) {
        console.error('❌ Failed to remove category constraint:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run migration
removeCategoryConstraint();