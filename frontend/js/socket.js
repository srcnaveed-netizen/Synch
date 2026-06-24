let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function initSocket() {
  const token = localStorage.getItem('synch_token');

  if (!token) {
    console.error('No token found');
    return null;
  }

  // Connect to the same origin as the page
  const serverUrl = window.location.origin;

  socket = io(serverUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Connected to SYNCH server');
    reconnectAttempts = 0;

    if (typeof onSocketConnected === 'function') {
      onSocketConnected();
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);

    if (typeof onSocketDisconnected === 'function') {
      onSocketDisconnected(reason);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
    reconnectAttempts++;

    if (reconnectAttempts >= maxReconnectAttempts) {
      showToast('Connection failed. Please refresh the page.', 'error');
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    showToast(error.message || 'An error occurred', 'error');
  });

  socket.on('message:new', (message) => {
    if (typeof onNewMessage === 'function') {
      onNewMessage(message);
    }
  });

  socket.on('message:edited', (message) => {
    if (typeof onMessageEdited === 'function') {
      onMessageEdited(message);
    }
  });

  socket.on('message:deleted', (data) => {
    if (typeof onMessageDeleted === 'function') {
      onMessageDeleted(data);
    }
  });

  socket.on('message:reacted', (data) => {
    if (typeof onMessageReacted === 'function') {
      onMessageReacted(data);
    }
  });

  socket.on('message:read', (data) => {
    if (typeof onMessageRead === 'function') {
      onMessageRead(data);
    }
  });

  socket.on('message:notification', (data) => {
    if (typeof onMessageNotification === 'function') {
      onMessageNotification(data);
    }
  });

  socket.on('typing:start', (data) => {
    if (typeof onTypingStart === 'function') {
      onTypingStart(data);
    }
  });

  socket.on('typing:stop', (data) => {
    if (typeof onTypingStop === 'function') {
      onTypingStop(data);
    }
  });

  socket.on('user:status', (data) => {
    if (typeof onUserStatusChange === 'function') {
      onUserStatusChange(data);
    }
  });

  return socket;
}

function sendMessage(data) {
  if (socket && socket.connected) {
    socket.emit('message:send', data);
  }
}

function editMessage(messageId, content) {
  if (socket && socket.connected) {
    socket.emit('message:edit', { messageId, content });
  }
}

function deleteMessage(messageId) {
  if (socket && socket.connected) {
    socket.emit('message:delete', { messageId });
  }
}

function addReaction(messageId, emoji) {
  if (socket && socket.connected) {
    socket.emit('message:reaction', { messageId, emoji });
  }
}

function startTyping(chatId) {
  if (socket && socket.connected) {
    socket.emit('typing:start', { chatId });
  }
}

function stopTyping(chatId) {
  if (socket && socket.connected) {
    socket.emit('typing:stop', { chatId });
  }
}

function markMessagesAsRead(messageIds, chatId) {
  if (socket && socket.connected) {
    socket.emit('message:read', { messageIds, chatId });
  }
}

function joinChat(chatId) {
  if (socket && socket.connected) {
    socket.emit('chat:join', chatId);
  }
}

function leaveChat(chatId) {
  if (socket && socket.connected) {
    socket.emit('chat:leave', chatId);
  }
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
