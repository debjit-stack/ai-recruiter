const JobDescription = require('../models/JobDescription');
const { analyzeJobDescription } = require('../services/aiService'); // Import the AI brain

exports.saveJobDescription = async (req, res) => {
  try {
    // Make sure your frontend is passing roleTitle along with the text!
    const { text, roleTitle } = req.body; 
    
    if (!text) {
      return res.status(400).json({ error: 'Job description text is required.' });
    }
    if (!roleTitle) {
      return res.status(400).json({ error: 'Role title is required.' });
    }

    console.log(`🧠 Analyzing JD for role: ${roleTitle}...`);
    
    // 1. Call Gemini ONCE to extract all the intelligence (The Mega-Prompt)
    const aiIntelligence = await analyzeJobDescription(text);

    // 👇 THE FIX: Upsert based on the specific roleTitle so different roles coexist!
    // We completely removed the global "isActive: false" wipe.
    const newJd = await JobDescription.findOneAndUpdate(
      { roleTitle: roleTitle }, // Find the existing JD by this role title
      { 
        $set: {
          text: text, 
          roleTitle: roleTitle,
          isActive: true, // Keep it active
          gatekeeperData: aiIntelligence.gatekeeperData,
          outreachData: aiIntelligence.outreachData,
          recruiterIntelligence: aiIntelligence.recruiterIntelligence
        }
      },
      { upsert: true, new: true } // If it doesn't exist, create it. If it does, update it.
    );

    console.log(`✅ JD for ${roleTitle} extracted and saved successfully!`);
    
    res.status(200).json({ 
      message: `Job Description for ${roleTitle} saved and analyzed successfully!`, 
      jd: newJd 
    });
  } catch (error) {
    console.error("Error saving JD:", error.message);
    res.status(500).json({ error: 'Server error saving JD', details: error.message });
  }
};