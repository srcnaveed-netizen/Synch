const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/signup', authController.signup);
router.post('/signup/send-code', authController.sendSignupCode);
router.post('/signup/verify', authController.verifySignupCode);
router.post('/resend-code', authController.resendCode);
router.post('/login', authController.login);
router.post('/login/verify-2fa', authController.verifyLogin2FA);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', auth, authController.logout);
router.put('/2fa', auth, authController.toggle2FA);
router.get('/me', auth, authController.getMe);
router.put('/password', auth, authController.changePassword);
router.put('/username', auth, authController.changeUsername);
router.delete('/account', auth, authController.deleteAccount);
router.get('/sessions', auth, authController.getSessions);
router.delete('/sessions/:sessionId', auth, authController.revokeSession);

module.exports = router;
