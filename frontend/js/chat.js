const token = localStorage.getItem('synch_token');
const currentUser = JSON.parse(localStorage.getItem('synch_user') || '{}');

if (!token) {
  window.location.href = 'login.html';
}

let chats = [];
let currentChat = null;
let messages = [];
let replyingTo = null;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingInterval = null;
let typingTimeout = null;
let contextMenuMessage = null;

const elements = {
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  chatList: document.getElementById('chatList'),
  mainContent: document.getElementById('mainContent'),
  noChatSelected: document.getElementById('noChatSelected'),
  chatView: document.getElementById('chatView'),
  chatAvatar: document.getElementById('chatAvatar'),
  chatName: document.getElementById('chatName'),
  chatStatus: document.getElementById('chatStatus'),
  messagesContainer: document.getElementById('messagesContainer'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  searchChats: document.getElementById('searchChats'),
  typingIndicator: document.getElementById('typingIndicator'),
  typingText: document.getElementById('typingText'),
  replyPreview: document.getElementById('replyPreview'),
  replyName: document.getElementById('replyName'),
  replyText: document.getElementById('replyText'),
  contextMenu: document.getElementById('contextMenu'),
  reactionMenu: document.getElementById('reactionMenu'),
  newChatModal: document.getElementById('newChatModal'),
  userList: document.getElementById('userList'),
  voiceRecorder: document.getElementById('voiceRecorder'),
  recordTime: document.getElementById('recordTime'),
  emojiPickerPanel: document.getElementById('emojiPickerPanel'),
  imageInput: document.getElementById('imageInput'),
  imagePreviewModal: document.getElementById('imagePreviewModal'),
  previewImage: document.getElementById('previewImage'),
  profilePopup: document.getElementById('profilePopup'),
  headerAvatar: document.getElementById('headerAvatar'),
  popupAvatar: document.getElementById('popupAvatar'),
  popupUsername: document.getElementById('popupUsername'),
  popupSynchId: document.getElementById('popupSynchId')
};

// Initialize header avatar
function initHeaderAvatar() {
  if (elements.headerAvatar) {
    elements.headerAvatar.textContent = getInitials(currentUser.username);
    if (currentUser.avatar) {
      elements.headerAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.username}">`;
    }
  }
  if (elements.popupAvatar) {
    elements.popupAvatar.textContent = getInitials(currentUser.username);
    if (currentUser.avatar) {
      elements.popupAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.username}">`;
    }
  }
  if (elements.popupUsername) {
    elements.popupUsername.textContent = currentUser.username;
  }
  if (elements.popupSynchId) {
    elements.popupSynchId.textContent = currentUser.synchId || 'Loading...';
  }
}

initHeaderAvatar();

// Profile popup handlers
document.getElementById('profileBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  elements.profilePopup.classList.toggle('active');
});

document.addEventListener('click', (e) => {
  if (!elements.profilePopup?.contains(e.target) && e.target.id !== 'profileBtn') {
    elements.profilePopup?.classList.remove('active');
  }
});

document.getElementById('copySynchId')?.addEventListener('click', () => {
  navigator.clipboard.writeText(currentUser.synchId || '');
  showToast('SYNCH ID copied!', 'success');
  elements.profilePopup.classList.remove('active');
});

document.getElementById('addBySynchId')?.addEventListener('click', () => {
  elements.profilePopup.classList.remove('active');
  openModal('addSynchIdModal');
  document.getElementById('synchIdInput').value = '';
  document.getElementById('synchIdResult').innerHTML = '';
});

function showPageLoading(text) {
  document.getElementById('pageLoadingText').textContent = text || 'Loading...';
  document.getElementById('pageLoadingOverlay').classList.add('active');
}

document.getElementById('signOutBtn')?.addEventListener('click', async () => {
  showPageLoading('Signing out...');

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (e) {}

  setTimeout(() => {
    localStorage.clear();
    window.location.href = 'login.html';
  }, 800);
});

