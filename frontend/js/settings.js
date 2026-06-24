const token = localStorage.getItem('synch_token');
const currentUser = JSON.parse(localStorage.getItem('synch_user') || '{}');

if (!token) {
  window.location.href = 'login.html';
}

const elements = {
  settingsSidebar: document.getElementById('settingsSidebar'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  userAvatar: document.getElementById('userAvatar'),
  profileUsername: document.getElementById('profileUsername'),
  profileEmail: document.getElementById('profileEmail'),
  profileSynchId: document.getElementById('profileSynchId'),
  sessionsList: document.getElementById('sessionsList'),
  blockedUsersList: document.getElementById('blockedUsersList'),
  themeSelector: document.getElementById('themeSelector')
};

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function loadUserProfile() {
  elements.userAvatar.textContent = getInitials(currentUser.username);
  if (currentUser.avatar) {
    elements.userAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.username}">`;
  }
  elements.profileUsername.textContent = currentUser.username;
  elements.profileEmail.textContent = currentUser.email;
  if (elements.profileSynchId) {
    elements.profileSynchId.textContent = currentUser.synchId || 'Loading...';
  }
}

// Copy SYNCH ID
document.getElementById('copySynchIdBtn')?.addEventListener('click', () => {
  navigator.clipboard.writeText(currentUser.synchId || '');
  showToast('SYNCH ID copied!', 'success');
});

// Mobile sidebar toggle
elements.mobileMenuBtn?.addEventListener('click', () => {
  elements.settingsSidebar.classList.toggle('open');
});

