const axios = require('axios');
require('dotenv').config();
const logger = require('../utils/logger');
const Bottleneck = require('bottleneck');

// Throttle to 90 requests per minute (to stay under WooCommerce's limit)
const limiter = new Bottleneck({
    minTime: 60000 / 90, // 90 requests per minute
  });
  

const wooCommerce = axios.create({
  baseURL: `${process.env.WOOCOMMERCE_URL}/wp-json/wc/v3`,
  auth: {
    username: process.env.WOOCOMMERCE_CONSUMER_KEY,
    password: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  },
});

async function fetchWooCommerceProducts() {
    try {
      logger.debug('Fetching products from WooCommerce...');
      const response = await limiter.schedule(() => wooCommerce.get('/products'));
      logger.debug(`Fetched ${response.data.length} products from WooCommerce.`);
      return response.data;
    } catch (err) {
      logger.error('Error fetching products from WooCommerce:', { error: err.message, stack: err.stack });
      throw err;
    }
  }
  

async function createWooCommerceProduct(product) {
    try {
      logger.debug(`Creating product in WooCommerce: ${product.name}`);
      const response = await limiter.schedule(() => wooCommerce.post('/products', product));
      logger.debug(`Created product: ${response.data.name} (ID: ${response.data.id})`);
      return response.data;
    } catch (err) {
      logger.error('Error creating product in WooCommerce:', { error: err.message, stack: err.stack });
      throw err;
    }
  }

  async function updateWooCommerceProduct(productId, product) {
    try {
      logger.debug(`Updating product in WooCommerce: ${product.name}`);
      const response = await limiter.schedule(() => wooCommerce.put(`/products/${productId}`, product));
      logger.debug(`Updated product: ${response.data.name} (ID: ${response.data.id})`);
      return response.data;
    } catch (err) {
      logger.error('Error updating product in WooCommerce:', { error: err.message, stack: err.stack });
      throw err;
    }
  }

module.exports = {
  fetchWooCommerceProducts,
  createWooCommerceProduct, 
  updateWooCommerceProduct,
};