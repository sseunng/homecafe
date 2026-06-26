import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// Simple self-contained UUID generator
function generateUUID() {
  return 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [guestId, setGuestId] = useState('');
  const [role, setRole] = useState('guest'); // guest, admin
  const [completedOrderAlert, setCompletedOrderAlert] = useState(null);

  // Initialize guest ID
  useEffect(() => {
    let savedId = localStorage.getItem('homecafe_kiosk_guest_id');
    if (!savedId) {
      savedId = generateUUID();
      localStorage.setItem('homecafe_kiosk_guest_id', savedId);
    }
    setGuestId(savedId);
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!guestId) return;

    // Detect environment and point socket connection to backend port 3000 in dev mode
    const isDev = window.location.port === '5173';
    const socketUrl = isDev
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : window.location.origin;

    console.log(`Connecting to Socket server at: ${socketUrl}`);
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('Socket.io connected:', newSocket.id);
      // Register client role & guest ID
      newSocket.emit('register', { guestId, role });
    });

    // Listen for completion alert targeting this guest
    newSocket.on('order_completed_alert', (orderData) => {
      console.log('Order completion notification received:', orderData);
      setCompletedOrderAlert(orderData);
      
      // Play a soft notification sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Simple chime synth
        const playTone = (freq, startTime, duration) => {
          const osc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          
          gainNode.gain.setValueAtTime(0.15, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          osc.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        
        // Play sweet major third chime
        const now = audioContext.currentTime;
        playTone(523.25, now, 0.4); // C5
        playTone(659.25, now + 0.12, 0.5); // E5
        playTone(783.99, now + 0.24, 0.6); // G5
      } catch (e) {
        console.warn('Audio feedback failed or blocked by browser gesture rules:', e);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [guestId, role]);

  // Force register role change (e.g. switching to admin mode)
  const registerRole = (newRole) => {
    setRole(newRole);
    if (socket && socket.connected) {
      socket.emit('register', { guestId, role: newRole });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, guestId, role, registerRole, completedOrderAlert, setCompletedOrderAlert }}>
      {children}
    </SocketContext.Provider>
  );
};
