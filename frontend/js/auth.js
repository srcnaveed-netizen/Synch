const API_URL = '';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('synch_token');

  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function logout() {
  localStorage.removeItem('synch_token');
  localStorage.removeItem('synch_user');
  window.location.href = '/login';
}

function getUser() {
  const userStr = localStorage.getItem('synch_user');
  return userStr ? JSON.parse(userStr) : null;
}

function isAuthenticated() {
  return !!localStorage.getItem('synch_token');
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}
