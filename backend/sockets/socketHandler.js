const { Message, Chat, User } = require('../database');

const onlineUsers = new Map();

module.exports = (io) => {
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`User connected: ${user.username}`);

    onlineUsers.set(user.id, socket.id);

    await User.updateStatus(user.id, 'online');

    const userChats = await Chat.findByUserId(user.id);
    userChats.forEach(chat => {
      socket.join(`chat:${chat.id}`);
    });

    io.emit('user:status', {
      userId: user.id,
      status: 'online'
    });

    socket.on('message:send', async (data) => {
      try {
        const { chatId, content, type, replyTo, mediaUrl, mediaDuration } = data;

        if (!(await Chat.isParticipant(parseInt(chatId), user.id))) {
          return;
        }

        const message = await Message.create(
          parseInt(chatId),
          user.id,
          type || 'text',
          content || '',
          mediaUrl || null,
          mediaDuration || null,
          replyTo ? parseInt(replyTo) : null
        );

        const messageJSON = Message.toJSON(message);

        io.to(`chat:${chatId}`).emit('message:new', messageJSON);

        const chat = await Chat.findById(parseInt(chatId));
        chat.participants.forEach(participant => {
          if (participant._id !== user.id) {
            const participantSocketId = onlineUsers.get(participant._id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('message:notification', {
                message: messageJSON,
                chat: {
                  _id: chat.id,
                  participants: chat.participants
                }
              });
            }
          }
        });
      } catch (error) {
        console.error('Socket message:send error:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    socket.on('message:edit', async (data) => {
      try {
        const { messageId, content } = data;

        const message = await Message.findById(parseInt(messageId));
        if (!message || message.sender_id !== user.id) return;

        const updated = await Message.update(parseInt(messageId), content);
        const messageJSON = Message.toJSON(updated);

        io.to(`chat:${message.chat_id}`).emit('message:edited', messageJSON);
      } catch (error) {
        socket.emit('error', { message: 'Error editing message' });
      }
    });

    socket.on('message:delete', async (data) => {
      try {
        const { messageId } = data;

        const message = await Message.findById(parseInt(messageId));
        if (!message || message.sender_id !== user.id) return;

        await Message.delete(parseInt(messageId));

        io.to(`chat:${message.chat_id}`).emit('message:deleted', {
          messageId: parseInt(messageId),
          chatId: message.chat_id
        });
      } catch (error) {
        socket.emit('error', { message: 'Error deleting message' });
      }
    });

    socket.on('message:reaction', async (data) => {
      try {
        const { messageId, emoji } = data;

        const message = await Message.findById(parseInt(messageId));
        if (!message) return;

        const reactions = await Message.addReaction(parseInt(messageId), user.id, emoji);

        io.to(`chat:${message.chat_id}`).emit('message:reacted', {
          messageId: parseInt(messageId),
          reactions
        });
      } catch (error) {
        socket.emit('error', { message: 'Error adding reaction' });
      }
    });

    socket.on('typing:start', (data) => {
      socket.to(`chat:${data.chatId}`).emit('typing:start', {
        chatId: data.chatId,
        userId: user.id,
        username: user.username
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`chat:${data.chatId}`).emit('typing:stop', {
        chatId: data.chatId,
        userId: user.id
      });
    });

    socket.on('message:read', async (data) => {
      try {
        const { messageIds, chatId } = data;

        await Message.markAsRead(messageIds.map(id => parseInt(id)), user.id);

        socket.to(`chat:${chatId}`).emit('message:read', {
          messageIds,
          userId: user.id,
          readAt: new Date()
        });
      } catch (error) {
        socket.emit('error', { message: 'Error marking messages as read' });
      }
    });

    socket.on('chat:join', async (chatId) => {
      if (await Chat.isParticipant(parseInt(chatId), user.id)) {
        socket.join(`chat:${chatId}`);
      }
    });

    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.username}`);
      onlineUsers.delete(user.id);

      await User.updateStatus(user.id, 'offline');

      io.emit('user:status', {
        userId: user.id,
        status: 'offline',
        lastSeen: new Date()
      });
    });
  });
};
