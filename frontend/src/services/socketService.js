import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(serverUrl) {
    // Auto-detect server URL if not provided
    if (!serverUrl) {
      serverUrl = import.meta.env.PROD 
        ? 'https://xeno-project-kathy-production.up.railway.app'
        : 'http://localhost:3001';
    }
    
    if (this.socket && this.isConnected) {
      console.log('Socket already connected');
      return;
    }

    try {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
        this.isConnected = true;
        
        // Join sync room for real-time updates
        this.socket.emit('join-sync');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket server');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.isConnected = false;
      });

      // Sync event listeners
      this.socket.on('sync-started', (data) => {
        console.log('🔄 Sync started:', data);
        this.emit('syncStarted', data);
      });

      this.socket.on('sync-progress', (data) => {
        console.log('📊 Sync progress:', data);
        this.emit('syncProgress', data);
      });

      this.socket.on('sync-completed', (data) => {
        console.log('✅ Sync completed:', data);
        this.emit('syncCompleted', data);
      });

      this.socket.on('sync-error', (data) => {
        console.error('❌ Sync error:', data);
        this.emit('syncError', data);
      });

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 WebSocket disconnected');
    }
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Helper methods for sync events
  onSyncStarted(callback) {
    this.on('syncStarted', callback);
  }

  onSyncProgress(callback) {
    this.on('syncProgress', callback);
  }

  onSyncCompleted(callback) {
    this.on('syncCompleted', callback);
  }

  onSyncError(callback) {
    this.on('syncError', callback);
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id || null
    };
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;