const express = require('express');
const { getDashboard } = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

// GET /api/dashboard
router.get('/', getDashboard);

module.exports = router;
