import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/userModel.js';
import EnrollmentToken from '../models/enrollmentTokenModel.js';
import { logEngagementEvent, buildEventPayload } from '../services/engagementLogService.js';
import { sendVerificationEmail } from '../utils/emailService.js';

const signToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const register = async (req, res, next) => {
  try {
    const { display_name, email, password, universityToken } = req.body;

    if (!display_name || !email || !password || !universityToken) {
      return res.status(400).json({
        success: false,
        message: 'display_name, email, password, and universityToken are required',
      });
    }

    const tokenDoc = await EnrollmentToken.findOne({ token: universityToken });
    if (!tokenDoc || !tokenDoc.is_active || tokenDoc.used_by || new Date() > tokenDoc.expires_at) {
      return res.status(400).json({
        success: false,
        message: 'Invalid, used, or expired universityToken',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use',
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      display_name,
      email: normalizedEmail,
      password: hashedPassword,
      university_id: tokenDoc.university_id,
      current_layer: 'layer_1',
      layer_history: [{ layer: 'layer_1', changed_at: new Date() }],
      email_verification_token: verificationToken,
      email_verification_expires: expires
    });

    tokenDoc.used_by = user._id;
    tokenDoc.is_active = false;
    await tokenDoc.save();

    sendVerificationEmail(user.email, verificationToken, user.display_name).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      data: {
        id: user._id,
        email: user.email,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password, universityToken } = req.body;

    if (!email || !password || !universityToken) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and universityToken are required',
      });
    }

    // password is select:false in schema, so we must explicitly include it
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const tokenDoc = await EnrollmentToken.findOne({ token: universityToken });
    if (!tokenDoc || new Date() > tokenDoc.expires_at) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired universityToken',
      });
    }

    if (String(tokenDoc.university_id) !== String(user.university_id)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid university token for this account',
      });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please check your inbox or request a new verification email.',
      });
    }

    const token = signToken(String(user._id));

    req.user = { _id: user._id }; // mock req.user for buildEventPayload
    const eventPayload = buildEventPayload(req, 'session_start');
    if (eventPayload) logEngagementEvent(eventPayload).catch(() => {});

    res.json({
      success: true,
      data: {
        id: user._id,
        display_name: user.display_name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const user = await User.findOne({ 
      email_verification_token: token,
      email_verification_expires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    user.is_email_verified = true;
    user.email_verification_token = undefined;
    user.email_verification_expires = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Return generic success to prevent email enumeration
      return res.json({ success: true, message: 'If that email is registered, a verification link has been sent.' });
    }

    if (user.is_email_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.email_verification_token = verificationToken;
    user.email_verification_expires = expires;
    await user.save();

    sendVerificationEmail(user.email, verificationToken, user.display_name).catch(console.error);

    res.json({ success: true, message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    next(error);
  }
};
