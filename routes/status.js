const express = require('express');
const asyncHandler = require('../middlewares/async');
const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      code: res.statusCode(),
      message: 'API is live',
    });
  })
);

module.exports = router;
