const { initDatabase, getDb } = require('../config/database-sqlite');

async function migrateSchema() {
    console.log('🔄 Starting database schema migration...');
    
    try {
        // Initialize database connection
        await initDatabase();
        const db = getDb();
        
        // Check if columns exist
        const tableInfo = await db.all("PRAGMA table_info(notes)");
        const columnNames = tableInfo.map(col => col.name);
        
        console.log('📋 Current columns:', columnNames);
        
        const columnsToAdd = [
            { name: 'source_url', definition: 'TEXT' },
            { name: 'source_type', definition: 'TEXT' },
            { name: 'source_title', definition: 'TEXT' }
        ];
        
        for (const column of columnsToAdd) {
            if (!columnNames.includes(column.name)) {
                console.log(`➕ Adding column: ${column.name}`);
                await db.exec(`ALTER TABLE notes ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`✅ Added column: ${column.name}`);
            } else {
                console.log(`⏭️  Column ${column.name} already exists`);
            }
        }
        
        // Verify the changes
        const updatedTableInfo = await db.all("PRAGMA table_info(notes)");
        console.log('📋 Updated columns:', updatedTableInfo.map(col => col.name));
        
        console.log('✅ Database schema migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run migration
migrateSchema();