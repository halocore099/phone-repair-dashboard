const db = require('../utils/db');
const logger = require('../utils/logger');

async function fetchProducts() {
  try {
    logger.debug('Fetching products from SQL database...');

    // Test connection before executing query
    const connectionSuccessful = await db.testConnection();
    if (!connectionSuccessful) {
      throw new Error('Database connection failed');
    }

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
        repairtypes rt ON dr.repair_type_id = rt.repair_type_id;
    `;
    const [products] = await db.query(query);
    logger.debug(`Fetched ${products.length} products from SQL database.`);

    // Log each product
    products.forEach((product, index) => {
      logger.debug(`[DEBUG] Received Product ${index + 1}:`, {
        device_name: product.device_name,
        brand: product.brand,
        repair_type: product.repair_type,
        price: product.price,
        sku: product.sku,
      });
    });

    return products;
  } catch (err) {
    logger.error('Error fetching products from SQL:', { 
      error: err.message, 
      stack: err.stack, 
      sql: err.sql, // Log the SQL query that caused the error
      sqlMessage: err.sqlMessage, // Log the SQL error message
    });
    throw err;
  }
}

module.exports = { fetchProducts };