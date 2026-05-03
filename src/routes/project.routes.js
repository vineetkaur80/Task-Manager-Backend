const express = require('express');
const { body } = require('express-validator');
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
} = require('../controllers/project.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── Validation Rules ─────────────────────────────────────────────────────────
const createProjectValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Project name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description max 500 characters'),
  body('deadline')
    .optional({ nullable: true })
    .isISO8601().withMessage('Deadline must be a valid date'),
];

const updateProjectValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('status')
    .optional()
    .isIn(['active', 'completed', 'on-hold', 'archived'])
    .withMessage('Invalid status'),
  body('deadline')
    .optional({ nullable: true })
    .isISO8601().withMessage('Deadline must be a valid date'),
];

const addMemberValidation = [
  body('userId').notEmpty().withMessage('userId is required').isMongoId().withMessage('Invalid userId'),
  body('role')
    .optional()
    .isIn(['admin', 'member']).withMessage('Role must be admin or member'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
router.post('/', createProjectValidation, validate, createProject);
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProjectValidation, validate, updateProject);
router.delete('/:id', deleteProject);

// Member management
router.post('/:id/members', addMemberValidation, validate, addMember);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;
