const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/', chatController.getChats);
router.post('/', chatController.createChat);
router.get('/:chatId', chatController.getChat);
router.delete('/:chatId', chatController.deleteChat);
router.get('/:chatId/messages', chatController.getMessages);
router.get('/:chatId/search', chatController.searchMessages);
router.delete('/:chatId/clear', chatController.clearChat);
router.get('/:chatId/export', chatController.exportChat);

module.exports = router;
