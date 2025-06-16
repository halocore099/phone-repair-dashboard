const axios = require('axios');
require('dotenv').config();
const logger = require('../utils/logger');
const Bottleneck = require('bottleneck');

// Rate limiter configuration
const limiter = new Bottleneck({
  minTime: 666, // 90 requests/minute
  maxConcurrent: 1,
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 60 * 1000
});

const wooCommerce = axios.create({
  baseURL: `${process.env.WOOCOMMERCE_URL}/wp-json/wc/v3`,
  auth: {
    username: process.env.WOOCOMMERCE_CONSUMER_KEY,
    password: process.env.WOOCOMMERCE_CONSUMER_SECRET
  },
  timeout: 30000
});

async function fetchWooCommerceProducts() {
  try {
    logger.debug('Starting WooCommerce product fetch...');
    let allProducts = [];
    let page = 1;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
      try {
        if (limiter.reservoir <= 5) {
          const waitTime = limiter.nextReservoirRefresh - Date.now();
          if (waitTime > 0) {
            logger.debug(`Waiting ${Math.ceil(waitTime/1000)}s for rate limit reset...`);
            await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
          }
        }

        const response = await limiter.schedule(() => 
          wooCommerce.get('/products', {
            params: {
              per_page: 100,
              page: page,
              orderby: 'id',
              order: 'asc'
            }
          })
        );

        const products = response.data;
        allProducts = allProducts.concat(products);
        totalFetched += products.length;

        logger.debug(`Fetched page ${page} (${products.length} items, total: ${totalFetched})`);

        if (products.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (err) {
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers['retry-after'] || 10;
          logger.warn(`Rate limited - waiting ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        throw err;
      }
    }

    logger.info(`Successfully fetched ${totalFetched} products from ${page-1} pages`);
    return allProducts;
  } catch (err) {
    logger.error('Product fetch failed:', {
      error: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
    throw err;
  }
}

async function createWooCommerceProduct(product) {
  try {
    logger.debug(`Creating product: ${product.sku}`);
    const response = await limiter.schedule(() => 
      wooCommerce.post('/products', product)
    );
    logger.info(`Created product ${product.sku} (ID: ${response.data.id})`);
    return response.data;
  } catch (err) {
    logger.error('Creation failed:', {
      sku: product.sku,
      error: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
    throw err;
  }
}

async function updateWooCommerceProduct(productId, productData) {
  try {
    // 1. Get current product state
    const { data: currentProduct } = await limiter.schedule(() => 
      wooCommerce.get(`/products/${productId}`)
    );
    
    // 2. Prepare update payload
    const payload = {};
    let changesDetected = false;
    
    // Normalize price for comparison
    const normalizePrice = (price) => {
      const num = parseFloat(price);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    // Name comparison
    if (productData.name && productData.name !== currentProduct.name) {
      payload.name = productData.name;
      changesDetected = true;
    }
    
    // Price comparison
    const normalizedInputPrice = normalizePrice(productData.regular_price);
    const normalizedCurrentPrice = normalizePrice(currentProduct.regular_price);
    
    if (productData.regular_price && normalizedInputPrice !== normalizedCurrentPrice) {
      payload.regular_price = productData.regular_price;
      changesDetected = true;
    }

    // Debug logging
    logger.debug(`Update comparison for ${productId}:`, {
      nameChanged: payload.name ? true : false,
      priceChanged: payload.regular_price ? true : false,
      normalizedInputPrice,
      normalizedCurrentPrice
    });

    if (!changesDetected) {
      logger.debug(`No changes detected for product ${productId}`);
      return currentProduct;
    }
    
    // 3. Add sync metadata
    payload.meta_data = [
      ...(currentProduct.meta_data || []),
      {
        key: '_sync_update',
        value: new Date().toISOString()
      }
    ];
    
    // 4. Execute update
    const response = await limiter.schedule(() => 
      wooCommerce.put(`/products/${productId}`, payload, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
    );
    
    // 5. Verify update
    const { data: updatedProduct } = await limiter.schedule(() => 
      wooCommerce.get(`/products/${productId}`)
    );
    
    // 6. Validate changes
    const verification = {
      name: payload.name ? updatedProduct.name === payload.name : true,
      price: payload.regular_price ? 
        normalizePrice(updatedProduct.regular_price) === normalizePrice(payload.regular_price) : true
    };
    
    if (!verification.name || !verification.price) {
      throw new Error(`Update verification failed: ${JSON.stringify({
        expected: payload,
        actual: {
          name: updatedProduct.name,
          price: updatedProduct.regular_price
        }
      })}`);
    }
    
    logger.info(`Successfully updated product ${productId}`, {
      changes: Object.keys(payload),
      old_name: currentProduct.name,
      new_name: updatedProduct.name,
      old_price: currentProduct.regular_price,
      new_price: updatedProduct.regular_price
    });
    
    return updatedProduct;
  } catch (err) {
    logger.error(`Update failed for ${productId}:`, {
      error: err.message,
      response: err.response?.data
    });
    throw err;
  }
}

module.exports = {
  fetchWooCommerceProducts,
  createWooCommerceProduct,
  updateWooCommerceProduct
};