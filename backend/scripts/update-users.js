const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('../config/database-sqlite');

async function updateUsers() {
    try {
        console.log('🔄 Initializing database...');
        await initDatabase();
        
        console.log('🔄 Updating user passwords and roles...');
        
        // Hash the password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash('xinyu2011', saltRounds);
        
        // Update admin user (gmail)
        await query(
            `UPDATE users SET 
                password_hash = ?, 
                role = 'admin', 
                can_create_notes = 1,
                name = 'Davis Zhang (Admin)',
                updated_at = CURRENT_TIMESTAMP 
             WHERE email = ?`,
            [passwordHash, 'davis.zhangxi@gmail.com']
        );
        console.log('✅ Updated admin user: davis.zhangxi@gmail.com');
        
        // Update viewer user (outlook)  
        await query(
            `UPDATE users SET 
                password_hash = ?, 
                role = 'viewer', 
                can_create_notes = 0,
                name = 'Davis Zhang (Viewer)',
                updated_at = CURRENT_TIMESTAMP 
             WHERE email = ?`,
            [passwordHash, 'davis.zhangxi@outlook.com']
        );
        console.log('✅ Updated viewer user: davis.zhangxi@outlook.com');
        
        // Verify the updates
        console.log('\n📊 Updated users in database:');
        const allUsers = await query('SELECT id, email, name, role, can_create_notes, is_active FROM users');
        
        allUsers.rows.forEach(user => {
            console.log(`  • ${user.email} - ${user.name} (${user.role}) - Notes: ${user.can_create_notes ? 'Yes' : 'No'} - Active: ${user.is_active ? 'Yes' : 'No'}`);
        });
        
        console.log('\n🎉 User update complete!');
        console.log('\n🔐 Login credentials:');
        console.log('  Admin: davis.zhangxi@gmail.com / xinyu2011');
        console.log('  Viewer: davis.zhangxi@outlook.com / xinyu2011');
        
    } catch (error) {
        console.error('❌ Update failed:', error);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    updateUsers();
}

module.exports = { updateUsers };