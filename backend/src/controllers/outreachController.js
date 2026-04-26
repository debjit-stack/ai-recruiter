const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const Candidate = require('../models/Candidate');
const Jd = require('../models/JobDescription');
const { scoreInterest, draftPersonalizedEmail } = require('../services/aiService');

exports.sendOutreach = async (req, res) => {
  try {
    const { candidateIds } = req.body;
    const candidates = await Candidate.find({ _id: { $in: candidateIds } });

    // Fetch the JD that matches the first candidate's role (much safer than just picking the last one!)
    const targetRole = candidates.length > 0 ? candidates[0].roleTitle : 'Uncategorized Role';
    const activeJd = await Jd.findOne({ roleTitle: targetRole, isActive: true }) || await Jd.findOne().sort({ createdAt: -1 });

    // Fallback object just in case your database is empty
    const safeJd = activeJd || { roleTitle: targetRole, outreachData: { topSellingPoints: [] } };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    for (const candidate of candidates) {
      if (candidate.status === 'Scored' || candidate.status === 'Pending') {
        
        console.log(`✍️ AI is drafting a personalized email for ${candidate.name}...`);
        
        // 👇 THE FIX: Pass the full objects into the AI Service
        const customEmailBody = await draftPersonalizedEmail(candidate, safeJd);

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: candidate.email,
          subject: `${candidate.roleTitle} Opportunity - ${candidate.name}`,
          text: customEmailBody
        };

        await transporter.sendMail(mailOptions);
        
        candidate.status = 'Outreach Sent';
        await candidate.save();
        
        console.log(`✅ Sent custom outreach to: ${candidate.email}`);

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    res.json({ message: `Successfully drafted and sent personalized outreach to ${candidates.length} candidates.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send outreach', details: error.message });
  }
};

exports.syncReplies = async (req, res) => {
  try {
    console.log("Checking inbox for new replies...");

    // 1. Configure the IMAP Connection to Gmail
    const config = {
      imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_APP_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 5000,
        tlsOptions: { rejectUnauthorized: false } // Prevents strict SSL crashes
      }
    };

    // 2. Connect and open the Inbox
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // 3. Search for UNREAD emails
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: [''], markSeen: true }; // '' fetches the whole raw email
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    let processedCount = 0;

    // 4. Loop through every unread email found
    for (const item of messages) {
      const all = item.parts.find(part => part.which === '');
      
      // Parse the messy raw email into clean text
      const parsed = await simpleParser(all.body);
      const senderEmail = parsed.from.value[0].address;
      const replyText = parsed.text;

      // 5. Look up the candidate in MongoDB using their email
      const candidate = await Candidate.findOne({ email: senderEmail });

      // If they exist in our DB, let Gemini analyze their reply!
      if (candidate) {
        console.log(`🧠 Analyzing reply from: ${candidate.email}`);
        
        const analysis = await scoreInterest(replyText);
        
        candidate.status = 'Replied';
        candidate.interestScore = analysis.interestScore;
        candidate.interestRationale = analysis.rationale;
        candidate.nonNegotiablesMet = analysis.nonNegotiablesMet;
        candidate.replySummary = analysis.replySummary;
        await candidate.save();
        console.log(`✅ Scored ${candidate.email}: ${analysis.interestScore}/100`);
        processedCount++;
      }
    }

    // Close the inbox connection
    connection.end();

    res.status(200).json({ message: `Successfully synced and analyzed ${processedCount} candidate replies.` });
  } catch (error) {
    console.error("Inbox Sync Error:", error.message);
    res.status(500).json({ error: "Failed to sync replies", details: error.message });
  }
};