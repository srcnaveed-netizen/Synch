const { Message, Chat } = require('../database');

exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content, type, replyTo, mediaDuration } = req.body;

    if (!(await Chat.isParticipant(parseInt(chatId), req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    let mediaUrl = null;
    if (req.file) {
      const fileType = req.file.mimetype.startsWith('image/') ? 'images' : 'audio';
      mediaUrl = `/uploads/${fileType}/${req.file.filename}`;
    }

    const message = await Message.create(
      parseInt(chatId),
      req.user.id,
      type || 'text',
      content || '',
      mediaUrl,
      mediaDuration ? parseFloat(mediaDuration) : null,
      replyTo ? parseInt(replyTo) : null
    );

    res.status(201).json({ message: Message.toJSON(message) });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(parseInt(messageId));

    if (!message || message.sender_id !== req.user.id || message.deleted) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const updated = await Message.update(parseInt(messageId), content);

    res.json({ message: Message.toJSON(updated) });
  } catch (error) {
    res.status(500).json({ error: 'Error editing message' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(parseInt(messageId));

    if (!message || message.sender_id !== req.user.id) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await Message.delete(parseInt(messageId));

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting message' });
  }
};

exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(parseInt(messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const reactions = await Message.addReaction(parseInt(messageId), req.user.id, emoji);

    res.json({ reactions });
  } catch (error) {
    res.status(500).json({ error: 'Error adding reaction' });
  }
};

exports.pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(parseInt(messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!(await Chat.isParticipant(message.chat_id, req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const pinned = await Message.togglePin(parseInt(messageId));

    res.json({ pinned });
  } catch (error) {
    res.status(500).json({ error: 'Error pinning message' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;

    await Message.markAsRead(messageIds.map(id => parseInt(id)), req.user.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error marking messages as read' });
  }
};
