const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(auth);

router.post('/', upload.single('media'), messageController.sendMessage);
router.put('/:messageId', messageController.editMessage);
router.delete('/:messageId', messageController.deleteMessage);
router.post('/:messageId/reaction', messageController.addReaction);
router.post('/:messageId/pin', messageController.pinMessage);
router.post('/read', messageController.markAsRead);

module.exports = router;
