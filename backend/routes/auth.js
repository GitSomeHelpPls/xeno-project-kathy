const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { hashPassword, comparePassword } = require('../utils/password');
const { validateLogin, validateRegister } = require('../middleware/validation');
const { logger, asyncHandler } = require('../middleware/logging');

const router = express.Router();
const prisma = new PrismaClient();

// Login endpoint with validation
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  logger.info('Login attempt', { email });

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { store: true }
  });

  if (!user) {
    logger.warn('Login failed: user not found', { email });
    return res.status(401).json({ 
      error: 'Invalid email or password' 
    });
  }

  // Check password
  const isPasswordValid = await comparePassword(password, user.password);
  
  if (!isPasswordValid) {
    logger.warn('Login failed: invalid password', { email });
    return res.status(401).json({ 
      error: 'Invalid email or password' 
    });
  }

  // Generate JWT token
  const token = generateToken(user);

  logger.info('Login successful', { email, userId: user.id });

  // Return success response
  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      store: user.store
    }
  });
}));

// Register endpoint with validation
router.post('/register', validateRegister, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  logger.info('Registration attempt', { email });

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    logger.warn('Registration failed: user already exists', { email });
    return res.status(409).json({ 
      error: 'User with this email already exists' 
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword
    }
  });

  // Generate JWT token
  const token = generateToken(user);

  logger.info('Registration successful', { email, userId: user.id });

  // Return success response
  res.status(201).json({
    message: 'User created successfully',
    token,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt
    }
  });
}));

// Get current user
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    user: req.user
  });
}));

// Logout endpoint (client-side token removal)
router.post('/logout', (req, res) => {
  logger.info('User logged out', { userId: req.user?.id });
  res.json({ 
    message: 'Logged out successfully' 
  });
});

module.exports = router;