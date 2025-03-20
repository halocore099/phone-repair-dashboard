const mysql = require('mysql2/promise');
const path = require('path');
const logger = require('./logger');

// Load environment variables with explicit path
require('dotenv').config({ 
  path: path.resolve(__dirname, '../.env') 
});

// Log database connection parameters (without password)
logger.debug(`Attempting to connect to database: ${process.env.DB_NAME || 'undefined'} at ${process.env.DB_HOST || 'undefined'} as ${process.env.DB_USER || 'undefined'}`);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connection established successfully');
    connection.release();
    return true;
  } catch (err) {
    logger.error(`Failed to connect to the database: ${err.message}`, { error: err.message, stack: err.stack });
    return false;
  }
}

// Export both the pool and the test function
module.exports = {
  query: (...args) => pool.query(...args),
  getConnection: () => pool.getConnection(),
  testConnection
};
