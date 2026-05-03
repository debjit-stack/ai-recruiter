const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// THE FIX: Bulletproof JSON Extractor
// Ignores all conversational text (e.g., "Here is your JSON:")
// ==========================================
const sanitizeJson = (rawText) => {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  
  if (start !== -1 && end !== -1) {
    // Slice out ONLY the JSON object
    return rawText.substring(start, end + 1);
  }
  
  // Fallback
  return rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
};

// ==========================================
// 1. The Semantic Job Description Analyzer
// ==========================================
exports.analyzeJobDescription = async (jdText) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    You are an expert recruiter and semantic data mapper. Analyze the following Job Description.

    Job Description:
    "${jdText}"

    Your goal is to extract the core requirements and group them into logical "Categories" (e.g., "Backend Language", "Database", "API/Frameworks").
    For each category, you MUST include the exact skills requested PLUS all relevant synonyms, BASE WORDS, abbreviations, and implied technologies. 
    (Example: If "Express.js" is requested, the API category must include BOTH ["express.js", "express", "rest", "restful apis"]).
    (Example: If "React" is requested, include ["react", "react.js", "reactjs"]).

    Output a strict JSON object matching this exact schema:
    {
      "gatekeeperData": {
        "coreCategories": [
          {
            "name": "Category Name (e.g., Backend Language)",
            "skills": ["skill", "synonym1", "synonym2"]
          }
        ],
        "mustHitCoreCategories": 2, // Integer: Keep this LOW (1 or 2). Candidate profiles are very short 1-sentence summaries, so be highly lenient.
        "minExperienceYears": 0, 
        "workMode": "Hybrid", 
        "requiredLocation": "Any" 
      },
      "outreachData": {
        "topSellingPoints": ["point1", "point2"]
      },
      "recruiterIntelligence": {
        "screeningQuestions": ["Highly technical question 1"]
      }
    }
    `;

    const result = await model.generateContent(prompt);
    const cleanJsonText = sanitizeJson(result.response.text());
    return JSON.parse(cleanJsonText);

  } catch (error) {
    console.error("Gemini API Error (JD Analysis):", error.message);
    throw new Error("Failed to analyze Job Description. AI output invalid JSON.");
  }
};

// ==========================================
// 2. The Deep Candidate Scorer
// ==========================================
exports.scoreCandidate = async (jdText, candidateText) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    You are an elite technical recruiter. Compare this Candidate against this Job Description.

    Job Description:
    "${jdText}"

    Candidate Profile:
    "${candidateText}"

    Output a strict JSON object matching this schema:
    {
      "matchScore": 85,
      "rationale": "2-3 sentences explaining exactly why they got this score. Be brutally honest."
    }
    `;

    const result = await model.generateContent(prompt);
    const cleanJsonText = sanitizeJson(result.response.text());
    return JSON.parse(cleanJsonText);

  } catch (error) {
    console.error("Gemini API Error (Match Scoring):", error.message);
    return { 
        matchScore: null, 
        rationale: "Error evaluating candidate due to AI parsing failure. Flagged for retry." 
    };
  }
};

// ==========================================
// 3. The Personalized Email Drafter (Creative Shell Approach)
// ==========================================
exports.draftPersonalizedEmail = async (candidate, jd) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
    Draft a highly personalized, compelling outreach email to this candidate.

    Candidate Name: ${candidate.name}
    Candidate Profile Summary: ${candidate.rawProfileText}
    Job Role: ${jd.roleTitle}
    Job Selling Points: ${jd.outreachData?.topSellingPoints?.join(', ') || 'Great team, competitive salary, rapid growth.'}

    Rules:
    1. Be conversational, warm, and professional. Do not sound like a robot.
    2. Seamlessly weave in one specific, real detail from their profile summary (e.g., a specific framework, project, or achievement) to show you actually read their resume.
    3. Briefly tie their experience to our ${jd.roleTitle} role using the Job Selling Points.
    4. End with a soft Call to Action (e.g., asking for a quick chat).
    5. FORMATTING: You must output the final, ready-to-send email. 
       Start the email exactly with: "Hi ${candidate.name},"
       End the email exactly with: "Best regards,\nTalent Acquisition Team"
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Gemini API Error (Email Draft):", error.message);
    // Fallback email just in case the API goes down
    return `Hi ${candidate.name},\n\nI came across your profile and was really impressed with your background. We are currently hiring for a ${jd.roleTitle} and I think your skills would be a great fit for our team.\n\nWould you be open to a quick 10-minute chat this week to discuss?\n\nBest regards,\nTalent Acquisition Team`;
  }
};

// ==========================================
// 4. The Inbox Interest Scorer
// ==========================================
exports.scoreInterest = async (replyText) => {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    Analyze this email reply from a job candidate.

    Reply: "${replyText}"

    Output strict JSON matching this exact schema:
    {
      "interestScore": 85,
      "replySummary": "1 sentence summarizing their response",
      "interestRationale": "1-2 sentences explaining the score",
      "nonNegotiablesMet": true
    }

    Rules:
    - interestScore: 0-100 integer. High = enthusiastic and available. Low = uninterested or unavailable.
    - replySummary: short neutral summary of what they said.
    - interestRationale: why you gave that score.
    - nonNegotiablesMet: true if they expressed openness to the role, false if they declined or raised hard blockers.
    `;

    const result = await model.generateContent(prompt);
    const cleanJsonText = sanitizeJson(result.response.text());
    return JSON.parse(cleanJsonText);

  } catch (error) {
    console.error("Gemini API Error (Interest Scoring):", error.message);
    return {
      interestScore: null,
      replySummary: "Failed to analyze reply via AI.",
      interestRationale: null,
      nonNegotiablesMet: null
    };
  }
};