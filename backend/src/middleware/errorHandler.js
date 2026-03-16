const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack });

  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size limit exceeded' });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

module.exports = errorHandler;