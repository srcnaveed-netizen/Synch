require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const { initDatabase } = require('./database');
const { socketAuth } = require('./middleware/auth');
const socketHandler = require('./sockets/socketHandler');
const { initEmailService } = require('./services/emailService');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const messageRoutes = require('./routes/message');
const userRoutes = require('./routes/user');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/signup.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/settings.html'));
});

io.use(socketAuth);
socketHandler(io);

async function startServer() {
  try {
    await initDatabase();

    console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      initEmailService({
        email: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS
      });
      console.log('Email service initialized with:', process.env.EMAIL_USER);
    } else {
      console.log('Email service not configured. Set EMAIL_USER and EMAIL_PASS environment variables.');
    }

    server.listen(config.PORT, () => {
      console.log(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║   SYNCH Server Running!               ║
  ║                                       ║
  ║   Local: http://localhost:${config.PORT}       ║
  ║                                       ║
  ║   Database: Supabase PostgreSQL       ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