// SYNCH ID search
document.getElementById('findSynchIdBtn')?.addEventListener('click', async () => {
  const synchId = document.getElementById('synchIdInput').value.trim().toUpperCase();
  const resultDiv = document.getElementById('synchIdResult');

  if (!synchId) {
    showToast('Please enter a SYNCH ID', 'error');
    return;
  }

  resultDiv.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

  try {
    const data = await fetchAPI(`/api/users/synch/${synchId}`);

    resultDiv.innerHTML = `
      <div class="user-item" style="background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="startChatWithUser(${data.user._id})">
        <div class="avatar">${data.user.avatar ? `<img src="${data.user.avatar}">` : getInitials(data.user.username)}</div>
        <div style="flex: 1;">
          <div style="font-weight: 500;">${escapeHtml(data.user.username)}</div>
          <div style="font-size: var(--font-xs); color: var(--accent); font-family: monospace;">${data.user.synchId}</div>
        </div>
        <span style="color: var(--accent); font-size: var(--font-sm);">Start Chat →</span>
      </div>
    `;
  } catch (error) {
    resultDiv.innerHTML = `<p style="color: var(--danger); font-size: var(--font-sm); text-align: center; padding: 16px;">User not found</p>`;
  }
});

window.startChatWithUser = async function(userId) {
  try {
    const data = await fetchAPI('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: userId, type: 'private' })
    });

    closeModal('addSynchIdModal');
    await loadChats();
    selectChat(data.chat._id);
  } catch (error) {
    showToast('Failed to start chat', 'error');
  }
};

// Mobile back button - go back to chat list
document.getElementById('backToChatsBtn')?.addEventListener('click', () => {
  document.querySelector('.chat-app').classList.remove('chat-open');
  currentChat = null;
  elements.noChatSelected.style.display = 'flex';
  elements.chatView.style.display = 'none';
});

// New chat button in mobile empty state
document.getElementById('newChatBtnMobile')?.addEventListener('click', () => {
  openModal('newChatModal');
  loadUsers();
});

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Request failed');
  }

  return response.json();
}

async function loadChats() {
  try {
    const data = await fetchAPI('/api/chats');
    chats = data.chats;
    renderChatList();
  } catch (error) {
    showToast('Failed to load chats', 'error');
  }
}

function renderChatList(filter = '') {
  const filteredChats = chats.filter(chat => {
    const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
    const name = chat.type === 'group' ? chat.name : otherParticipant?.username;
    return name?.toLowerCase().includes(filter.toLowerCase());
  });

  if (filteredChats.length === 0) {
    elements.chatList.innerHTML = `
      <div class="empty-state">
        <p>${filter ? 'No chats found' : 'No conversations yet'}</p>
      </div>
    `;
    return;
  }

  elements.chatList.innerHTML = filteredChats.map(chat => {
    const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
    const name = chat.type === 'group' ? chat.name : otherParticipant?.username;
    const avatar = chat.type === 'group' ? chat.avatar : otherParticipant?.avatar;
    const status = otherParticipant?.status || 'offline';
    const lastMessage = chat.lastMessage;
    const preview = lastMessage
      ? (lastMessage.type === 'voice' ? '🎤 Voice message' :
         lastMessage.type === 'image' ? '🖼️ Image' :
         lastMessage.content || '')
      : 'No messages yet';

    return `
      <div class="chat-item ${currentChat?._id === chat._id ? 'active' : ''}" data-chat-id="${chat._id}">
        <div class="chat-item-avatar">
          <div class="avatar">
            ${avatar ? `<img src="${avatar}" alt="${name}">` : getInitials(name)}
          </div>
          <div class="status-indicator ${status}"></div>
        </div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-item-name">${escapeHtml(name)}</span>
            <span class="chat-time">${lastMessage ? formatTime(lastMessage.createdAt) : ''}</span>
          </div>
          <div class="chat-preview">${escapeHtml(preview.substring(0, 40))}</div>
        </div>
      </div>
    `;
  }).join('');

  elements.chatList.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => selectChat(item.dataset.chatId));
  });
}

