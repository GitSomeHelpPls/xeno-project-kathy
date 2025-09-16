const fs = require('fs');
const path = require('path');

/**
 * Enhanced Error Handling and Logging Middleware
 */
class Logger {
  constructor() {
    this.logDir = path.join(__dirname, 'logs');
    this.ensureLogDirectory();
  }

  /**
   * Ensure logs directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get current date string for log files
   */
  getDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Write log to file
   */
  writeToFile(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = path.join(this.logDir, `${level}-${this.getDateString()}.log`);

    // Write to file (async, non-blocking)
    fs.appendFile(logFile, logLine, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err);
      }
    });
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    console.log(`ℹ️  [INFO] ${message}`, meta);
    this.writeToFile('info', message, meta);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    console.warn(`⚠️  [WARN] ${message}`, meta);
    this.writeToFile('warn', message, meta);
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    console.error(`❌ [ERROR] ${message}`, meta);
    this.writeToFile('error', message, meta);
  }

  /**
   * Log debug message (only in development)
   */
  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🐛 [DEBUG] ${message}`, meta);
      this.writeToFile('debug', message, meta);
    }
  }
}

// Create logger instance
const logger = new Logger();

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;

  // Log the incoming request
  logger.info(`${method} ${originalUrl}`, {
    ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id || 'unknown'
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const statusEmoji = statusCode >= 500 ? '💥' : statusCode >= 400 ? '⚠️' : '✅';
    
    logger[logLevel](`${statusEmoji} ${method} ${originalUrl} ${statusCode}`, {
      duration: `${duration}ms`,
      ip,
      statusCode
    });

    originalEnd.apply(this, args);
  };

  next();
};

/**
 * Enhanced error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error with context
  logger.error(`Unhandled error in ${req.method} ${req.originalUrl}`, {
    error: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Determine error type and response
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'UnauthorizedError' || err.message.includes('jwt')) {
    statusCode = 401;
    message = 'Authentication Required';
  } else if (err.message.includes('not found')) {
    statusCode = 404;
    message = 'Resource Not Found';
  } else if (err.code === 'P2002') { // Prisma unique constraint
    statusCode = 409;
    message = 'Resource already exists';
  } else if (err.code === 'P2025') { // Prisma record not found
    statusCode = 404;
    message = 'Resource not found';
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
};

/**
 * Async error wrapper - catches async errors and passes to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for routes that don't exist
 */
const notFoundHandler = (req, res, next) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} does not exist`
  });
};

/**
 * Graceful shutdown handler
 */
const setupGracefulShutdown = () => {
  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      promise: promise.toString()
    });
    process.exit(1);
  });
};

module.exports = {
  logger,
  requestLogger,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  setupGracefulShutdown
};