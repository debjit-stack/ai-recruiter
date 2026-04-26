const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;

exports.fetchUnreadReplies = async () => {
  // Initialize the modern IMAP client
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    },
    logger: false // Set to true if you need to debug connection issues
  });

  const replies = [];

  try {
    await client.connect();
    
    // Lock the inbox so we can safely read and modify emails
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Find all emails that have NOT been marked as seen/read
      for await (let message of client.fetch({ seen: false }, { source: true, envelope: true })) {
        
        // Use mailparser to strip away HTML and extract clean text for Gemini
        const parsed = await simpleParser(message.source);
        
        replies.push({
          fromEmail: message.envelope.from[0].address,
          subject: message.envelope.subject,
          text: parsed.text, // Clean plain text
          uid: message.uid
        });
        
        // Mark the email as Read so it isn't processed again on the next sync
        await client.messageFlagsAdd(message.uid, ['\\Seen']);
      }
    } finally {
      lock.release();
    }
    
    await client.logout();
    return replies;
    
  } catch (error) {
    console.error("IMAP Sync Error:", error.message);
    throw error;
  }
};