async function selectChat(chatId) {
  // Convert to number for comparison since backend returns numbers
  const numericId = parseInt(chatId);
  const chat = chats.find(c => c._id === numericId || c._id === chatId);
  if (!chat) return;

  if (currentChat) {
    leaveChat(currentChat._id);
  }

  currentChat = chat;
  joinChat(chatId);

  const otherParticipant = chat.participants.find(p => p._id !== currentUser._id);
  const name = chat.type === 'group' ? chat.name : otherParticipant?.username;
  const status = otherParticipant?.status || 'offline';

  elements.chatAvatar.textContent = getInitials(name);
  if (otherParticipant?.avatar) {
    elements.chatAvatar.innerHTML = `<img src="${otherParticipant.avatar}" alt="${name}">`;
  }
  elements.chatName.textContent = name;
  elements.chatStatus.textContent = status === 'online' ? 'Online' : `Last seen ${formatLastSeen(otherParticipant?.lastSeen)}`;
  elements.chatStatus.className = `chat-header-status ${status}`;

  elements.noChatSelected.style.display = 'none';
  elements.chatView.style.display = 'flex';

  // Add chat-open class for mobile layout
  document.querySelector('.chat-app').classList.add('chat-open');

  renderChatList();
  await loadMessages();
}

async function loadMessages() {
  if (!currentChat) return;

  elements.messagesContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

  try {
    const data = await fetchAPI(`/api/chats/${currentChat._id}/messages`);
    messages = data.messages;
    renderMessages();
    scrollToBottom();
  } catch (error) {
    showToast('Failed to load messages', 'error');
  }
}

function renderMessages() {
  const user = currentUser;
  const bubbleStyle = localStorage.getItem('synch_bubbleStyle') || 'modern';

  elements.messagesContainer.innerHTML = messages.map(msg => {
    const isSent = msg.sender._id === user._id;
    const isDeleted = msg.deleted;

    if (isDeleted) {
      return `
        <div class="message ${isSent ? 'sent' : ''}" data-message-id="${msg._id}">
          <div class="message-content">
            <div class="message-bubble message-deleted" data-style="${bubbleStyle}">
              <span class="message-text">Message deleted</span>
            </div>
          </div>
        </div>
      `;
    }

    let content = '';

    if (msg.replyTo) {
      content += `
        <div class="message-reply">
          <strong>${escapeHtml(msg.replyTo.sender?.username || 'User')}</strong>
          <p>${escapeHtml(msg.replyTo.content?.substring(0, 50) || '')}</p>
        </div>
      `;
    }

    if (msg.type === 'text') {
      content += `<span class="message-text">${linkify(msg.content)}</span>`;
    } else if (msg.type === 'image') {
      content += `
        <div class="message-media">
          <img src="${msg.mediaUrl}" alt="Image" onclick="openImagePreview('${msg.mediaUrl}')">
        </div>
        ${msg.content ? `<span class="message-text">${linkify(msg.content)}</span>` : ''}
      `;
    } else if (msg.type === 'voice') {
      const duration = msg.mediaDuration || 0;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      content += `
        <div class="message-voice">
          <button class="voice-play-btn" onclick="playVoiceMessage(this, '${msg.mediaUrl}')">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <div class="voice-waveform">
            ${Array(15).fill().map(() => `<div class="voice-bar" style="height: ${Math.random() * 20 + 8}px"></div>`).join('')}
          </div>
          <span class="voice-duration">${minutes}:${seconds.toString().padStart(2, '0')}</span>
        </div>
      `;
    }

    const reactions = msg.reactions?.length > 0
      ? `<div class="message-reactions">
          ${groupReactions(msg.reactions).map(r =>
            `<span class="message-reaction" onclick="toggleReaction('${msg._id}', '${r.emoji}')">${r.emoji} ${r.count}</span>`
          ).join('')}
        </div>`
      : '';

    return `
      <div class="message ${isSent ? 'sent' : ''}" data-message-id="${msg._id}">
        ${!isSent ? `<div class="message-avatar avatar avatar-sm">${getInitials(msg.sender.username)}</div>` : ''}
        <div class="message-content">
          <div class="message-bubble" data-style="${bubbleStyle}">
            ${content}
          </div>
          <div class="message-meta">
            <span>${formatMessageTime(msg.createdAt)}</span>
            ${msg.edited ? '<span>(edited)</span>' : ''}
          </div>
          ${reactions}
        </div>
      </div>
    `;
  }).join('');

  elements.messagesContainer.querySelectorAll('.message').forEach(el => {
    el.addEventListener('contextmenu', (e) => showContextMenu(e, el.dataset.messageId));

    let touchTimer;
    el.addEventListener('touchstart', (e) => {
      touchTimer = setTimeout(() => showContextMenu(e, el.dataset.messageId), 500);
    });
    el.addEventListener('touchend', () => clearTimeout(touchTimer));
    el.addEventListener('touchmove', () => clearTimeout(touchTimer));
  });
}

