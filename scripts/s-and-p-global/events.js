/* eslint-disable no-underscore-dangle */

/**
 * Event emitter/listener using CustomEvent and document.
 * Supports scoped events, eager replay of last payload, and optional logging.
 */
export const events = {
  _lastEvent: {},
  _loggerEnabled: true,

  emit(event, data, options = {}) {
    const eventName = options.scope ? `${options.scope}/${event}` : event;
    if (this._loggerEnabled) {
      /* eslint-disable-next-line no-console */
      console.group(eventName, data);
      /* eslint-disable-next-line no-console */
      console.groupEnd();
    }
    const eventObj = new CustomEvent(eventName, { detail: data });
    this._lastEvent[eventName] = { payload: data };
    document.dispatchEvent(eventObj);
  },

  lastPayload(event) {
    const lastEvent = this._lastEvent[event];
    return lastEvent ? lastEvent.payload : undefined;
  },

  enableLogger() {
    this._loggerEnabled = true;
  },

  disableLogger() {
    this._loggerEnabled = false;
  },

  on(event, callback, options = {}) {
    let eventName = event;
    const controller = new AbortController();
    if (options.scope) {
      eventName = `${options.scope}/${event}`;
    }
    if (options.eager) {
      const lastData = this._lastEvent[eventName];
      if (lastData) {
        callback(lastData.payload);
      }
    }

    document.addEventListener(eventName, (e) => callback(e.detail), {
      signal: controller.signal,
    });
    return {
      off: () => controller.abort(),
    };
  },
};

export default events;
