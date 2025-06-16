const db = require('../utils/db');
const logger = require('../utils/logger');

async function fetchProducts(limit = null) {
  try {
    logger.debug(`Fetching products from SQL database${limit ? ` (limit: ${limit})` : ''}`);

    const connectionOk = await db.testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    const query = `
      SELECT
        d.device_name,
        d.brand,
        rt.repair_type,
        ts.price,
        ts.sku
      FROM test ts
      JOIN devices d ON ts.device_id = d.device_id
      JOIN repairtypes rt ON ts.repair_type_id = rt.repair_type_id
      ${limit ? `LIMIT ${limit}` : ''}
    `;

    logger.debug(`Executing SQL query: ${query}`);
    const [products] = await db.query(query);
    
    if (!products || !Array.isArray(products)) {
      throw new Error('Invalid response from database');
    }

    logger.info(`Successfully fetched ${products.length} products from SQL`);
    return products;

  } catch (err) {
    logger.error('SQL fetch failed:', {
      error: err.message,
      stack: err.stack,
      sql: err.sql,
      code: err.code
    });
    throw new Error(`Database operation failed: ${err.message}`);
  }
}

module.exports = {
  fetchProducts
};