function groupReactions(reactions) {
  const grouped = {};
  reactions.forEach(r => {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0 };
    }
    grouped[r.emoji].count++;
  });
  return Object.values(grouped);
}

function scrollToBottom() {
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showContextMenu(e, messageId) {
  e.preventDefault();

  contextMenuMessage = messages.find(m => m._id === messageId);
  if (!contextMenuMessage) return;

  const isSent = contextMenuMessage.sender._id === currentUser._id;

  elements.contextMenu.querySelector('[data-action="edit"]').style.display = isSent ? 'flex' : 'none';
  elements.contextMenu.querySelector('[data-action="delete"]').style.display = isSent ? 'flex' : 'none';

  const x = e.clientX || e.touches?.[0]?.clientX || 0;
  const y = e.clientY || e.touches?.[0]?.clientY || 0;

  const menuWidth = 180;
  const menuHeight = 250;

  elements.contextMenu.style.left = `${Math.min(x, window.innerWidth - menuWidth - 10)}px`;
  elements.contextMenu.style.top = `${Math.min(y, window.innerHeight - menuHeight - 10)}px`;
  elements.contextMenu.classList.add('active');
}

function hideContextMenu() {
  elements.contextMenu.classList.remove('active');
  elements.reactionMenu.classList.remove('active');
}

document.addEventListener('click', hideContextMenu);

elements.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;

    if (!contextMenuMessage) return;

    switch (action) {
      case 'reply':
        replyingTo = contextMenuMessage;
        elements.replyPreview.classList.add('active');
        elements.replyName.textContent = contextMenuMessage.sender.username;
        elements.replyText.textContent = contextMenuMessage.content || 'Media';
        elements.messageInput.focus();
        break;

      case 'copy':
        navigator.clipboard.writeText(contextMenuMessage.content || '');
        showToast('Copied to clipboard', 'success');
        break;

      case 'react':
        const rect = elements.contextMenu.getBoundingClientRect();
        elements.reactionMenu.style.left = `${rect.left}px`;
        elements.reactionMenu.style.top = `${rect.bottom + 8}px`;
        elements.reactionMenu.classList.add('active');
        return;

      case 'edit':
        elements.messageInput.value = contextMenuMessage.content;
        elements.messageInput.focus();
        elements.messageInput.dataset.editing = contextMenuMessage._id;
        elements.sendBtn.disabled = false;
        break;

      case 'delete':
        if (confirm('Delete this message?')) {
          deleteMessage(contextMenuMessage._id);
        }
        break;
    }

    hideContextMenu();
  });
});

elements.reactionMenu.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (contextMenuMessage) {
      addReaction(contextMenuMessage._id, btn.dataset.emoji);
    }
    hideContextMenu();
  });
});

function toggleReaction(messageId, emoji) {
  addReaction(messageId, emoji);
}

document.getElementById('cancelReply').addEventListener('click', () => {
  replyingTo = null;
  elements.replyPreview.classList.remove('active');
});

elements.messageInput.addEventListener('input', () => {
  const hasContent = elements.messageInput.value.trim().length > 0;
  elements.sendBtn.disabled = !hasContent;

  elements.messageInput.style.height = 'auto';
  elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 120) + 'px';

  if (currentChat) {
    startTyping(currentChat._id);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => stopTyping(currentChat._id), 2000);
  }
});

elements.messageInput.addEventListener('keydown', (e) => {
  const settings = JSON.parse(localStorage.getItem('synch_settings') || '{}');
  const enterToSend = settings.enterToSend !== false;

  if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
    e.preventDefault();
    sendMessageHandler();
  }
});

