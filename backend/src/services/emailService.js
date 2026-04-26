const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

exports.sendOutreachEmail = async (candidateEmail, subject, htmlBody) => {
  try {
    const mailOptions = {
      from: `AI Recruiter Agent <${process.env.EMAIL_USER}>`,
      to: candidateEmail,
      subject: subject,
      html: htmlBody,
    };
    
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Nodemailer Error:", error.message);
    throw error;
  }
};