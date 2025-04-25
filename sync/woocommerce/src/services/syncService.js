const { fetchProducts } = require('./sqlService');
const { fetchWooCommerceProducts, createWooCommerceProduct, updateWooCommerceProduct } = require('./wooService');
const logger = require('../utils/logger');

async function compareProducts(sqlProducts, wooProducts) {
  const newProducts = [];
  const updatedProducts = [];
  const skuMap = {};

  // Create SKU lookup map
  wooProducts.forEach(p => {
    if (p.sku) skuMap[p.sku] = p;
  });

  for (const sqlProduct of sqlProducts) {
    if (!sqlProduct.sku) {
      logger.warn(`Skipping product without SKU: ${sqlProduct.device_name}`);
      continue;
    }

    const wooProduct = skuMap[sqlProduct.sku];

    if (!wooProduct) {
      newProducts.push(sqlProduct);
    } else {
      const priceChanged = String(sqlProduct.price) !== String(wooProduct.price);
      const nameChanged = sqlProduct.device_name !== wooProduct.name;
      
      if (priceChanged || nameChanged) {
        updatedProducts.push({
          ...sqlProduct,
          wooId: wooProduct.id,
          wooCurrentName: wooProduct.name
        });
      }
    }
  }

  logger.info(`Comparison results: ${newProducts.length} new, ${updatedProducts.length} updated`);
  return { newProducts, updatedProducts };
}

async function syncProducts(limit = null) {
  const startTime = Date.now();
  logger.info(`Starting sync${limit ? ` (limit: ${limit})` : ''}...`);

  try {
    // Fetch products in parallel
    const [sqlProducts, wooProducts] = await Promise.all([
      fetchProducts(limit).catch(() => []),
      fetchWooCommerceProducts().catch(() => [])
    ]);

    if (!sqlProducts.length || !wooProducts.length) {
      throw new Error(sqlProducts.length ? 'WooCommerce fetch failed' : 'SQL fetch failed');
    }

    const { newProducts, updatedProducts } = await compareProducts(sqlProducts, wooProducts);
    const results = {
      new: { count: 0, errors: 0 },
      updated: { count: 0, errors: 0 }
    };

    // Process new products
    for (const product of newProducts) {
      try {
        await createWooCommerceProduct({
          name: `${product.device_name} - ${product.repair_type}`.substring(0, 120),
          sku: product.sku,
          regular_price: product.price.toString(),
          stock_quantity: 10
        });
        results.new.count++;
      } catch (err) {
        results.new.errors++;
      }
    }

    // Process updates
    for (const product of updatedProducts) {
      try {
        await updateWooCommerceProduct(product.wooId, {
          name: product.repair_type.substring(0, 120),
          regular_price: product.price.toString()
        });
        results.updated.count++;
      } catch (err) {
        results.updated.errors++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Sync completed in ${duration}s`, { results });
    
    return {
      success: true,
      duration: `${duration}s`,
      stats: results
    };

  } catch (err) {
    logger.error('Sync failed:', {
      error: err.message,
      stack: err.stack
    });
    return { 
      success: false, 
      error: err.message 
    };
  }
}

module.exports = { syncProducts };