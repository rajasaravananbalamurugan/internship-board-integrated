require('dotenv').config();
const createApp = require('./app');
const { getDatabase, closeDatabase } = require('./db');

const PORT = process.env.PORT || 3000;
const app = createApp();

// Initialize database schema and verify connection
const db = getDatabase();

let server = null;

function startServer(port = PORT) {
  server = app.listen(port, () => {
    console.log(`🚀 Internship Board Server running at: http://localhost:${port}`);
    console.log(`📡 Endpoints:`);
    console.log(`   - GET    /api/health`);
    console.log(`   - GET    /api/internships`);
    console.log(`   - GET    /api/internships/:id`);
    console.log(`   - POST   /api/internships`);
    console.log(`   - POST   /api/applications`);
    console.log(`   - GET    /api/applications`);
    console.log(`🌐 Frontend UI served at: http://localhost:${port}/`);
  });
  return server;
}

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      closeDatabase();
      console.log('Database connection closed. Process exited.');
      process.exit(0);
    });
  } else {
    closeDatabase();
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, getDatabase, closeDatabase };
