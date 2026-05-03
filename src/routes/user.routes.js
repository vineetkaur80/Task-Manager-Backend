const express = require('express');
const { body, param } = require('express-validator');
const {
  getAllUsers,
  getUserById,
  updateProfile,
  updateUserRole,
  deactivateUser,
} = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET all users (admin only)
router.get('/', restrictTo('admin'), getAllUsers);

// GET single user
router.get('/:id', getUserById);

// PUT update own profile
router.put(
  '/profile/me',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  ],
  validate,
  updateProfile
);

// PUT update user role (admin only)
router.put(
  '/:id/role',
  restrictTo('admin'),
  [body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member')],
  validate,
  updateUserRole
);

// DELETE (deactivate) user (admin only)
router.delete('/:id', restrictTo('admin'), deactivateUser);

module.exports = router;
