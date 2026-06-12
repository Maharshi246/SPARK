/**
 * Global Error Handling Middleware
 * Catches unhandled exceptions and MongoDB-specific errors,
 * formatting them into clean JSON responses to prevent app crashes and data leaks.
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error to console for dev debugging
  console.error(err);

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new Error(message);
    error.statusCode = 400;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const message = 'Not authorized to access this route';
    error = new Error(message);
    error.statusCode = 401;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
