import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

const createTransporter = async () => {
  if (transporter) return transporter;

  const isPlaceholder = process.env.SMTP_USER === 'your_email@gmail.com';

  // Use environment variables if provided and not placeholder
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && !isPlaceholder) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Real SMTP credentials must be configured in .env for production environments.');
    }
    // Fallback to Ethereal Email for development
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('No SMTP config found. Falling back to Ethereal Email (Dev Only).');
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.error('Failed to create ethereal email account', err);
    }
  }
  return transporter;
};

export const sendVerificationEmail = async (userEmail, verificationToken, userName) => {
  try {
    const tp = await createTransporter();
    if (!tp) {
      console.error('Email transporter not configured.');
      return;
    }

    const verifyUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const info = await tp.sendMail({
      from: process.env.EMAIL_FROM || '"SPARK Network" <noreply@spark.com>',
      to: userEmail,
      subject: 'Verify your email for SPARK',
      text: `Hello ${userName},\n\nPlease verify your email by clicking the link below:\n\n${verifyUrl}\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #d4af37;">Welcome to SPARK, ${userName}</h2>
          <p>Please verify your email address to initialize your profile.</p>
          <p style="margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
          </p>
          <p style="font-size: 12px; color: #777;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log('Verification email sent to:', userEmail);
    // If using Ethereal, log the preview URL
    if (info.messageId && nodemailer.getTestMessageUrl(info)) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

export const sendPasswordResetEmail = async (userEmail, resetToken, userName) => {
  try {
    const tp = await createTransporter();
    if (!tp) {
      console.error('Email transporter not configured.');
      return;
    }

    const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const info = await tp.sendMail({
      from: process.env.EMAIL_FROM || '"SPARK Network" <noreply@spark.com>',
      to: userEmail,
      subject: 'Password Reset Request for SPARK',
      text: `Hello ${userName},\n\nYou requested a password reset. Please click the link below to set a new password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #d4af37;">Password Reset, ${userName}</h2>
          <p>You requested to reset your password. Click the button below to choose a new password.</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </p>
          <p style="font-size: 12px; color: #777;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });

    console.log('Password reset email sent to:', userEmail);
    // If using Ethereal, log the preview URL
    if (info.messageId && nodemailer.getTestMessageUrl(info)) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

export const testEmailConnection = async (toEmail) => {
  try {
    const tp = await createTransporter();
    if (!tp) {
      throw new Error('Email transporter not configured.');
    }

    const info = await tp.sendMail({
      from: process.env.EMAIL_FROM || '"SPARK Network" <noreply@spark.com>',
      to: toEmail,
      subject: 'Test Email from SPARK Network',
      text: 'This is a test email to verify that the SMTP configuration is working correctly.',
      html: '<p>This is a test email to verify that the <strong>SMTP configuration</strong> is working correctly.</p>',
    });

    console.log('Test email sent to:', toEmail);
    if (info.messageId && nodemailer.getTestMessageUrl(info)) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      return { success: true, previewUrl: nodemailer.getTestMessageUrl(info) };
    }
    return { success: true };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};
