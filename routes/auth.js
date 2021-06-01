const express = require('express');
const admin = require('../config/firebaseAdmin');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const router = express.Router();

router.post(
  '/verify',
  asyncHandler(async (req, res, next) => {
    const { token } = req.body;
    if (!token) return next(new ErrorResponse(`No id token provided`, 400));
    else {
      admin
        .auth()
        .verifyIdToken(token)
        .then((token) => {
          res.json({
            success: true,
            code: res.statusCode,
            message: 'Token verified successfully',
            data: token,
          });
        })
        .catch((err) => {
          next(new ErrorResponse(err, 401));
        });
    }
  })
);

module.exports = router;
