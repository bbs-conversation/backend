const express = require('express');
const router = express.Router();

const statusRoutes = require('./status');
const authRoutes = require('./auth');

router.use('/', statusRoutes);
router.use('/auth', authRoutes);

module.exports = router;
