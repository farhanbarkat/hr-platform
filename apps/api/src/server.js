import dotenv from 'dotenv';
dotenv.config();
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { initTaxCertificateWorker } from './workers/taxCertificate.worker.js';
import { setupChatSocket } from './sockets/chat.socket.js';

import app from '../app.js';
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
import connectDB  from './db/db.js';

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const socketOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: socketOrigins,
    credentials: true,
  },
});

setupChatSocket(io);

// Start BullMQ Worker
initTaxCertificateWorker();

// Database Connection then Server Init
connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`⚙️  Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Mongo DB connection failed !!!', err);
  });