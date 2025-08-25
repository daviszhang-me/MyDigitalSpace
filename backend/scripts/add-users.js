const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Import SQLite database functions
const { initDatabase, query } = require('../config/database-sqlite');

async function addUsers() {
    try {
        console.log('🔄 Initializing database...');
        await initDatabase();
        
        console.log('🔄 Adding users...');
        
        // Users to add
        const users = [
            {
                email: 'davis.zhangxi@gmail.com',
                name: 'Davis Zhang (Admin)',
                password: 'xinyu2011',
                role: 'admin',
                can_create_notes: true
            },
            {
                email: 'davis.zhangxi@outlook.com', // Fixed typo in original request
                name: 'Davis Zhang (Viewer)',
                password: 'xinyu2011',
                role: 'viewer',
                can_create_notes: false
            }
        ];
        
        for (const user of users) {
            try {
                // Check if user already exists
                const existingUser = await query(
                    'SELECT id FROM users WHERE email = ?',
                    [user.email]
                );
                
                if (existingUser.rows.length > 0) {
                    console.log(`⚠️  User ${user.email} already exists, skipping...`);
                    continue;
                }
                
                // Hash password
                const saltRounds = 12;
                const passwordHash = await bcrypt.hash(user.password, saltRounds);
                
                // Generate UUID for user ID
                const userId = uuidv4();
                
                // Insert user
                await query(
                    `INSERT INTO users (id, email, name, password_hash, role, can_create_notes, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    [userId, user.email, user.name, passwordHash, user.role, user.can_create_notes]
                );
                
                console.log(`✅ Added ${user.role} user: ${user.email}`);
                
            } catch (error) {
                console.error(`❌ Error adding user ${user.email}:`, error.message);
            }
        }
        
        // Verify users were added
        console.log('\n📊 Current users in database:');
        const allUsers = await query('SELECT id, email, name, role, can_create_notes, is_active FROM users');
        
        allUsers.rows.forEach(user => {
            console.log(`  • ${user.email} - ${user.name} (${user.role}) - Notes: ${user.can_create_notes ? 'Yes' : 'No'} - Active: ${user.is_active ? 'Yes' : 'No'}`);
        });
        
        console.log('\n🎉 User setup complete!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    addUsers();
}

module.exports = { addUsers };