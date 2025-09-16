const { body, query, param, validationResult } = require('express-validator');

/**
 * Input Validation Middleware using express-validator
 */

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      error: 'Validation Error',
      details: errorMessages
    });
  }
  
  next();
};

/**
 * Auth validation rules
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
    // Removed strict password requirements for login - only length check
    
  handleValidationErrors
];

const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * Date range validation
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * Pagination validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer between 1 and 100'),
    
  handleValidationErrors
];

/**
 * Store validation
 */
const validateStore = [
  body('shopName')
    .isLength({ min: 3, max: 100 })
    .withMessage('Shop name must be between 3 and 100 characters')
    .matches(/^[a-zA-Z0-9\-._]+$/)
    .withMessage('Shop name can only contain letters, numbers, hyphens, dots, and underscores'),
    
  body('accessToken')
    .isLength({ min: 20, max: 100 })
    .withMessage('Access token must be between 20 and 100 characters')
    .matches(/^shpat_[a-zA-Z0-9]+$/)
    .withMessage('Access token must be a valid Shopify private app token'),
    
  handleValidationErrors
];

/**
 * Webhook validation
 */
const validateWebhook = [
  body('shop')
    .notEmpty()
    .withMessage('Shop parameter is required'),
    
  body('topic')
    .isIn(['orders/create', 'orders/updated', 'customers/create', 'customers/update', 'products/create', 'products/update'])
    .withMessage('Invalid webhook topic'),
    
  handleValidationErrors
];

/**
 * ID parameter validation
 */
const validateId = [
  param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID'),
    
  handleValidationErrors
];

/**
 * General sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove any potentially dangerous characters from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove HTML tags and potentially dangerous characters
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        sanitizeObject(obj[key]);
      } else if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      }
    }
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  next();
};

/**
 * Rate limiting validation (basic implementation)
 */
const createRateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    // Clean old entries
    for (const [key, value] of requests.entries()) {
      if (now - value.firstRequest > windowMs) {
        requests.delete(key);
      }
    }

    const userRequests = requests.get(ip);
    
    if (!userRequests) {
      requests.set(ip, { firstRequest: now, count: 1 });
      return next();
    }

    if (now - userRequests.firstRequest < windowMs) {
      userRequests.count++;
      
      if (userRequests.count > maxRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes exceeded`,
          retryAfter: Math.ceil((windowMs - (now - userRequests.firstRequest)) / 1000)
        });
      }
    } else {
      // Reset window
      requests.set(ip, { firstRequest: now, count: 1 });
    }

    next();
  };
};

/**
 * Content type validation
 */
const validateContentType = (expectedType = 'application/json') => {
  return (req, res, next) => {
    // Skip validation for GET, DELETE, and OPTIONS requests
    if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'OPTIONS') {
      return next();
    }
    
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes(expectedType)) {
      return res.status(400).json({
        error: 'Invalid Content Type',
        message: `Expected ${expectedType}`,
        received: contentType || 'none'
      });
    }
    
    next();
  };
};

module.exports = {
  validateLogin,
  validateRegister,
  validateDateRange,
  validatePagination,
  validateStore,
  validateWebhook,
  validateId,
  sanitizeInput,
  createRateLimiter,
  validateContentType,
  handleValidationErrors
};