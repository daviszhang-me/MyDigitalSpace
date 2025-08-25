const { initDatabase, getDb } = require('../config/database-sqlite');

async function createUserCategoriesTable() {
    console.log('🔄 Creating user_categories table...');
    
    try {
        // Initialize database connection
        await initDatabase();
        const db = getDb();
        
        // Create user_categories table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS user_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_categories_name ON user_categories(user_id, name);
        `);
        
        console.log('✅ user_categories table created successfully!');
        
        // Verify the table
        const tableInfo = await db.all("PRAGMA table_info(user_categories)");
        console.log('📋 Table structure:', tableInfo.map(col => col.name));
        
    } catch (error) {
        console.error('❌ Failed to create user_categories table:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run migration
createUserCategoriesTable();