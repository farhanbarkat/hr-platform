import { TOKEN_TYPES, verifyToken } from '../utils/token.util.js';

export const setupChatSocket = (io) => {
  // Socket JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication token required'));

    try {
      const decoded = verifyToken(
        token,
        process.env.JWT_ACCESS_SECRET,
        TOKEN_TYPES.ACCESS
      );
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired socket token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id || socket.user.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    // Join personal user room for direct 1-to-1 routing
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });
};