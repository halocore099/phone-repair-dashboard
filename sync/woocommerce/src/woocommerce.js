const path = require('path');
// Load environment variables with explicit path
require('dotenv').config({ 
  path: path.resolve(__dirname, './.env') 
});
const express = require('express');
const cron = require('node-cron');
const { syncProducts } = require('./services/syncService');
const logger = require('./utils/logger');
const db = require('./utils/db');
const app = express();


async function testDatabaseQuery() {
  try {
    const query = `
      SELECT
        d.device_name,
        d.brand,
        rt.repair_type,
        dr.price,
        dr.sku
      FROM
        device_repairs dr
      JOIN
        devices d ON dr.device_id = d.device_id
      JOIN
        repair_types rt ON dr.repair_type_id = rt.repair_type_id;
    `;
    const [rows] = await db.query(query);
    logger.debug('Database query successful:', rows);
    if (rows.length === 0) {
      logger.warn('No products found in the SQL database.');
    } else {
      logger.debug('Query result:', rows);
    }
  } catch (err) {
    logger.error('Database query failed:', { error: err.message, stack: err.stack });
  }
}

testDatabaseQuery();

// Test logger
logger.debug('Logger is working!');
logger.info('Server is starting...');


// Test database connection on startup
(async () => {
  try {
    const connected = await db.testConnection();
    if (connected) {
      logger.info('Database connection verified successfully');
    } else {
      logger.error('Could not establish database connection');
    }
  } catch (err) {
    logger.error('Error testing database connection:', { error: err.message, stack: err.stack });
  }
})();
app.get('/', (req, res) => {
  res.send('WooCommerce Sync Server is running!');
});


app.get('/debug-sync', async (req, res) => {
  try {
    logger.info('Manual sync process triggered...');
    await syncProducts();
    res.send('Sync process triggered manually.');
  } catch (err) {
    logger.error('Error during manual sync process:', { error: err.message, stack: err.stack });
    res.status(500).send('Error during sync process: ' + err.message);
  }
});


// Add a route to test database connection
app.get('/test-db', async (req, res) => {
  try {3
    const connected = await db.testConnection();
    if (connected) {
      res.send('Database connection successful!');
    } else {
      res.status(500).send('Database connection failed');
    }
  } catch (err) {
    res.status(500).send(`Database connection error: ${err.message}`);
  }
});


xcron.schedule('0 * * * *', async () => {
  logger.info('Starting scheduled sync process...');
  try {
    await syncProducts();
    logger.info('Scheduled sync process completed.');
  } catch (err) {
    logger.error('Error during scheduled sync process:', { error: err.message, stack: err.stack });
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});

testDatabaseQuery(); 