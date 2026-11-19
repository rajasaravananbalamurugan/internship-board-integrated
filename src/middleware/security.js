const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Configure Helmet with explicit security headers.
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: true
});

/**
 * General API rate limiter: max 200 requests per 15 minutes.
 * Skipped during automated tests.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

/**
 * Stricter rate limiter specifically for POST /api/applications to prevent spam/abuse.
 * Max 15 submissions per 15 minutes per IP.
 */
const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many applications submitted from this IP. Please try again later.'
  }
});

/**
 * Safe Request Logger:
 * Logs ONLY timestamp, method, sanitized path, status code, and response duration.
 * NEVER logs passwords, bearer tokens, authorization headers, or applicant PII (name, email, cover note).
 */
function safeLogger(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const sanitizedUrl = req.originalUrl.split('?')[0]; // exclude query params that might leak PII
    console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizedUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}

module.exports = {
  securityHeaders,
  apiLimiter,
  applicationLimiter,
  safeLogger
};
