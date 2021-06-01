const ErrorResponse = require('../utils/errorResponse');

const admin = require('../config/firebaseAdmin');

const authenticated = (req, _, next) => {
  const { authorization } = req.headers;
  if (!authorization)
    return next(new ErrorResponse(`No ID Token provided`, 400));
  if (authorization) {
    admin
      .auth()
      .verifyIdToken(authorization)
      .then((token) => {
        req.token = token;
        next();
      })
      .catch((err) => next(new ErrorResponse(err, 401)));
  }
};

module.exports = authenticated;
