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
      const sqlProducts = await fetchProducts();
      const wooProducts = await fetchWooCommerceProducts();
  
      // Compare products
      const { newProducts, updatedProducts } = compareProducts(sqlProducts, wooProducts);
  
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
          logger.info(`Created product: ${createdProduct.name} (ID: ${createdProduct.id})`);
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
          logger.info(`Updated product: ${result.name} (ID: ${result.id})`);
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

  async function syncProducts(dryRun = false) {
    try {
      logger.info('Starting sync process...');
      if (dryRun) {
        logger.info('Dry run mode enabled. No changes will be applied.');
      }
  
      // Fetch products from SQL and WooCommerce
      const sqlProducts = await fetchProducts();
      const wooProducts = await fetchWooCommerceProducts();
  
      // Compare products
      const { newProducts, updatedProducts } = compareProducts(sqlProducts, wooProducts);
  
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
          if (dryRun) {
            logger.info(`[Dry Run] Would create product: ${newProduct.name}`);
          } else {
            const createdProduct = await createWooCommerceProduct(newProduct);
            logger.info(`Created product: ${createdProduct.name} (ID: ${createdProduct.id})`);
            createdCount++;
          }
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
          if (dryRun) {
            logger.info(`[Dry Run] Would update product: ${updatedProduct.name}`);
          } else {
            const result = await updateWooCommerceProduct(product.wooId, updatedProduct);
            logger.info(`Updated product: ${result.name} (ID: ${result.id})`);
            updatedCount++;
          }
        } catch (err) {
          logger.error(`Error updating product: ${product.sku}`, { error: err.message, stack: err.stack });
        }
      }
  
      // Log sync summary
      if (dryRun) {
        logger.info(`Dry run completed. Would create: ${newProducts.length}, Would update: ${updatedProducts.length}`);
      } else {
        logger.info(`Sync process completed. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${newProducts.length - createdCount + updatedProducts.length - updatedCount}`);
      }
    } catch (err) {
      logger.error('Error during sync process:', { error: err.message, stack: err.stack });
    }
  }