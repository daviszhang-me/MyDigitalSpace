const { initDatabase, query } = require('../config/database-sqlite');

async function addSampleNotes() {
    try {
        console.log('🔄 Initializing database...');
        await initDatabase();
        
        // Get admin user ID
        const adminUser = await query('SELECT id FROM users WHERE role = "admin" LIMIT 1');
        if (adminUser.rows.length === 0) {
            console.log('❌ No admin user found');
            return;
        }
        
        const userId = adminUser.rows[0].id;
        console.log(`📝 Adding sample notes for user: ${userId}`);
        
        const sampleNotes = [
            {
                title: "Welcome to MyDigitalSpace KnowledgeHub",
                content: "This is your personal knowledge management system. You can organize thoughts, ideas, projects, and learning resources all in one place. This note demonstrates the system is working correctly.",
                category: "ideas",
                tags: ["welcome", "getting-started", "demo"]
            },
            {
                title: "JavaScript Best Practices",
                content: "Always use const and let instead of var. Arrow functions are great for callbacks. Use async/await for asynchronous operations. Remember to handle errors with try-catch blocks.",
                category: "learning",
                tags: ["javascript", "programming", "best-practices", "tips"]
            },
            {
                title: "MyDigitalSpace Architecture",
                content: "The application uses Node.js with Express for the backend, SQLite for data storage, and vanilla JavaScript for the frontend. Authentication is handled via JWT tokens with role-based access control.",
                category: "projects",
                tags: ["architecture", "nodejs", "sqlite", "jwt", "rbac"]
            },
            {
                title: "Useful Development Resources",
                content: "MDN Web Docs for JavaScript reference, Node.js official documentation, SQLite documentation, JWT.io for token debugging, and VS Code as the primary editor.",
                category: "resources",
                tags: ["development", "documentation", "tools", "reference"]
            },
            {
                title: "Role-Based Access Control Implementation",
                content: "The system implements three user roles: Admin (full access), Editor (can create/edit notes), and Viewer (read-only access). Category management is restricted to admin users only.",
                category: "learning",
                tags: ["rbac", "security", "permissions", "admin", "roles"]
            }
        ];
        
        for (const note of sampleNotes) {
            try {
                await query(
                    `INSERT INTO notes (user_id, title, content, category, tags, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [userId, note.title, note.content, note.category, JSON.stringify(note.tags)]
                );
                console.log(`✅ Added note: ${note.title}`);
            } catch (error) {
                console.error(`❌ Error adding note "${note.title}":`, error.message);
            }
        }
        
        // Verify notes were added
        const notesResult = await query('SELECT COUNT(*) as count FROM notes');
        console.log(`\n📊 Total notes in database: ${notesResult.rows[0].count}`);
        
        console.log('\n🎉 Sample notes added successfully!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    addSampleNotes();
}

module.exports = { addSampleNotes };