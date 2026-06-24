const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(auth);

router.get('/', userController.getUsers);
router.get('/blocked', userController.getBlockedUsers);
router.get('/synch/:synchId', userController.findBySynchId);
router.get('/:userId', userController.getUser);
router.put('/settings', userController.updateSettings);
router.put('/avatar', upload.single('avatar'), userController.updateAvatar);
router.post('/:userId/block', userController.blockUser);
router.delete('/:userId/block', userController.unblockUser);

module.exports = router;
