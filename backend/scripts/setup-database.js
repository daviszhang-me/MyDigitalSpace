const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const setupDatabase = async () => {
    try {
        console.log('🗄️  Setting up KnowledgeHub database...');
        
        // Read schema file
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema
        await pool.query(schema);
        
        console.log('✅ Database schema created successfully!');
        console.log('📋 Tables created:');
        console.log('   - users (user accounts)');
        console.log('   - notes (knowledge entries)');
        console.log('   - user_sessions (session management)');
        console.log('   - user_note_stats (statistics view)');
        
        // Test the setup by running a simple query
        const result = await pool.query(`
            SELECT 
                table_name, 
                column_name, 
                data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'notes', 'user_sessions')
            ORDER BY table_name, ordinal_position
        `);
        
        console.log('🔍 Database structure verified:');
        let currentTable = '';
        result.rows.forEach(row => {
            if (row.table_name !== currentTable) {
                currentTable = row.table_name;
                console.log(`\n   📋 ${row.table_name}:`);
            }
            console.log(`      - ${row.column_name} (${row.data_type})`);
        });
        
        console.log('\n🎉 Database setup complete!');
        console.log('💡 You can now start the API server with: npm run dev');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Make sure PostgreSQL is running');
        console.error('   2. Check your DATABASE_URL in .env file');
        console.error('   3. Ensure the database exists');
        console.error('   4. Verify user permissions');
        process.exit(1);
    } finally {
        await pool.end();
    }
};

// Run setup if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;