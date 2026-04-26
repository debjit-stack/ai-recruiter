require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');

// Initialize Express
const app = express();

// Connect to Database
connectDB();

// Middleware
// 👇 THE FIX: Securely allow connections from your Vercel UI or your Localhost
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json()); // Allows Express to understand JSON bodies

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Agent Backend is running flawlessly.' });
});

// Primary API Routes
app.use('/api', require('./src/routes/api'));

// 👇 Let Render dictate the port (they dynamically assign it in production)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 AI Recruiter Backend running on port ${PORT}`);
});