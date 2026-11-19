const path = require('path');
const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health');
const internshipsRoutes = require('./routes/internships');
const applicationsRoutes = require('./routes/applications');
const { securityHeaders, apiLimiter, safeLogger } = require('./middleware/security');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

/**
 * Creates and configures the Express application.
 */
function createApp() {
  const app = express();

  // 1. Security Headers (Helmet, CSP, no-sniff, frame deny)
  app.use(securityHeaders);

  // 2. Cross-Origin Resource Sharing
  app.use(cors());

  // 3. Request body parsing with strict size limits (anti-DoS)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 4. Safe Logging (never logs PII/passwords/tokens)
  app.use(safeLogger);

  // 5. Serve responsive frontend static files from public/ directory
  app.use(express.static(path.join(__dirname, '../public')));
  app.use(express.static(path.join(__dirname, '..'))); // fallback

  // 6. Rate Limiting on API routes
  app.use('/api', apiLimiter);

  // 7. Core REST API Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/internships', internshipsRoutes);
  app.use('/api/applications', applicationsRoutes);

  // 8. 404 handler for unmatched routes
  app.use(notFoundHandler);

  // 9. Centralized Error Handler (standardized error envelope)
  app.use(globalErrorHandler);

  return app;
}

module.exports = createApp;