elements.sendBtn.addEventListener('click', sendMessageHandler);

async function sendMessageHandler() {
  const content = elements.messageInput.value.trim();
  if (!content || !currentChat) return;

  const editingId = elements.messageInput.dataset.editing;

  if (editingId) {
    editMessage(editingId, content);
    delete elements.messageInput.dataset.editing;
  } else {
    const messageData = {
      chatId: currentChat._id,
      content,
      type: 'text',
      replyTo: replyingTo?._id || null
    };

    sendMessage(messageData);
  }

  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
  elements.sendBtn.disabled = true;
  replyingTo = null;
  elements.replyPreview.classList.remove('active');
}

document.getElementById('attachImage').addEventListener('click', () => {
  elements.imageInput.click();
});

elements.imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentChat) return;

  const formData = new FormData();
  formData.append('media', file);
  formData.append('chatId', currentChat._id);
  formData.append('type', 'image');

  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    showToast('Image sent', 'success');
  } catch (error) {
    showToast('Failed to send image', 'error');
  }

  e.target.value = '';
});

document.getElementById('recordVoice').addEventListener('click', toggleVoiceRecording);
document.getElementById('cancelRecord').addEventListener('click', cancelRecording);

async function toggleVoiceRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      await sendVoiceMessage(blob);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    recordingStartTime = Date.now();

    elements.voiceRecorder.classList.add('active');
    elements.messageInput.style.display = 'none';

    recordingInterval = setInterval(updateRecordingTime, 1000);
    updateRecordingTime();
  } catch (error) {
    showToast('Could not access microphone', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingInterval);
    elements.voiceRecorder.classList.remove('active');
    elements.messageInput.style.display = 'block';
  }
}

function cancelRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recordedChunks = [];
    clearInterval(recordingInterval);
    elements.voiceRecorder.classList.remove('active');
    elements.messageInput.style.display = 'block';

    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }
}

function updateRecordingTime() {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  elements.recordTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function sendVoiceMessage(blob) {
  if (!currentChat || recordedChunks.length === 0) return;

  const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
  const formData = new FormData();
  formData.append('media', blob, 'voice.webm');
  formData.append('chatId', currentChat._id);
  formData.append('type', 'voice');
  formData.append('mediaDuration', duration);

  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    showToast('Voice message sent', 'success');
  } catch (error) {
    showToast('Failed to send voice message', 'error');
  }
}

let currentAudio = null;

window.playVoiceMessage = function(btn, url) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const audio = new Audio(url);
  currentAudio = audio;

  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

  audio.play();

  audio.onended = () => {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    currentAudio = null;
  };
};

document.getElementById('emojiPicker').addEventListener('click', (e) => {
  e.stopPropagation();
  elements.emojiPickerPanel.classList.toggle('active');
});

createEmojiPicker('emojiGrid', (emoji) => {
  elements.messageInput.value += emoji;
  elements.messageInput.focus();
  elements.sendBtn.disabled = false;
  elements.emojiPickerPanel.classList.remove('active');
});

document.addEventListener('click', (e) => {
  if (!elements.emojiPickerPanel.contains(e.target) && e.target.id !== 'emojiPicker') {
    elements.emojiPickerPanel.classList.remove('active');
  }
});

window.openImagePreview = function(url) {
  elements.previewImage.src = url;
  elements.imagePreviewModal.classList.add('active');
};

document.getElementById('closeImagePreview').addEventListener('click', () => {
  elements.imagePreviewModal.classList.remove('active');
});

elements.imagePreviewModal.addEventListener('click', (e) => {
  if (e.target === elements.imagePreviewModal) {
    elements.imagePreviewModal.classList.remove('active');
  }
});

document.getElementById('newChatBtn').addEventListener('click', () => {
  openModal('newChatModal');
  loadUsers();
});

document.getElementById('closeNewChatModal').addEventListener('click', () => {
  closeModal('newChatModal');
});

document.getElementById('searchUsers').addEventListener('input', (e) => {
  loadUsers(e.target.value);
});

