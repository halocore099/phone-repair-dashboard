const { fetchProducts } = require('./sqlService');
const { fetchWooCommerceProducts, createWooCommerceProduct, updateWooCommerceProduct } = require('./wooService');
const logger = require('../utils/logger');

async function compareProducts(sqlProducts, wooProducts) {
  const newProducts = [];
  const updatedProducts = [];

  logger.debug('Comparing SQL and WooCommerce products...');
  for (const sqlProduct of sqlProducts) {
    if (!sqlProduct.sku) {
      logger.warn(`Product missing SKU: ${sqlProduct.device_name} - ${sqlProduct.repair_type}`);
      continue; // Skip products without SKU
    }

    const wooProduct = wooProducts.find((wp) => wp.sku === sqlProduct.sku);

    if (!wooProduct) {
      logger.debug(`New product detected: ${sqlProduct.sku}`);
      newProducts.push(sqlProduct);
    } else if (
      sqlProduct.device_name !== wooProduct.name ||
      sqlProduct.price !== wooProduct.price
    ) {
      logger.debug(`Updated product detected: ${sqlProduct.sku}`);
      updatedProducts.push({ ...sqlProduct, wooId: wooProduct.id });
    }
  }

  logger.debug(`Found ${newProducts.length} new products and ${updatedProducts.length} updated products.`);
  return { newProducts, updatedProducts };
}

async function syncProducts() {
  try {
    logger.info('Starting sync process...');

    // Fetch products from SQL and WooCommerce
    logger.debug('Fetching products from SQL database...');
    const sqlProducts = await fetchProducts();
    logger.debug(`Fetched ${sqlProducts.length} products from SQL database.`);

    logger.debug('Fetching products from WooCommerce...');
    const wooProducts = await fetchWooCommerceProducts();
    logger.debug(`Fetched ${wooProducts.length} products from WooCommerce.`);

    // Compare products
    logger.debug('Comparing SQL and WooCommerce products...');
    const { newProducts, updatedProducts } = compareProducts(sqlProducts, wooProducts);
    logger.debug(`Found ${newProducts.length} new products and ${updatedProducts.length} updated products.`);

    // Create new products in WooCommerce
    logger.info(`Creating ${newProducts.length} new products...`);
    let createdCount = 0;
    for (const product of newProducts) {
      try {
        const newProduct = {
          name: `${product.device_name} - ${product.repair_type}`,
          sku: product.sku,
          price: product.price.toString(),
          stock_quantity: 10, // Default stock quantity
        };
        const createdProduct = await createWooCommerceProduct(newProduct);
        logger.info(`Created Product ${createdCount + 1}:`, {
          name: createdProduct.name,
          id: createdProduct.id,
          sku: createdProduct.sku,
          price: createdProduct.price,
        });
        createdCount++;
      } catch (err) {
        logger.error(`Error creating product: ${product.sku}`, { error: err.message, stack: err.stack });
      }
    }

    // Update existing products in WooCommerce
    logger.info(`Updating ${updatedProducts.length} products...`);
    let updatedCount = 0;
    for (const product of updatedProducts) {
      try {
        const updatedProduct = {
          name: `${product.device_name} - ${product.repair_type}`,
          price: product.price.toString(),
        };
        const result = await updateWooCommerceProduct(product.wooId, updatedProduct);
        logger.info(` Updated Product ${updatedCount + 1}:`, {
          name: result.name,
          id: result.id,
          sku: result.sku,
          price: result.price,
        });
        updatedCount++;
      } catch (err) {
        logger.error(`Error updating product: ${product.sku}`, { error: err.message, stack: err.stack });
      }
    }

    // Log sync summary
    logger.info(`Sync process completed. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${newProducts.length - createdCount + updatedProducts.length - updatedCount}`);
  } catch (err) {
    logger.error('Error during sync process:', { error: err.message, stack: err.stack });
  }
}

module.exports = { syncProducts };