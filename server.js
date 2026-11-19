const { startServer } = require('./src/server');

// Start the server when invoked directly
if (require.main === module) {
  startServer();
}

module.exports = require('./src/server');
