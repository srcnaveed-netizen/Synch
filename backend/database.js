const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        synch_id TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        status TEXT DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settings TEXT DEFAULT '{}',
        blocked_users TEXT DEFAULT '[]',
        email_verified BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT DEFAULT 'signup',
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        device TEXT,
        ip TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        type TEXT DEFAULT 'private',
        name TEXT,
        avatar TEXT,
        admin_id INTEGER,
        last_message_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_participants (
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (chat_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT DEFAULT 'text',
        content TEXT DEFAULT '',
        media_url TEXT,
        media_duration REAL,
        reply_to_id INTEGER REFERENCES messages(id),
        edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP,
        deleted BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,
        pinned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS message_reads (
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);
    console.log('PostgreSQL database initialized (Supabase)');
  } finally {
    client.release();
  }
}

function generateSynchId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'SYNCH-';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

const VerificationCode = {
  create: async (email, userId = null, type = 'signup') => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM verification_codes WHERE email = $1 AND type = $2 AND used = FALSE', [email, type]);
    await pool.query(
      'INSERT INTO verification_codes (user_id, email, code, type, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, code, type, expiresAt]
    );
    return code;
  },

  verify: async (email, code, type = 'signup') => {
    const result = await pool.query(
      `SELECT * FROM verification_codes
       WHERE email = $1 AND code = $2 AND type = $3 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code, type]
    );

    if (result.rows.length > 0) {
      await pool.query('UPDATE verification_codes SET used = TRUE WHERE id = $1', [result.rows[0].id]);
      return true;
    }
    return false;
  }
};

const User = {
  create: async (username, email, password, emailVerified = false) => {
    const hashedPassword = bcrypt.hashSync(password, 12);
    const synchId = generateSynchId();
    const result = await pool.query(
      'INSERT INTO users (synch_id, username, email, password, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [synchId, username, email, hashedPassword, emailVerified]
    );
    return User.findById(result.rows[0].id);
  },

  findById: async (id) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    user.settings = JSON.parse(user.settings || '{}');
    user.blocked_users = JSON.parse(user.blocked_users || '[]');
    return user;
  },

  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    user.settings = JSON.parse(user.settings || '{}');
    user.blocked_users = JSON.parse(user.blocked_users || '[]');
    return user;
  },

  findByUsername: async (username) => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  },

  findBySynchId: async (synchId) => {
    const result = await pool.query('SELECT * FROM users WHERE synch_id = $1', [synchId]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    user.settings = JSON.parse(user.settings || '{}');
    user.blocked_users = JSON.parse(user.blocked_users || '[]');
    return user;
  },

  findAll: async (excludeId, search = '') => {
    let result;
    if (search) {
      result = await pool.query(
        `SELECT id, synch_id, username, avatar, status, last_seen
         FROM users WHERE id != $1 AND (username ILIKE $2 OR synch_id ILIKE $2)
         LIMIT 50`,
        [excludeId, `%${search}%`]
      );
    } else {
      result = await pool.query(
        'SELECT id, synch_id, username, avatar, status, last_seen FROM users WHERE id != $1 LIMIT 50',
        [excludeId]
      );
    }
    return result.rows;
  },

  updateStatus: async (id, status) => {
    await pool.query(
      'UPDATE users SET status = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );
  },

  updateSettings: async (id, settings) => {
    const user = await User.findById(id);
    const newSettings = { ...user.settings, ...settings };
    await pool.query(
      'UPDATE users SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(newSettings), id]
    );
  },

  updateUsername: async (id, username) => {
    await pool.query('UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [username, id]);
  },

  updatePassword: async (id, password) => {
    const hashedPassword = bcrypt.hashSync(password, 12);
    await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, id]);
  },

  updateAvatar: async (id, avatar) => {
    await pool.query('UPDATE users SET avatar = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [avatar, id]);
  },

  verifyEmail: async (id) => {
    await pool.query('UPDATE users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  },

  comparePassword: (user, password) => {
    return bcrypt.compareSync(password, user.password);
  },

  delete: async (id) => {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  blockUser: async (userId, blockedId) => {
    const user = await User.findById(userId);
    if (!user.blocked_users.includes(blockedId)) {
      user.blocked_users.push(blockedId);
      await pool.query('UPDATE users SET blocked_users = $1 WHERE id = $2', [JSON.stringify(user.blocked_users), userId]);
    }
  },

  unblockUser: async (userId, blockedId) => {
    const user = await User.findById(userId);
    user.blocked_users = user.blocked_users.filter(id => id !== blockedId);
    await pool.query('UPDATE users SET blocked_users = $1 WHERE id = $2', [JSON.stringify(user.blocked_users), userId]);
  },

  getBlockedUsers: async (userId) => {
    const user = await User.findById(userId);
    if (!user.blocked_users.length) return [];
    const result = await pool.query(
      `SELECT id, username, avatar FROM users WHERE id = ANY($1)`,
      [user.blocked_users]
    );
    return result.rows;
  },

  toPublicJSON: (user) => ({
    _id: user.id,
    synchId: user.synch_id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    status: user.status,
    lastSeen: user.last_seen,
    settings: user.settings,
    twoFactorEnabled: !!user.two_factor_enabled
  }),

  setTwoFactor: async (id, enabled) => {
    await pool.query('UPDATE users SET two_factor_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [enabled, id]);
  }
};

const Session = {
  create: async (userId, token, device, ip) => {
    await pool.query(
      'INSERT INTO sessions (user_id, token, device, ip) VALUES ($1, $2, $3, $4)',
      [userId, token, device, ip]
    );
  },

  findByUserId: async (userId) => {
    const result = await pool.query('SELECT * FROM sessions WHERE user_id = $1', [userId]);
    return result.rows;
  },

  deleteByToken: async (token) => {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  },

  deleteById: async (id) => {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  }
};

const Chat = {
  create: async (type, name, adminId) => {
    const result = await pool.query(
      'INSERT INTO chats (type, name, admin_id) VALUES ($1, $2, $3) RETURNING id',
      [type, name, adminId]
    );
    return Chat.findById(result.rows[0].id);
  },

  findById: async (id) => {
    const result = await pool.query('SELECT * FROM chats WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const chat = result.rows[0];
    chat.participants = await Chat.getParticipants(id);
    return chat;
  },

  findPrivateChat: async (user1Id, user2Id) => {
    const result = await pool.query(
      `SELECT c.* FROM chats c
       JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = $1
       JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = $2
       WHERE c.type = 'private'`,
      [user1Id, user2Id]
    );
    if (result.rows.length === 0) return null;
    const chat = result.rows[0];
    chat.participants = await Chat.getParticipants(chat.id);
    return chat;
  },

  findByUserId: async (userId) => {
    const result = await pool.query(
      `SELECT c.*, m.content as last_message_content, m.type as last_message_type, m.created_at as last_message_time
       FROM chats c
       JOIN chat_participants cp ON c.id = cp.chat_id
       LEFT JOIN messages m ON c.last_message_id = m.id
       WHERE cp.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    const chats = [];
    for (const chat of result.rows) {
      chat.participants = await Chat.getParticipants(chat.id);
      if (chat.last_message_id) {
        chat.lastMessage = {
          content: chat.last_message_content,
          type: chat.last_message_type,
          createdAt: chat.last_message_time
        };
      }
      chats.push(chat);
    }
    return chats;
  },

  addParticipant: async (chatId, userId) => {
    await pool.query(
      'INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [chatId, userId]
    );
  },

  getParticipants: async (chatId) => {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar, u.status, u.last_seen
       FROM users u
       JOIN chat_participants cp ON u.id = cp.user_id
       WHERE cp.chat_id = $1`,
      [chatId]
    );
    return result.rows.map(p => ({
      _id: p.id,
      username: p.username,
      avatar: p.avatar,
      status: p.status,
      lastSeen: p.last_seen
    }));
  },

  updateLastMessage: async (chatId, messageId) => {
    await pool.query(
      'UPDATE chats SET last_message_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [messageId, chatId]
    );
  },

  delete: async (id) => {
    await pool.query('DELETE FROM chats WHERE id = $1', [id]);
  },

  isParticipant: async (chatId, userId) => {
    const result = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
    return result.rows.length > 0;
  }
};

const Message = {
  create: async (chatId, senderId, type, content, mediaUrl, mediaDuration, replyToId) => {
    const result = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, type, content, media_url, media_duration, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [chatId, senderId, type, content, mediaUrl, mediaDuration, replyToId]
    );
    await Chat.updateLastMessage(chatId, result.rows[0].id);
    return Message.findById(result.rows[0].id);
  },

  findById: async (id) => {
    const result = await pool.query(
      `SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const msg = result.rows[0];
    msg.sender = { _id: msg.sender_id, username: msg.sender_username, avatar: msg.sender_avatar };
    msg.reactions = await Message.getReactions(id);
    if (msg.reply_to_id) {
      msg.replyTo = await Message.findById(msg.reply_to_id);
    }
    return msg;
  },

  findByChatId: async (chatId, limit = 50, before = null) => {
    let result;
    if (before) {
      result = await pool.query(
        `SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.chat_id = $1 AND m.created_at < $2
         ORDER BY m.created_at DESC
         LIMIT $3`,
        [chatId, before, limit]
      );
    } else {
      result = await pool.query(
        `SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.chat_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [chatId, limit]
      );
    }
    const messages = [];
    for (const msg of result.rows.reverse()) {
      msg.sender = { _id: msg.sender_id, username: msg.sender_username, avatar: msg.sender_avatar };
      msg.reactions = await Message.getReactions(msg.id);
      messages.push(msg);
    }
    return messages;
  },

  update: async (id, content) => {
    await pool.query(
      'UPDATE messages SET content = $1, edited = TRUE, edited_at = CURRENT_TIMESTAMP WHERE id = $2',
      [content, id]
    );
    return Message.findById(id);
  },

  delete: async (id) => {
    await pool.query(
      "UPDATE messages SET deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, content = '' WHERE id = $1",
      [id]
    );
  },

  togglePin: async (id) => {
    const msg = await Message.findById(id);
    await pool.query('UPDATE messages SET pinned = $1 WHERE id = $2', [!msg.pinned, id]);
    return !msg.pinned;
  },

  addReaction: async (messageId, userId, emoji) => {
    const existing = await pool.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, userId, emoji]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
    } else {
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [messageId, userId, emoji]
      );
    }

    return Message.getReactions(messageId);
  },

  getReactions: async (messageId) => {
    const result = await pool.query(
      `SELECT mr.*, u.username
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1`,
      [messageId]
    );
    return result.rows.map(r => ({
      user: { _id: r.user_id, username: r.username },
      emoji: r.emoji
    }));
  },

  search: async (chatId, query) => {
    const result = await pool.query(
      `SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1 AND m.content ILIKE $2 AND m.deleted = FALSE
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [chatId, `%${query}%`]
    );
    return result.rows.map(msg => {
      msg.sender = { _id: msg.sender_id, username: msg.sender_username, avatar: msg.sender_avatar };
      return msg;
    });
  },

  markAsRead: async (messageIds, userId) => {
    for (const id of messageIds) {
      await pool.query(
        'INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, userId]
      );
    }
  },

  toJSON: (msg) => ({
    _id: msg.id,
    chat: msg.chat_id,
    sender: msg.sender,
    type: msg.type,
    content: msg.content,
    mediaUrl: msg.media_url,
    mediaDuration: msg.media_duration,
    replyTo: msg.replyTo ? Message.toJSON(msg.replyTo) : null,
    reactions: msg.reactions || [],
    edited: !!msg.edited,
    editedAt: msg.edited_at,
    deleted: !!msg.deleted,
    deletedAt: msg.deleted_at,
    pinned: !!msg.pinned,
    createdAt: msg.created_at
  })
};

module.exports = {
  pool,
  initDatabase,
  User,
  Session,
  Chat,
  Message,
  VerificationCode
};
