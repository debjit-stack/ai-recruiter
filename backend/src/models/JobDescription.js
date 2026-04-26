const mongoose = require('mongoose');

const JdSchema = new mongoose.Schema({
  text: { type: String, required: true },
  roleTitle: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  
  // backend/src/models/JobDescription.js (Snippet to update)

  gatekeeperData: {
    // We now store categories of skills (e.g., [{ name: "Language", skills: ["node", "nodejs"] }])
    coreCategories: [{
        name: String,
        skills: [String]
    }],
    // The dynamic rule: How many of these distinct categories must the candidate hit?
    mustHitCoreCategories: Number, 
    minExperienceYears: Number,
    workMode: String,
    requiredLocation: String
  },
  outreachData: {
    topSellingPoints: [String]
  },
  recruiterIntelligence: {
    screeningQuestions: [String]
  },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Jd', JdSchema);