// Navigation
document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;

    document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${section}-section`).classList.add('active');

    elements.settingsSidebar.classList.remove('open');
  });
});

function loadSavedSettings() {
  const settings = currentUser.settings || {};

  // Theme
  const theme = localStorage.getItem('synch_theme') || 'dark';
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });

  // Accent color
  const accentColor = localStorage.getItem('synch_accent') || '#0084FF';
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.color === accentColor);
  });

  // Font size
  const fontSize = localStorage.getItem('synch_fontSize') || 'medium';
  document.getElementById('fontSizeSelect').value = fontSize;

  // Bubble style
  const bubbleStyle = localStorage.getItem('synch_bubbleStyle') || 'modern';
  document.getElementById('bubbleStyleSelect').value = bubbleStyle;

  // Toggles
  document.getElementById('onlineStatusToggle').classList.toggle('active', settings.showOnlineStatus !== false);
  document.getElementById('readReceiptsToggle').classList.toggle('active', settings.showReadReceipts !== false);
  document.getElementById('lastSeenToggle').classList.toggle('active', settings.showLastSeen !== false);
  document.getElementById('messageSoundToggle').classList.toggle('active', settings.messageSound !== false);
  document.getElementById('desktopNotificationsToggle').classList.toggle('active', settings.desktopNotifications !== false);
  document.getElementById('enterToSendToggle').classList.toggle('active', settings.enterToSend !== false);
  document.getElementById('mediaAutoDownloadToggle').classList.toggle('active', settings.mediaAutoDownload !== false);
  document.getElementById('messagePreviewToggle').classList.toggle('active', settings.messagePreview !== false);

  // Volume
  const volume = settings.notificationVolume || 50;
  document.getElementById('volumeRange').value = volume;
  document.getElementById('volumeValue').textContent = `${volume}%`;
}

// Theme selector
document.querySelectorAll('.theme-option').forEach(option => {
  option.addEventListener('click', function() {
    document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
    this.classList.add('active');
    const theme = this.dataset.theme;
    applyTheme(theme);
    updateSetting('theme', theme);
  });
});

// Color picker
document.querySelectorAll('.color-option').forEach(option => {
  option.addEventListener('click', function() {
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
    this.classList.add('active');
    const color = this.dataset.color;
    applyAccentColor(color);
    updateSetting('accentColor', color);
  });
});

// Font size
document.getElementById('fontSizeSelect').addEventListener('change', function() {
  applyFontSize(this.value);
  updateSetting('fontSize', this.value);
});

// Bubble style
document.getElementById('bubbleStyleSelect').addEventListener('change', function() {
  localStorage.setItem('synch_bubbleStyle', this.value);
  updateSetting('bubbleStyle', this.value);
});

// Toggles
document.querySelectorAll('.toggle[data-setting]').forEach(toggle => {
  toggle.addEventListener('click', function() {
    this.classList.toggle('active');
    const setting = this.dataset.setting;
    const value = this.classList.contains('active');
    updateSetting(setting, value);

    // Save to local settings
    const settings = JSON.parse(localStorage.getItem('synch_settings') || '{}');
    settings[setting] = value;
    localStorage.setItem('synch_settings', JSON.stringify(settings));
  });
});

// Volume
document.getElementById('volumeRange').addEventListener('input', function() {
  document.getElementById('volumeValue').textContent = `${this.value}%`;
  localStorage.setItem('synch_volume', this.value);
});

document.getElementById('volumeRange').addEventListener('change', function() {
  updateSetting('notificationVolume', parseInt(this.value));
});

async function updateSetting(key, value) {
  try {
    await fetchAPI('/api/users/settings', {
      method: 'PUT',
      body: JSON.stringify({ [key]: value })
    });
  } catch (error) {
    console.error('Failed to update setting:', error);
  }
}

// Username change
document.getElementById('changeUsernameBtn').addEventListener('click', () => {
  openModal('usernameModal');
  document.getElementById('newUsername').value = currentUser.username;
});

document.getElementById('saveUsernameBtn').addEventListener('click', async () => {
  const newUsername = document.getElementById('newUsername').value.trim();

  if (!newUsername || newUsername.length < 3) {
    showToast('Username must be at least 3 characters', 'error');
    return;
  }

  try {
    const data = await fetchAPI('/api/auth/username', {
      method: 'PUT',
      body: JSON.stringify({ username: newUsername })
    });

    currentUser.username = newUsername;
    localStorage.setItem('synch_user', JSON.stringify(currentUser));
    loadUserProfile();
    closeModal('usernameModal');
    showToast('Username updated', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// Password change
document.getElementById('changePasswordBtn').addEventListener('click', () => {
  openModal('passwordModal');
});

document.getElementById('savePasswordBtn').addEventListener('click', async () => {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;

  if (newPassword !== confirmNewPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  try {
    await fetchAPI('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });

    closeModal('passwordModal');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    showToast('Password updated', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// Delete account
document.getElementById('deleteAccountBtn').addEventListener('click', () => {
  openModal('deleteAccountModal');
});

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  const password = document.getElementById('deletePassword').value;

  if (!password) {
    showToast('Please enter your password', 'error');
    return;
  }

  try {
    await fetchAPI('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });

    localStorage.clear();
    window.location.href = 'index.html';
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// Sessions
async function loadSessions() {
  try {
    const data = await fetchAPI('/api/auth/sessions');

    if (data.sessions.length === 0) {
      elements.sessionsList.innerHTML = '<div class="empty-state"><p>No sessions</p></div>';
      return;
    }

    elements.sessionsList.innerHTML = data.sessions.map(session => `
      <div class="session-item ${session.current ? 'current' : ''}">
        <div class="session-info">
          <div class="session-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="session-details">
            <h4>
              ${escapeHtml(session.device?.substring(0, 40) || 'Unknown device')}
              ${session.current ? '<span class="session-badge">Current</span>' : ''}
            </h4>
            <p>${formatTime(session.createdAt)}</p>
          </div>
        </div>
        ${!session.current ? `<button class="btn btn-secondary btn-sm" onclick="revokeSession('${session.id}')">Revoke</button>` : ''}
      </div>
    `).join('');
  } catch (error) {
    elements.sessionsList.innerHTML = '<div class="empty-state"><p>Failed to load sessions</p></div>';
  }
}

window.revokeSession = async function(sessionId) {
  try {
    await fetchAPI(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
    showToast('Session revoked', 'success');
    loadSessions();
  } catch (error) {
    showToast('Failed to revoke session', 'error');
  }
};

// Blocked users
async function loadBlockedUsers() {
  try {
    const data = await fetchAPI('/api/users/blocked');

    if (data.blockedUsers.length === 0) {
      elements.blockedUsersList.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>No blocked users</p></div>';
      return;
    }

    elements.blockedUsersList.innerHTML = data.blockedUsers.map(user => `
      <div class="blocked-user-item">
        <div class="blocked-user-info">
          <div class="avatar">${user.avatar ? `<img src="${user.avatar}">` : getInitials(user.username)}</div>
          <span>${escapeHtml(user.username)}</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="unblockUser('${user._id}')">Unblock</button>
      </div>
    `).join('');
  } catch (error) {
    elements.blockedUsersList.innerHTML = '<div class="empty-state"><p>Failed to load</p></div>';
  }
}

window.unblockUser = async function(userId) {
  try {
    await fetchAPI(`/api/users/${userId}/block`, { method: 'DELETE' });
    showToast('User unblocked', 'success');
    loadBlockedUsers();
  } catch (error) {
    showToast('Failed to unblock user', 'error');
  }
};

// Avatar upload
document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const response = await fetch('/api/users/avatar', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    currentUser.avatar = data.avatar;
    localStorage.setItem('synch_user', JSON.stringify(currentUser));
    loadUserProfile();
    showToast('Avatar updated', 'success');
  } catch (error) {
    showToast('Failed to update avatar', 'error');
  }
});

// Page loading overlay helpers
function showPageLoading(text) {
  document.getElementById('pageLoadingText').textContent = text || 'Loading...';
  document.getElementById('pageLoadingOverlay').classList.add('active');
}

function hidePageLoading() {
  document.getElementById('pageLoadingOverlay').classList.remove('active');
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  showPageLoading('Signing out...');

  try {
    await fetchAPI('/api/auth/logout', { method: 'POST' });
  } catch (error) {}

  setTimeout(() => {
    localStorage.clear();
    window.location.href = 'login.html';
  }, 800);
});

// Export data
document.getElementById('exportDataBtn').addEventListener('click', async () => {
  showToast('Preparing export...', 'info');

  try {
    const chatsData = await fetchAPI('/api/chats');
    const exportData = {
      user: currentUser,
      chats: chatsData.chats,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synch-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Export complete', 'success');
  } catch (error) {
    showToast('Failed to export data', 'error');
  }
});

// Clear chats
document.getElementById('clearChatsBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all chat history?')) {
    return;
  }
  showToast('Clear each chat individually from chat view', 'info');
});

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Two-Factor Authentication
const twoFactorToggle = document.getElementById('twoFactorToggle');
let pendingTwoFactorState = false;

function updateTwoFactorToggle() {
  if (currentUser.twoFactorEnabled) {
    twoFactorToggle.classList.add('active');
  } else {
    twoFactorToggle.classList.remove('active');
  }
}

twoFactorToggle.addEventListener('click', () => {
  pendingTwoFactorState = !currentUser.twoFactorEnabled;

  const modal = document.getElementById('twoFactorModal');
  const title = document.getElementById('twoFactorModalTitle');
  const desc = document.getElementById('twoFactorModalDesc');

  if (pendingTwoFactorState) {
    title.textContent = 'Enable Two-Factor Authentication';
    desc.textContent = "Enter your password to enable two-factor authentication. You'll receive a verification code via email each time you log in.";
  } else {
    title.textContent = 'Disable Two-Factor Authentication';
    desc.textContent = 'Enter your password to disable two-factor authentication. Your account will be less secure.';
  }

  document.getElementById('twoFactorPassword').value = '';
  openModal('twoFactorModal');
});

document.getElementById('confirmTwoFactorBtn').addEventListener('click', async () => {
  const password = document.getElementById('twoFactorPassword').value;

  if (!password) {
    showToast('Please enter your password', 'error');
    return;
  }

  closeModal('twoFactorModal');
  showPageLoading(pendingTwoFactorState ? 'Enabling 2FA...' : 'Disabling 2FA...');

  try {
    const data = await fetchAPI('/api/auth/2fa', {
      method: 'PUT',
      body: JSON.stringify({ enabled: pendingTwoFactorState, password })
    });

    currentUser.twoFactorEnabled = pendingTwoFactorState;
    localStorage.setItem('synch_user', JSON.stringify(currentUser));
    updateTwoFactorToggle();

    setTimeout(() => {
      hidePageLoading();
      showToast(data.message, 'success');
    }, 800);
  } catch (error) {
    hidePageLoading();
    showToast(error.message, 'error');
  }
});

// Initialize
loadUserProfile();
loadSavedSettings();
loadSessions();
loadBlockedUsers();
updateTwoFactorToggle();
