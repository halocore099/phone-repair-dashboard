const path = require('path');
const fs = require('fs');

// Try to load the .env file
require('dotenv').config({ 
  path: path.resolve(__dirname, './.env') 
});

console.log('Current working directory:', process.cwd());
console.log('Looking for .env file at:', path.resolve(__dirname, './.env'));
console.log('File exists:', fs.existsSync(path.resolve(__dirname, './.env')));
console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST || 'undefined');
console.log('DB_USER:', process.env.DB_USER || 'undefined');
console.log('DB_NAME:', process.env.DB_NAME || 'undefined');
