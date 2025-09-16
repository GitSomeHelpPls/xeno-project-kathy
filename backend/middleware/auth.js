const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Handle permanent admin token from env
    const adminToken = process.env.ADMIN_JWT_TOKEN;
    if (adminToken && token === adminToken) {
      // Create admin user for permanent token
      const adminUser = {
        id: 'permanent-admin-id',
        email: 'admin@xeno.com',
        createdAt: new Date(),
        store: 'admin-store'
      };
      
      req.user = adminUser;
      return next();
    }

    // Handle mock tokens for development
    if (token.startsWith('mock-jwt-token-')) {
      // Create a mock user for development
      const mockUser = {
        id: 'mock-user-id',
        email: 'admin@xeno.com',
        createdAt: new Date(),
        store: 'demo-store'
      };
      
      req.user = mockUser;
      return next();
    }

    // Handle real JWT tokens
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        store: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Handle mock tokens for development
      if (token.startsWith('mock-jwt-token-')) {
        const mockUser = {
          id: 'mock-user-id',
          email: 'admin@xeno.com',
          createdAt: new Date(),
          store: 'demo-store'
        };
        req.user = mockUser;
      } else {
        // Handle real JWT tokens
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            createdAt: true,
            store: true
          }
        });
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  JWT_SECRET
};