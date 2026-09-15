import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { tokenStorage } from '../lib/tokenStorage.js';

export const useSocket = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return;

    // Backend root origin (agar API base path /api/v1 hai toh strip kar dein)
    const backendUrl =
      import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5000';

    const socket = io(backendUrl, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('✅ Real-time chat socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connection error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
};