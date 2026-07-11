(function (global) {
  'use strict';

  function createEventBus(options = {}) {
    const subscribers = new Map();
    const onSubscriberError = typeof options.onSubscriberError === 'function'
      ? options.onSubscriberError
      : null;

    function subscribe(eventName, subscriber) {
      const name = String(eventName || '');
      if (!name || typeof subscriber !== 'function') return () => false;
      const listeners = subscribers.get(name) || new Set();
      listeners.add(subscriber);
      subscribers.set(name, listeners);
      let active = true;
      return function unsubscribe() {
        if (!active) return false;
        active = false;
        listeners.delete(subscriber);
        if (listeners.size === 0) subscribers.delete(name);
        return true;
      };
    }

    function emit(eventName, payload) {
      const name = String(eventName || '');
      const listeners = [...(subscribers.get(name) || [])];
      const errors = [];
      listeners.forEach((subscriber) => {
        try {
          subscriber(payload, name);
        } catch (error) {
          errors.push(error);
          try {
            onSubscriberError?.(error, { eventName: name, payload, subscriber });
          } catch (_error) {
            // Error reporting is also isolated from publishers and other subscribers.
          }
        }
      });
      return { delivered: listeners.length - errors.length, failed: errors.length, errors };
    }

    return Object.freeze({ emit, subscribe });
  }

  const api = Object.freeze({
    createEventBus,
    emit: null,
    subscribe: null,
  });
  const defaultBus = createEventBus();
  const exported = Object.freeze({
    ...api,
    emit: defaultBus.emit,
    subscribe: defaultBus.subscribe,
  });

  global.ChangeEventBus = exported;
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
})(typeof window !== 'undefined' ? window : globalThis);
