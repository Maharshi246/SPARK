import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import { sendPasswordResetEmail } from '../utils/emailService.js';

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Always return the same message to prevent email enumeration
    const successMsg = 'If an account exists with that email, you will receive a reset link shortly.';

    if (!user) {
      return res.json({ success: true, message: successMsg });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    user.password_reset_token = resetToken;
    user.password_reset_expires = expires;
    await user.save();

    sendPasswordResetEmail(user.email, resetToken, user.display_name).catch(console.error);

    res.json({ success: true, message: successMsg });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const user = await User.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    // Assigning the plain text password. The Mongoose pre-save hook will hash it.
    user.password = newPassword;
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};
