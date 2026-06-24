function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < oneDay * 2) {
    return 'Yesterday';
  } else if (diff < oneDay * 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(date) {
  if (!date) return 'Offline';

  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return formatTime(date);
}

function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return escapeHtml(text).replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    closeModal(btn.dataset.close);
  });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  let actualTheme = theme;
  if (theme === 'system') {
    actualTheme = getSystemTheme();
  }
  document.documentElement.dataset.theme = actualTheme;
  localStorage.setItem('synch_theme', theme);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const savedTheme = localStorage.getItem('synch_theme') || 'dark';
  if (savedTheme === 'system') {
    applyTheme('system');
  }
});

function applyAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-light', adjustColor(color, 30));
  document.documentElement.style.setProperty('--accent-dark', adjustColor(color, -30));
  document.documentElement.style.setProperty('--accent-glow', `${color}40`);
  localStorage.setItem('synch_accent', color);
}

function applyFontSize(size) {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem('synch_fontSize', size);
}

function adjustColor(color, amount) {
  const clamp = (num) => Math.min(255, Math.max(0, num));

  let hex = color.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  r = clamp(r + amount);
  g = clamp(g + amount);
  b = clamp(b + amount);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function loadSavedSettings() {
  const theme = localStorage.getItem('synch_theme') || 'dark';
  const accent = localStorage.getItem('synch_accent') || '#0084FF';
  const fontSize = localStorage.getItem('synch_fontSize') || 'medium';

  applyTheme(theme);
  applyAccentColor(accent);
  applyFontSize(fontSize);
}

loadSavedSettings();

const emojis = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗',
  '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫',
  '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒',
  '🙄', '😬', '😮', '😯', '😲', '😳', '🥺', '😢',
  '😭', '😤', '😡', '🤬', '😈', '👿', '💀', '☠️',
  '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
  '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
  '🔥', '✨', '🎉', '🎊', '💯', '💢', '💥', '💫'
];

function createEmojiPicker(containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.type = 'button';
    btn.addEventListener('click', () => onSelect(emoji));
    container.appendChild(btn);
  });
}
