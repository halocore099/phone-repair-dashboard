const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

const logger = winston.createLogger({
  level: 'debug', // Set to 'debug' to log all levels
  format: combine(
    timestamp(), // Add timestamp to logs
    logFormat // Use custom log format
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }), // Log errors to error.log
    new winston.transports.File({ filename: 'logs/combined.log' }), // Log all levels to combined.log
    new winston.transports.Console(), // Log to console
  ],
});

module.exports = logger;