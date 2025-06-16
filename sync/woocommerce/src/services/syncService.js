const { fetchProducts, updateWooCommerceId } = require('./sqlService');
const { fetchWooCommerceProducts, createWooCommerceProduct, updateWooCommerceProduct } = require('./wooService');
const logger = require('../utils/logger');

// Price normalization with better error handling
const normalizePrice = (price) => {
  const num = parseFloat(price);
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

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
      // Compare prices and names
      const normalizedSqlPrice = normalizePrice(sqlProduct.price);
      const normalizedWooPrice = normalizePrice(wooProduct.regular_price || wooProduct.price);
      
      const priceChanged = normalizedSqlPrice !== normalizedWooPrice;
      const nameChanged = sqlProduct.device_name !== wooProduct.name;

      // Detailed debug logging
      logger.debug(`Comparing product ${sqlProduct.sku}:`, {
        sqlPrice: sqlProduct.price,
        wooPrice: wooProduct.regular_price || wooProduct.price,
        normalizedSqlPrice,
        normalizedWooPrice,
        priceChanged,
        nameChanged
      });

      if (priceChanged || nameChanged) {
        updatedProducts.push({
          ...sqlProduct,
          wooId: wooProduct.id,
          wooCurrentName: wooProduct.name,
          wooCurrentPrice: wooProduct.regular_price || wooProduct.price
        });
      }
    }
  }

  logger.info(`Comparison results: ${newProducts.length} new, ${updatedProducts.length} updated`);
  return { newProducts, updatedProducts };
}

async function syncProducts(limit = null) {
  const results = {
    total: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    details: []
  };
  
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
    
    // Process new products
    for (const product of newProducts) {
      try {
        const createdProduct = await createWooCommerceProduct({
          name: `${product.device_name} - ${product.repair_type}`.substring(0, 120),
          sku: product.sku,
          regular_price: product.price.toString(),
          stock_quantity: 10
        });
        
        // Store WooCommerce ID in database
        await updateWooCommerceId(product.sku, createdProduct.id);
        
        results.details.push({
          sku: product.sku,
          id: createdProduct.id,
          status: 'created',
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        results.failed++;
        results.details.push({
          sku: product.sku,
          status: 'failed',
          operation: 'create',
          error: err.message,
          response: err.response?.data
        });
      }
    }
    
    // Process updates
    for (const product of updatedProducts) {
      results.total++;
      const productKey = `${product.sku}|${product.wooId}`;
            
      try {
        logger.debug(`Processing update for ${productKey}`);
        const updateData = {
          name: `${product.device_name} - ${product.repair_type}`.substring(0, 120),
          regular_price: product.price.toString()
        };
        
        // Pre-update debug
        logger.debug(`Pre-update data for ${productKey}:`, {
          sqlName: product.device_name,
          wooName: product.wooCurrentName,
          sqlPrice: product.price,
          wooPrice: product.wooCurrentPrice,
          updateData
        });
        
        const result = await updateWooCommerceProduct(product.wooId, updateData);
        
        // Verify update
        const wasUpdated = (
          (updateData.name && result.name === updateData.name) ||
          (updateData.regular_price && 
           normalizePrice(result.regular_price) === normalizePrice(updateData.regular_price))
        );
        
        if (wasUpdated) {
          results.updated++;
          results.details.push({
            sku: product.sku,
            id: product.wooId,
            status: 'updated',
            changes: Object.keys(updateData).filter(k => 
              k === 'name' 
                ? updateData[k] !== product.wooCurrentName
                : normalizePrice(updateData[k]) !== normalizePrice(product.wooCurrentPrice)
            ),
            timestamp: new Date().toISOString()
          });
        } else {
          results.unchanged++;
          results.details.push({
            sku: product.sku,
            id: product.wooId,
            status: 'unchanged',
            reason: 'No differences detected after update attempt',
            details: {
              nameMatch: updateData.name === result.name,
              priceMatch: normalizePrice(updateData.regular_price) === normalizePrice(result.regular_price)
            }
          });
        }
      } catch (err) {
        results.failed++;
        results.details.push({
          sku: product.sku,
          id: product.wooId,
          status: 'failed',
          error: err.message,
          response: err.response?.data,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    logger.info('Sync completed with results:', {
      stats: {
        processed: results.total,
        updated: results.updated,
        unchanged: results.unchanged,
        failed: results.failed
      },
      details: results.details
    });
    return {
      success: true,
      ...results
    };
  } catch (err) {
    logger.error('Sync failed:', err);
    return {
      success: false,
      error: err.message,
      ...results
    };
  }
}

module.exports = { syncProducts };