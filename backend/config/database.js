const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait when connecting
};

// Alternative individual config if not using DATABASE_URL
if (!process.env.DATABASE_URL) {
    dbConfig.host = process.env.DB_HOST || 'localhost';
    dbConfig.port = process.env.DB_PORT || 5432;
    dbConfig.database = process.env.DB_NAME || 'knowledgehub';
    dbConfig.user = process.env.DB_USER;
    dbConfig.password = process.env.DB_PASSWORD;
}

// Create the connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Database connection test
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        
        // Test query
        const result = await client.query('SELECT NOW()');
        console.log('📅 Database time:', result.rows[0].now);
        
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📦 Closing database pool...');
    pool.end(() => {
        console.log('✅ Database pool closed');
        process.exit(0);
    });
});

module.exports = {
    pool,
    testConnection
};