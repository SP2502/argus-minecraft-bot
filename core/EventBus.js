const EventEmitter = require('events');

/**
 * EventBus - Centralized asynchronous event publisher/subscriber.
 * Decouples services, skills, core loops, and API updates.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow ample listeners for multi-service event subscriptions
    this.setMaxListeners(50);
  }

  /**
   * Emit an event with standard logging or tracing if needed.
   * @param {string} event - Event name
   * @param  {...any} args - Event arguments
   * @returns {boolean}
   */
  emit(event, ...args) {
    return super.emit(event, ...args);
  }

  /**
   * Register a listener for an event.
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   * @returns {this}
   */
  on(event, listener) {
    return super.on(event, listener);
  }

  /**
   * Register a one-time listener for an event.
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   * @returns {this}
   */
  once(event, listener) {
    return super.once(event, listener);
  }

  /**
   * Remove a listener.
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   * @returns {this}
   */
  off(event, listener) {
    return super.off(event, listener);
  }
}

// Export singleton instance
const eventBus = new EventBus();
module.exports = eventBus;
