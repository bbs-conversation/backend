const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };

  error.message = err.message;

  // log to console for developer
  if (process.env.NODE_ENV === 'development') {
    console.log(err);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    code: res.statusCode,
    message: error.message || 'Server Error',
  });
};

module.exports = errorHandler;
