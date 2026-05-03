const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // FIX: support both MONGO_URI (from .env template) and MONGODB_URI
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('No MongoDB URI found. Set MONGO_URI or MONGODB_URI in your .env file.');
    }
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;