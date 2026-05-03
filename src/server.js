require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
    console.log(`📖 Swagger Docs: http://localhost:${PORT}/api/docs`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health\n`);
  });
});
