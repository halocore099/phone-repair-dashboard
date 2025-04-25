const db = require('../utils/db');
const logger = require('../utils/logger');

async function fetchProducts(limit = null) {
  try {
    logger.debug(`Fetching products from SQL database${limit ? ` (limit: ${limit})` : ''}`);

    if (!await db.testConnection()) {
      throw new Error('Database connection failed');
    }

    const query = `
      SELECT
        d.device_name,
        d.brand,
        rt.repair_type,
        test.price,
        test.sku
      FROM test test
      JOIN devices d ON test.device_id = d.device_id
      JOIN repairtypes rt ON test.repair_type_id = rt.repair_type_id
      ${limit ? `LIMIT ${limit}` : ''}
    `;

    const [products] = await db.query(query);
    logger.info(`Fetched ${products.length} products from SQL`);
    return products;

  } catch (err) {
    logger.error('SQL fetch failed:', {
      error: err.message,
      sql: err.sql
    });
    throw err;
  }
}

module.exports = { fetchProducts };