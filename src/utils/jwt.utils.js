const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token for a user
 * @param {string} id - User's MongoDB ObjectId
 * @returns {string} signed JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Send a token response with user data
 */
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt,
  };

  res.status(statusCode).json({
    success: true,
    token,
    user: userData,
  });
};

module.exports = { generateToken, sendTokenResponse };
