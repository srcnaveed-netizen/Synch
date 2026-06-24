const { User } = require('../database');

exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;

    const users = (await User.findAll(req.user.id, search || '')).map(u => ({
      _id: u.id,
      synchId: u.synch_id,
      username: u.username,
      avatar: u.avatar,
      status: u.status,
      lastSeen: u.last_seen
    }));

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(parseInt(req.params.userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        _id: user.id,
        synchId: user.synch_id,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
        lastSeen: user.last_seen
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
};

exports.findBySynchId = async (req, res) => {
  try {
    const { synchId } = req.params;

    const user = await User.findBySynchId(synchId.toUpperCase());

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    res.json({
      user: {
        _id: user.id,
        synchId: user.synch_id,
        username: user.username,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error finding user' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowedSettings = [
      'theme', 'accentColor', 'fontSize', 'bubbleStyle',
      'showOnlineStatus', 'showReadReceipts', 'showLastSeen',
      'messageSound', 'desktopNotifications', 'notificationVolume',
      'enterToSend', 'mediaAutoDownload', 'messagePreview'
    ];

    const updates = {};
    for (const key of allowedSettings) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    await User.updateSettings(req.user.id, updates);
    const updatedUser = await User.findById(req.user.id);

    res.json({ settings: updatedUser.settings });
  } catch (error) {
    res.status(500).json({ error: 'Error updating settings' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const userToBlock = await User.findById(parseInt(userId));
    if (!userToBlock) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.blockUser(req.user.id, parseInt(userId));

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error blocking user' });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    await User.unblockUser(req.user.id, parseInt(userId));

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error unblocking user' });
  }
};

exports.getBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = (await User.getBlockedUsers(req.user.id)).map(u => ({
      _id: u.id,
      username: u.username,
      avatar: u.avatar
    }));

    res.json({ blockedUsers });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching blocked users' });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/images/${req.file.filename}`;
    await User.updateAvatar(req.user.id, avatarUrl);

    res.json({ avatar: avatarUrl });
  } catch (error) {
    res.status(500).json({ error: 'Error updating avatar' });
  }
};
