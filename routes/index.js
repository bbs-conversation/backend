const express = require('express');
const router = express.Router();

const statusRoutes = require('./status');

router.use('/', statusRoutes);

module.exports = router;
