const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

module.exports = (io) => {
  // Optional: authenticate socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
      }
      next();
    } catch {
      // Allow unauthenticated connections (they just won't get user context)
      next();
    }
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.userId || "anon"})`);

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    });

    socket.on("error", (err) => {
      logger.warn(`Socket error: ${err.message}`);
    });
  });
};
