const { Chat, Message, User, pool } = require('../database');

exports.getChats = async (req, res) => {
  try {
    const chats = (await Chat.findByUserId(req.user.id)).map(chat => ({
      _id: chat.id,
      type: chat.type,
      name: chat.name,
      participants: chat.participants,
      lastMessage: chat.lastMessage,
      updatedAt: chat.updated_at
    }));

    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Error fetching chats' });
  }
};

exports.getChat = async (req, res) => {
  try {
    const chat = await Chat.findById(parseInt(req.params.chatId));

    if (!chat || !(await Chat.isParticipant(chat.id, req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
      chat: {
        _id: chat.id,
        type: chat.type,
        name: chat.name,
        participants: chat.participants,
        updatedAt: chat.updated_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching chat' });
  }
};

exports.createChat = async (req, res) => {
  try {
    const { participantId, type, name } = req.body;

    if (type === 'private' || !type) {
      const existingChat = await Chat.findPrivateChat(req.user.id, parseInt(participantId));

      if (existingChat) {
        return res.json({
          chat: {
            _id: existingChat.id,
            type: existingChat.type,
            name: existingChat.name,
            participants: existingChat.participants,
            updatedAt: existingChat.updated_at
          }
        });
      }
    }

    const chat = await Chat.create(type || 'private', name || null, type === 'group' ? req.user.id : null);

    await Chat.addParticipant(chat.id, req.user.id);

    if (type === 'group' && req.body.participants) {
      for (const id of req.body.participants) {
        await Chat.addParticipant(chat.id, parseInt(id));
      }
    } else {
      await Chat.addParticipant(chat.id, parseInt(participantId));
    }

    const fullChat = await Chat.findById(chat.id);

    res.status(201).json({
      chat: {
        _id: fullChat.id,
        type: fullChat.type,
        name: fullChat.name,
        participants: fullChat.participants,
        updatedAt: fullChat.updated_at
      }
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Error creating chat' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    if (!(await Chat.isParticipant(parseInt(chatId), req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = (await Message.findByChatId(parseInt(chatId), parseInt(limit), before))
      .map(msg => Message.toJSON(msg));

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Error fetching messages' });
  }
};

exports.searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q } = req.query;

    if (!(await Chat.isParticipant(parseInt(chatId), req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = (await Message.search(parseInt(chatId), q)).map(msg => Message.toJSON(msg));

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Error searching messages' });
  }
};

exports.clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!(await Chat.isParticipant(parseInt(chatId), req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await pool.query('DELETE FROM messages WHERE chat_id = $1', [parseInt(chatId)]);
    await pool.query('UPDATE chats SET last_message_id = NULL WHERE id = $1', [parseInt(chatId)]);

    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing chat' });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!(await Chat.isParticipant(parseInt(chatId), req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await Chat.delete(parseInt(chatId));

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting chat' });
  }
};

exports.exportChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(parseInt(chatId));

    if (!chat || !(await Chat.isParticipant(chat.id, req.user.id))) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await Message.findByChatId(chat.id, 1000);

    const exportData = {
      chat: {
        type: chat.type,
        name: chat.name,
        participants: chat.participants.map(p => p.username),
        exportedAt: new Date()
      },
      messages: messages.map(m => ({
        sender: m.sender.username,
        type: m.type,
        content: m.content,
        timestamp: m.created_at
      }))
    };

    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: 'Error exporting chat' });
  }
};
