const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  rawProfileText: { type: String, required: true },

  roleTitle: { type: String, required: true },

  status: {
    type: String,
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

  // AI Match Evaluation
  matchScore: { type: Number, default: null },
  matchRationale: { type: String },

  // AI Interest Evaluation (reply scoring)
  interestScore: { type: Number, default: null },
  interestRationale: { type: String },   // FIX: was missing from schema
  replySummary: { type: String },         // FIX: was missing from schema
  nonNegotiablesMet: { type: Boolean },   // FIX: was missing from schema

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Candidate', CandidateSchema);