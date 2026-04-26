const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  rawProfileText: { type: String, required: true },
  
  // Tagged to a specific Job Description
  roleTitle: { type: String, required: true },
  
  // Pipeline Tracking
  status: { 
    type: String, 
    // 👇 THE FIX: The strict list of all allowed statuses in our new pipeline
    enum: [
      'Pending Scoring', 
      'Scored', 
      'Scoring Failed', 
      'Skipped - Mismatch', 
      'Outreach Sent', 
      'Replied'
    ], 
    default: 'Pending Scoring' 
  },
  
  // AI Evaluations
  matchScore: { type: Number, default: null },
  matchRationale: { type: String },
  interestScore: { type: Number, default: null },
  replySummary: { type: String },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Candidate', CandidateSchema);