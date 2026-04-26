const express = require('express');
const router = express.Router();
const multer = require('multer');

// Controllers
// Note: Ensure the file name here matches exactly what you named it (jdController or jobController)
const { saveJobDescription } = require('../controllers/jdController'); 
const { uploadCandidates, scorePendingCandidates } = require('../controllers/candidateController');
const { sendOutreach, syncReplies } = require('../controllers/outreachController');

// Multer config (stores files temporarily in memory before parsing)
const upload = multer({ dest: 'uploads/' });

// --- THE ROUTES ---

// 1. Save JD & Extract Mega-Schema (Fixed to '/jobs' to solve the 404!)
router.post('/jobs', saveJobDescription);

// 2. Upload CSV & Run Pure-JS Skill Gatekeeper (Zero Tokens)
router.post('/candidates/upload', upload.single('csvFile'), uploadCandidates);

// 3. NEW PHASE 2 ROUTE: Batch Score "Pending" Candidates
router.post('/candidates/score', scorePendingCandidates);

// 4. Send Emails to selected candidates
router.post('/outreach/send', sendOutreach);

// 5. Read inbox and score interest
router.post('/outreach/sync', syncReplies);

// 6. Delete selected candidates (Cleanup Tool)
router.post('/candidates/delete', async (req, res) => {
  try {
    const { candidateIds } = req.body;
    
    if (!candidateIds || candidateIds.length === 0) {
      return res.status(400).json({ error: "No candidate IDs provided." });
    }

    const Candidate = require('../models/Candidate');
    const result = await Candidate.deleteMany({ _id: { $in: candidateIds } });

    res.status(200).json({ message: `Successfully deleted ${result.deletedCount} candidates.` });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete candidates", details: error.message });
  }
});

// 7. Fetch all candidates for the Table
router.get('/candidates', async (req, res) => {
  try {
    const Candidate = require('../models/Candidate');
    const candidates = await Candidate.find().sort({ matchScore: -1 });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Reassign Candidate to a new Role (For the Dropdown)
router.put('/candidates/:id/role', async (req, res) => {
  try {
    const Candidate = require('../models/Candidate');
    const { roleTitle } = req.body;
    
    // Updates the role and resets the status so they go back through the AI workflow
    await Candidate.findByIdAndUpdate(req.params.id, { 
      roleTitle, 
      status: 'Pending Scoring', // Updated to match new Phase 1 naming
      matchScore: null // Explicitly null so they can be re-scored
    });
    
    res.status(200).json({ message: `Candidate moved to ${roleTitle}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;