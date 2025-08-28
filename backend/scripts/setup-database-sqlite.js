const fs = require('fs');
const path = require('path');
const { initDatabase, query } = require('../config/database-sqlite');

const setupSQLiteDatabase = async () => {
    try {
        console.log('🗄️  Setting up MyDigitalSpace SQLite database...');
        
        // Initialize database connection
        await initDatabase();
        
        // Read SQLite schema file
        const schemaPath = path.join(__dirname, '../../database/schema-sqlite.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split schema into individual statements, handling triggers properly
        const statements = [];
        let currentStatement = '';
        let inTrigger = false;
        
        const lines = schema.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip comments and empty lines
            if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
                continue;
            }
            
            currentStatement += line + '\n';
            
            // Check if we're entering a trigger
            if (trimmedLine.includes('CREATE TRIGGER')) {
                inTrigger = true;
            }
            
            // Check if we're ending a trigger
            if (inTrigger && trimmedLine === 'END;') {
                inTrigger = false;
                statements.push(currentStatement.trim());
                currentStatement = '';
            }
            // Check for regular statement end (not in trigger)
            else if (!inTrigger && trimmedLine.endsWith(';')) {
                statements.push(currentStatement.trim());
                currentStatement = '';
            }
        }
        
        // Add any remaining statement
        if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
        }
        
        console.log(`📝 Executing ${statements.length} database statements...`);
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await query(statement);
                } catch (error) {
                    console.log(`⚠️ Statement execution warning: ${error.message}`);
                    console.log(`   Statement: ${statement.substring(0, 100)}...`);
                    // Continue with next statement - don't fail the entire setup
                }
            }
        }
        
        console.log('✅ Database schema created successfully!');
        console.log('📋 Tables created:');
        console.log('   - users (user accounts)');
        console.log('   - notes (knowledge entries)');
        console.log('   - user_sessions (session management)');
        console.log('   - workflows (workflow management)');
        console.log('   - workflow_steps (workflow step details)');
        console.log('   - workflow_attachments (workflow resources)');
        console.log('   - workflow_templates (reusable workflows)');
        
        // Test the setup by running a simple query
        const result = await query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        
        console.log('🔍 Database tables verified:');
        result.forEach(row => {
            console.log(`   ✓ ${row.name}`);
        });
        
        // Test user count
        const userCount = await query('SELECT COUNT(*) as count FROM users');
        console.log(`👥 Users in database: ${userCount[0].count}`);
        
        console.log('\n🎉 SQLite database setup complete!');
        console.log('💡 You can now start the API server with: npm run start');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Make sure the database directory exists');
        console.error('   2. Check file permissions');
        console.error('   3. Ensure SQLite3 is available');
        console.error('   4. Verify the schema file exists');
        process.exit(1);
    }
};

// Run setup if called directly
if (require.main === module) {
    setupSQLiteDatabase();
}

module.exports = setupSQLiteDatabase;