const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// SQLite database configuration
const dbPath = path.join(__dirname, '../data/knowledgehub.db');

let db = null;

// Initialize SQLite database
const initDatabase = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create tables if they don't exist
        await db.exec(`
            -- Enable foreign keys
            PRAGMA foreign_keys = ON;

            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
                can_create_notes BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Notes table
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT DEFAULT '[]', -- JSON array as string
                source_url TEXT, -- URL of external source
                source_type TEXT, -- 'rss', 'manual', 'import', etc.
                source_title TEXT, -- Name of the source (e.g., 'TechCrunch')
                is_archived BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- RSS Sources table
            CREATE TABLE IF NOT EXISTS rss_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                category TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                last_fetched DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Sessions table
            CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
            CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
            CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
        `);

        console.log('✅ SQLite database initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ SQLite database initialization failed:', error);
        return false;
    }
};

// Get database instance
const getDb = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
};

// Test connection
const testConnection = async () => {
    try {
        if (!db) {
            await initDatabase();
        }
        
        const result = await db.get('SELECT datetime("now") as now');
        console.log('✅ Database connected successfully');
        console.log('📅 Database time:', result.now);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Helper function to run queries (PostgreSQL-like interface)
const query = async (sql, params = []) => {
    const db = getDb();
    
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = await db.all(sql, params);
        return { rows };
    } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const result = await db.run(sql, params);
        // For compatibility, return the inserted row if it's a single insert
        if (sql.includes('RETURNING')) {
            const tableName = sql.match(/INSERT INTO (\w+)/i)?.[1];
            const row = await db.get(`SELECT * FROM ${tableName} WHERE rowid = ?`, [result.lastID]);
            return { rows: [row] };
        }
        return { rows: [{ id: result.lastID }] };
    } else {
        const result = await db.run(sql, params);
        return { rows: [{ changes: result.changes }] };
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    if (db) {
        console.log('📦 Closing SQLite database...');
        await db.close();
        console.log('✅ Database closed');
    }
    process.exit(0);
});

module.exports = {
    initDatabase,
    getDb,
    query,
    testConnection
};