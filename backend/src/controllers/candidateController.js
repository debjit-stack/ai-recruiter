const fs = require('fs');
const csv = require('csv-parser');
const Candidate = require('../models/Candidate');
const JobDescription = require('../models/JobDescription');
const { scoreCandidate } = require('../services/aiService'); 

// ==========================================
// PHASE 1: ZERO-TOKEN SEMANTIC GATEKEEPER
// ==========================================
exports.uploadCandidates = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a CSV file.' });
    }

    const currentRoleTitle = req.body.roleTitle || 'Uncategorized Role';
    const activeJd = await JobDescription.findOne({ roleTitle: currentRoleTitle, isActive: true });
    
    if (!activeJd || !activeJd.gatekeeperData || !activeJd.gatekeeperData.coreCategories) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `No valid Semantic Job Description found for: ${currentRoleTitle}. Please save the JD again to generate the new AI categories.` });
    }

    const { coreCategories, mustHitCoreCategories } = activeJd.gatekeeperData;
    
    const aiRequirement = mustHitCoreCategories || 1;
    const safeRequirement = Math.min(aiRequirement, 2); 
    
    console.log(`🧠 Semantic Gatekeeper Active! Candidates must hit >= ${safeRequirement} (capped from AI's ${aiRequirement}) of these categories:`);
    coreCategories.forEach(cat => console.log(` - ${cat.name}: [${cat.skills.join(', ')}]`));

    try {
      await Candidate.collection.dropIndexes();
      console.log('🧹 Cleaned up ALL old database strict rules!');
    } catch (err) {
      // Ignore if already clean
    }

    const rawCandidates = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        rawCandidates.push({
          name: data.Name || data.name,
          email: data.Email || data.email,
          phone: data.Phone || data.phone,
          rawProfileText: data.Profile || data.Resume || data.rawProfileText || JSON.stringify(data)
        });
      })
      .on('end', async () => {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
        
        let passedCount = 0;
        let skippedCount = 0;

        for (const candidate of rawCandidates) {
          try {
            const profileTextLower = (candidate.rawProfileText || '').toLowerCase();

            let matchedCategoriesCount = 0;
            let matchedCategoryNames = [];

            if (coreCategories && coreCategories.length > 0) {
              coreCategories.forEach(category => {
                const hasSkillInCategory = category.skills.some(skill => 
                  profileTextLower.includes(skill.toLowerCase())
                );
                
                if (hasSkillInCategory) {
                  matchedCategoriesCount++;
                  matchedCategoryNames.push(category.name);
                }
              });
            }

            const passesGatekeeper = matchedCategoriesCount >= safeRequirement;

            let finalCandidate = {
              ...candidate,
              roleTitle: currentRoleTitle,
              matchScore: null 
            };

            // 👇 THE FIX: We only touch the database IF they pass!
            if (passesGatekeeper) {
              console.log(`✅ Passed: ${candidate.name} (Hit ${matchedCategoriesCount} categories)`);
              finalCandidate.status = 'Pending Scoring'; 
              finalCandidate.matchRationale = `Passed semantic screen. Hit ${matchedCategoriesCount} core categories: ${matchedCategoryNames.join(', ')}.`;
              passedCount++;

              let matchQuery = {};
              if (finalCandidate.phone && finalCandidate.phone.trim() !== '') {
                  matchQuery.phone = finalCandidate.phone;
              } else if (finalCandidate.email && finalCandidate.email.trim() !== '') {
                  matchQuery.email = finalCandidate.email;
              } else {
                  matchQuery.name = finalCandidate.name;
              }
              matchQuery.roleTitle = currentRoleTitle;

              // Save the winning candidate to MongoDB
              await Candidate.updateOne(matchQuery, { $set: finalCandidate }, { upsert: true });

            } else {
              console.log(`⏭️ Skipped: ${candidate.name} (Only hit ${matchedCategoriesCount} categories)`);
              // We do NOT save to the database here anymore. They are gone forever.
              skippedCount++;
            }

          } catch (err) {
            console.error(`Failed to process candidate ${candidate.name}:`, err.message);
          }
        }
        
        console.log(`🚀 Upload complete! ${passedCount} passed and saved to DB, ${skippedCount} rejected and discarded.`);
        res.status(200).json({ 
            message: `Instant CSV processing complete. ${passedCount} candidates ready for AI scoring, ${skippedCount} skipped and discarded.` 
        });
      });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Server error processing CSV', details: error.message });
  }
};


// ==========================================
// PHASE 2: TOKEN-SAFE BATCH SCORING
// ==========================================
exports.scorePendingCandidates = async (req, res) => {
  try {
    const { candidateIds } = req.body;

    if (!candidateIds || candidateIds.length === 0) {
      return res.status(400).json({ error: "No candidates selected for scoring." });
    }

    const candidates = await Candidate.find({ _id: { $in: candidateIds } });

    if (candidates.length === 0) {
      return res.status(404).json({ error: "Candidates not found." });
    }

    const candidatesToScore = candidates.filter(c => c.status === 'Pending Scoring' || c.matchScore === null);
    const alreadyScoredCount = candidates.length - candidatesToScore.length;

    if (candidatesToScore.length === 0) {
      return res.status(200).json({ 
        message: `All ${candidates.length} selected candidates already have scores! No AI tokens were used.` 
      });
    }

    // 👇 THE FIX: Find ALL unique roles in the selected batch, and grab all matching JDs from the database!
    const uniqueRoles = [...new Set(candidatesToScore.map(c => c.roleTitle))];
    const jds = await JobDescription.find({ roleTitle: { $in: uniqueRoles }, isActive: true });
    
    // Create a dictionary map for lightning-fast lookups (e.g. jdMap["Backend Developer"] = "JD text...")
    const jdMap = {};
    jds.forEach(jd => { jdMap[jd.roleTitle] = jd.text; });

    console.log(`🤖 Starting Batch AI Scoring for ${candidatesToScore.length} candidates across ${uniqueRoles.length} different roles...`);

    let successCount = 0;
    let failCount = 0;

    for (const candidate of candidatesToScore) {
      try {
        const jdText = jdMap[candidate.roleTitle];

        // Safety check if the JD is missing from the database
        if (!jdText) {
          console.log(`⚠️ Skipping ${candidate.name}: No active JD found for role '${candidate.roleTitle}'`);
          failCount++;
          continue; 
        }

        console.log(`Evaluating ${candidate.name} against the ${candidate.roleTitle} rubric...`);
        
        const aiEvaluation = await scoreCandidate(jdText, candidate.rawProfileText);
        
        candidate.matchScore = aiEvaluation.matchScore;
        candidate.matchRationale = aiEvaluation.rationale;
        candidate.status = aiEvaluation.matchScore === null ? 'Scoring Failed' : 'Scored';
        
        await candidate.save();
        
        if (candidate.matchScore !== null) successCount++;
        else failCount++;

        // 2-second delay to prevent rate-limiting (429 errors)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to score ${candidate.name}:`, error.message);
        failCount++;
      }
    }

    res.status(200).json({ 
      message: `Batch Scoring Complete! ${successCount} scored, ${failCount} failed. ${alreadyScoredCount > 0 ? `(Skipped ${alreadyScoredCount} already scored)` : ''}` 
    });

  } catch (error) {
    console.error("Batch Scoring Error:", error.message);
    res.status(500).json({ error: "Server error during batch scoring.", details: error.message });
  }
};