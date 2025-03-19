require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { syncProducts } = require('./services/syncService');
const logger = require('./utils/logger');

const app = express();

// Test logger
logger.debug('Logger is working!');
logger.info('Server is starting...');

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

cron.schedule('0 * * * *', async () => {
  logger.info('Starting sync process...');
  try {
    await syncProducts();
    logger.info('Sync process completed.');
  } catch (err) {
    logger.error('Error during sync process:', { error: err.message, stack: err.stack });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server is running on https://localhost:${PORT}`);
});