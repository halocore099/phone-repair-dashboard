const path = require('path');
// Load environment variables with explicit path
require('dotenv').config({ 
  path: path.resolve(__dirname, './.env') 
});
const express = require('express');
const { syncProducts, testProblematicProduct } = require('./services/syncService');
const logger = require('./utils/logger');
const db = require('./utils/db');
const app = express();


app.get('/test-sync-debug', async (req, res) => {
  const debugData = {
    processed: 0,
    successes: 0,
    failures: 0,
    mismatches: [],
    details: []
  };

  try {
    logger.info('Starting DEBUG sync test (100 products)...');
    
    // Temporary override for fetchProducts
    const originalFetch = require('./services/sqlService').fetchProducts;
    require('./services/sqlService').fetchProducts = async () => {
      return await originalFetch(100);  // Pass the limit directly
    };

    // Temporary override for update function
    const originalUpdate = require('./services/wooService').updateWooCommerceProduct;
    require('./services/wooService').updateWooCommerceProduct = async (id, product) => {
      debugData.processed++;
      try {
        // Verify before update
        const current = await wooCommerce.get(`/products/${id}`);
        if (current.data.sku !== product.sku) {
          debugData.mismatches.push({
            expected: product.sku,
            actual: current.data.sku,
            id
          });
          throw new Error('SKU mismatch');
        }

        const result = await originalUpdate(id, product);
        debugData.successes++;
        debugData.details.push({
          id,
          sku: product.sku,
          status: 'success'
        });
        return result;
      } catch (err) {
        debugData.failures++;
        debugData.details.push({
          id,
          sku: product.sku,
          status: 'failed',
          error: err.message
        });
        throw err;
      }
    };

    await syncProducts();
    
    // Restore originals
    require('./services/sqlService').fetchProducts = originalFetch;
    require('./services/wooService').updateWooCommerceProduct = originalUpdate;

    res.json({
      success: true,
      ...debugData
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      ...debugData,
      error: err.message
    });
  }
});

app.get('/test-product', async (req, res) => {
  try {
    logger.info('Testing problematic product creation...');
    const result = await testProblematicProduct();
    res.json({
      success: true,
      message: 'Test product created successfully',
      product: result
    });
  } catch (err) {
    logger.error('Test product creation failed:', err);
    res.status(500).json({
      success: false,
      message: 'Test product creation failed',
      error: err.message,
      details: err.response?.data || {}
    });
  }
});

async function testDatabaseQuery() {
  try {
    const query = `
      SELECT
        d.device_name,
        d.brand,
        rt.repairtypes,
        test.price,
        test.sku
      FROM
        test test  -- Changed from device_repairs to test
      JOIN
        devices d ON test.device_id = d.device_id  -- Updated table reference
      JOIN
        repairtypes rt ON test.repair_type_id = rt.repair_type_id;  -- Updated table reference
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
  }b
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




const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});