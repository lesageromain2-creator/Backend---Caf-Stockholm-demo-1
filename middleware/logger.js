// backend/middleware/logger.js
// Request logging middleware

const logger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`➡️  ${req.method} ${req.originalUrl}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    
    console.log(
      `${statusEmoji} ${req.method} ${req.originalUrl} - ${statusCode} - ${duration}ms`
    );
  });
  
  next();
};

// Detailed logger for development
const detailedLogger = (req, res, next) => {
  const start = Date.now();
  
  console.log('\n--- Incoming Request ---');
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Query:', req.query);
  console.log('IP:', req.ip);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('\n--- Response ---');
    console.log('Status:', res.statusCode);
    console.log('Duration:', duration + 'ms');
    console.log('-------------------\n');
  });
  
  next();
};

module.exports = {
  logger,
  detailedLogger
};
