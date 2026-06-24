const jwt = require('jsonwebtoken');
const { User, Session, VerificationCode } = require('../database');
const config = require('../config');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const generateToken = (userId) => {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
};

const pendingSignups = new Map();

exports.sendSignupCode = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const user = await User.create(username, email, password, true);
    const token = generateToken(user.id);

    await Session.create(user.id, token, req.headers['user-agent'] || 'Unknown', req.ip);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: User.toPublicJSON(user),
      skipVerification: true
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error creating account' });
  }
};

exports.verifySignupCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const pendingData = pendingSignups.get(email);

    if (!pendingData || pendingData.expiresAt < Date.now()) {
      pendingSignups.delete(email);
      return res.status(400).json({ error: 'Signup session expired. Please start over.' });
    }

    const isValid = await VerificationCode.verify(email, code, 'signup');

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const { username, password } = pendingData;
    pendingSignups.delete(email);

    const user = await User.create(username, email, password, true);
    const token = generateToken(user.id);

    await Session.create(user.id, token, req.headers['user-agent'] || 'Unknown', req.ip);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: User.toPublicJSON(user)
    });
  } catch (error) {
    console.error('Verify signup code error:', error);
    res.status(500).json({ error: 'Error verifying code' });
  }
};

exports.resendCode = async (req, res) => {
  try {
    const { email, type = 'signup' } = req.body;

    if (type === 'signup') {
      const pendingData = pendingSignups.get(email);
      if (!pendingData) {
        return res.status(400).json({ error: 'No pending signup for this email' });
      }
    } else if (type === 'reset' || type === 'login') {
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'No account found with this email' });
      }
    }

    const code = await VerificationCode.create(email, null, type);
    const emailSent = await sendVerificationEmail(email, code);

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.json({ message: 'Verification code resent' });
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ error: 'Error resending code' });
  }
};

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const user = await User.create(username, email, password);
    const token = generateToken(user.id);

    await Session.create(user.id, token, req.headers['user-agent'] || 'Unknown', req.ip);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: User.toPublicJSON(user)
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error creating account' });
  }
};

const pending2FA = new Map();

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);

    if (!user || !User.comparePassword(user, password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.two_factor_enabled) {
      const code = await VerificationCode.create(email, user.id, 'login');
      pending2FA.set(email, { userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });

      const emailSent = await sendVerificationEmail(email, code);
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send 2FA code' });
      }

      return res.json({
        message: '2FA code sent',
        requires2FA: true,
        email: email
      });
    }

    const token = generateToken(user.id);

    await Session.create(user.id, token, req.headers['user-agent'] || 'Unknown', req.ip);
    await User.updateStatus(user.id, 'online');

    const updatedUser = await User.findById(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: User.toPublicJSON(updatedUser)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
};

exports.verifyLogin2FA = async (req, res) => {
  try {
    const { email, code } = req.body;

    const pendingData = pending2FA.get(email);
    if (!pendingData || pendingData.expiresAt < Date.now()) {
      pending2FA.delete(email);
      return res.status(400).json({ error: 'Session expired. Please login again.' });
    }

    const isValid = await VerificationCode.verify(email, code, 'login');
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    pending2FA.delete(email);
    const user = await User.findById(pendingData.userId);
    const token = generateToken(user.id);

    await Session.create(user.id, token, req.headers['user-agent'] || 'Unknown', req.ip);
    await User.updateStatus(user.id, 'online');

    res.json({
      message: 'Login successful',
      token,
      user: User.toPublicJSON(user)
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Error verifying code' });
  }
};

exports.logout = async (req, res) => {
  try {
    await Session.deleteByToken(req.token);
    await User.updateStatus(req.user.id, 'offline');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error logging out' });
  }
};

exports.getMe = async (req, res) => {
  try {
    res.json({ user: User.toPublicJSON(req.user) });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!User.comparePassword(req.user, currentPassword)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await User.updatePassword(req.user.id, newPassword);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error changing password' });
  }
};

exports.changeUsername = async (req, res) => {
  try {
    const { username } = req.body;

    const existing = await User.findByUsername(username);
    if (existing && existing.id !== req.user.id) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    await User.updateUsername(req.user.id, username);
    const updatedUser = await User.findById(req.user.id);

    res.json({ message: 'Username changed successfully', user: User.toPublicJSON(updatedUser) });
  } catch (error) {
    res.status(500).json({ error: 'Error changing username' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!User.comparePassword(req.user, password)) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    await User.delete(req.user.id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting account' });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const sessions = (await Session.findByUserId(req.user.id)).map(session => ({
      id: session.id,
      device: session.device,
      ip: session.ip,
      createdAt: session.created_at,
      current: session.token === req.token
    }));

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sessions' });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await Session.deleteById(parseInt(sessionId));

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error revoking session' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.json({ message: 'If an account exists, a reset code has been sent' });
    }

    const code = await VerificationCode.create(email, user.id, 'reset');
    await sendPasswordResetEmail(email, code);

    res.json({ message: 'If an account exists, a reset code has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
};

const verifiedResetEmails = new Map();

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const isValid = await VerificationCode.verify(email, code, 'reset');
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    verifiedResetEmails.set(email, { verifiedAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000 });

    res.json({ message: 'Code verified', verified: true });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Error verifying code' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const verified = verifiedResetEmails.get(email);
    if (!verified || verified.expiresAt < Date.now()) {
      verifiedResetEmails.delete(email);
      return res.status(400).json({ error: 'Session expired. Please start over.' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.updatePassword(user.id, newPassword);
    verifiedResetEmails.delete(email);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
};

exports.toggle2FA = async (req, res) => {
  try {
    const { enabled, password } = req.body;

    if (!User.comparePassword(req.user, password)) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    await User.setTwoFactor(req.user.id, enabled);
    const updatedUser = await User.findById(req.user.id);

    res.json({
      message: enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
      user: User.toPublicJSON(updatedUser)
    });
  } catch (error) {
    console.error('Toggle 2FA error:', error);
    res.status(500).json({ error: 'Error updating 2FA settings' });
  }
};
