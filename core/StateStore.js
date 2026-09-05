const mongoose = require('mongoose');
const persistenceManager = require('./PersistenceManager');

/**
 * StateStore - Manages MongoDB database connection lifecycle and local atomic state persistence.
 */
class StateStore {
  constructor() {
    this.isConnected = false;
  }

  /**
   * Connects to MongoDB using the configured connection URI.
   * @param {string} [uri] - Optional MongoDB URI override (defaults to process.env.MONGODB_URI)
   * @returns {Promise<boolean>} Resolves to true if connected, false otherwise
   */
  async connect(uri = process.env.MONGODB_URI) {
    const mongoUri = uri || 'mongodb://localhost:27017/argus_bot';
    try {
      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        console.log('[StateStore] MongoDB connected successfully.');
      });

      mongoose.connection.on('error', (err) => {
        this.isConnected = false;
        console.error('[StateStore] MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        console.warn('[StateStore] MongoDB disconnected.');
      });

      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      console.warn('[StateStore] MongoDB offline or unreachable. Operating in local JSON persistence mode via PersistenceManager.');
      return false;
    }
  }

  /**
   * Disconnects from the MongoDB database gracefully.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.isConnected || mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('[StateStore] MongoDB disconnected gracefully.');
    }
  }

  /**
   * Returns the current database connection status.
   * @returns {{ isConnected: boolean, readyState: number }}
   */
  getStatus() {
    return {
      isConnected: this.isConnected && mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState
    };
  }

  /**
   * Saves a unified state snapshot via atomic file write.
   * @param {Object} data - Snapshot state payload
   * @returns {Promise<void>}
   */
  async saveSnapshot(data) {
    await persistenceManager.saveState(data);
    console.log('[StateStore] State snapshot saved to persistent disk.');
  }

  /**
   * Loads the most recent state snapshot from atomic disk store.
   * @returns {Promise<Object>}
   */
  async loadSnapshot() {
    return persistenceManager.loadState();
  }
}

module.exports = StateStore;
