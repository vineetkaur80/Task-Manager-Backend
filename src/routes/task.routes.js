const express = require('express');
const { body } = require('express-validator');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── Validation Rules ─────────────────────────────────────────────────────────
const createTaskValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required')
    .isLength({ min: 2, max: 200 }).withMessage('Title must be 2–200 characters'),
  body('projectId')
    .notEmpty().withMessage('projectId is required')
    .isMongoId().withMessage('Invalid projectId'),
  body('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('Description max 2000 characters'),
  body('assignedTo')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid assignedTo userId'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('dueDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid date'),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
];

const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Title must be 2–200 characters'),
  body('status')
    .optional()
    .isIn(['todo', 'in-progress', 'review', 'completed']).withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('dueDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid date'),
  body('assignedTo')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid assignedTo userId'),
];

const statusValidation = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['todo', 'in-progress', 'review', 'completed']).withMessage('Invalid status'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/', createTaskValidation, validate, createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', updateTaskValidation, validate, updateTask);
router.patch('/:id/status', statusValidation, validate, updateTaskStatus);
router.delete('/:id', deleteTask);

module.exports = router;
