const { Pool } = require('pg');
require('dotenv').config(); // Ensure .env is loaded
const logger = require('../utils/logger');

let pool;

const connectDB = async () => {
  try {
    // Use individual parameters for more reliable connection
    const connectionConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'shamba_luv_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || undefined,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    logger.info('Attempting database connection with config:', {
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database,
      user: connectionConfig.user,
      passwordProvided: !!connectionConfig.password
    });

    pool = new Pool(connectionConfig);

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('✅ Database connected successfully');
    return pool;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { 
      query: text.substring(0, 100) + '...',
      duration: `${duration}ms`,
      rows: result.rowCount 
    });
    return result;
  } catch (error) {
    logger.error('Query error:', { error: error.message, query: text });
    throw error;
  }
};

const getClient = async () => {
  return await pool.connect();
};

module.exports = {
  connectDB,
  query,
  getClient
};