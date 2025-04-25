const axios = require('axios');
require('dotenv').config();
const logger = require('../utils/logger');
const Bottleneck = require('bottleneck');

// Modified limiter configuration
const limiter = new Bottleneck({
  minTime: 666, // 90 requests/minute (60000/90)
  maxConcurrent: 1,
  reservoir: 100, // Increased initial capacity
  reservoirRefreshAmount: 100, // Increased refresh amount
  reservoirRefreshInterval: 60 * 1000 // Still 1 minute
});

const wooCommerce = axios.create({
  baseURL: `${process.env.WOOCOMMERCE_URL}/wp-json/wc/v3`,
  auth: {
    username: process.env.WOOCOMMERCE_CONSUMER_KEY,
    password: process.env.WOOCOMMERCE_CONSUMER_SECRET
  },
  timeout: 30000 // Increased timeout
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
        // Check and wait if we're running low on reservoir
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
        if (err.response && err.response.status === 429) {
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
      status: err.response?.status
    });
    throw err;
  }
}

async function updateWooCommerceProduct(productId, productData) {
  try {
    logger.debug(`Updating product ${productId}`);
    const response = await limiter.schedule(() =>
      wooCommerce.put(`/products/${productId}`, {
        ...productData,
        meta_data: [{
          key: '_last_sync',
          value: new Date().toISOString()
        }]
      })
    );
    
    logger.info(`Updated product ${productId}`);
    return response.data;

  } catch (err) {
    logger.error('Update failed:', {
      productId,
      error: err.message,
      status: err.response?.status
    });
    throw err;
  }
}

module.exports = {
  fetchWooCommerceProducts,
  createWooCommerceProduct,
  updateWooCommerceProduct
};