async function loadUsers(search = '') {
  try {
    const data = await fetchAPI(`/api/users?search=${encodeURIComponent(search)}`);

    if (data.users.length === 0) {
      elements.userList.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
      return;
    }

    elements.userList.innerHTML = data.users.map(user => `
      <div class="user-item" data-user-id="${user._id}">
        <div class="avatar">${user.avatar ? `<img src="${user.avatar}">` : getInitials(user.username)}</div>
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(user.username)}</div>
          <div class="user-item-synch-id">${user.synchId || ''}</div>
        </div>
      </div>
    `).join('');

    elements.userList.querySelectorAll('.user-item').forEach(item => {
      item.addEventListener('click', () => startNewChat(item.dataset.userId));
    });
  } catch (error) {
    showToast('Failed to load users', 'error');
  }
}

async function startNewChat(userId) {
  try {
    const data = await fetchAPI('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: userId, type: 'private' })
    });

    closeModal('newChatModal');
    await loadChats();
    selectChat(data.chat._id);
  } catch (error) {
    showToast('Failed to start chat', 'error');
  }
}

elements.searchChats.addEventListener('input', (e) => {
  renderChatList(e.target.value);
});

// Socket event handlers
function onSocketConnected() {
  loadChats();
}

function onSocketDisconnected() {
  showToast('Connection lost. Reconnecting...', 'warning');
}

function onNewMessage(message) {
  if (message.chat === currentChat?._id) {
    messages.push(message);
    renderMessages();
    scrollToBottom();

    if (message.sender._id !== currentUser._id) {
      markMessagesAsRead([message._id], currentChat._id);
    }
  }

  loadChats();

  const settings = JSON.parse(localStorage.getItem('synch_settings') || '{}');
  if (settings.messageSound !== false && message.sender._id !== currentUser._id) {
    playNotificationSound();
  }
}

function onMessageEdited(message) {
  const index = messages.findIndex(m => m._id === message._id);
  if (index !== -1) {
    messages[index] = message;
    renderMessages();
  }
}

function onMessageDeleted(data) {
  const index = messages.findIndex(m => m._id === data.messageId);
  if (index !== -1) {
    messages[index].deleted = true;
    messages[index].content = '';
    renderMessages();
  }
}

function onMessageReacted(data) {
  const index = messages.findIndex(m => m._id === data.messageId);
  if (index !== -1) {
    messages[index].reactions = data.reactions;
    renderMessages();
  }
}

function onTypingStart(data) {
  if (data.chatId === currentChat?._id && data.userId !== currentUser._id) {
    elements.typingIndicator.style.display = 'flex';
    elements.typingText.textContent = `${data.username} is typing...`;
  }
}

function onTypingStop(data) {
  if (data.chatId === currentChat?._id) {
    elements.typingIndicator.style.display = 'none';
  }
}

function onUserStatusChange(data) {
  const chat = chats.find(c =>
    c.participants.some(p => p._id === data.userId)
  );

  if (chat) {
    const participant = chat.participants.find(p => p._id === data.userId);
    if (participant) {
      participant.status = data.status;
      participant.lastSeen = data.lastSeen;
    }

    if (currentChat?._id === chat._id) {
      const otherParticipant = currentChat.participants.find(p => p._id !== currentUser._id);
      if (otherParticipant && otherParticipant._id === data.userId) {
        elements.chatStatus.textContent = data.status === 'online' ? 'Online' : `Last seen ${formatLastSeen(data.lastSeen)}`;
        elements.chatStatus.className = `chat-header-status ${data.status}`;
      }
    }

    renderChatList();
  }
}

function onMessageNotification(data) {
  const settings = JSON.parse(localStorage.getItem('synch_settings') || '{}');

  if (settings.desktopNotifications !== false && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      const otherParticipant = data.chat.participants.find(p => p._id !== currentUser._id);
      new Notification(otherParticipant?.username || 'New Message', {
        body: settings.messagePreview !== false ? data.message.content : 'New message'
      });
    }
  }
}

function playNotificationSound() {
  const audio = new Audio('/assets/audio/notification.mp3');
  const volume = localStorage.getItem('synch_volume') || 50;
  audio.volume = volume / 100;
  audio.play().catch(() => {});
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

initSocket();
