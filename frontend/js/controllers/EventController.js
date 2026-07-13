(function (global) {
  class EventController {
    constructor(options) {
      this.api = options.api;
      this.getState = options.getState;
      this.onStateApplied = options.onStateApplied;
      this.onFloatingText = options.onFloatingText;
      this.onLog = options.onLog;
      this.formatReward = options.formatReward
        || ((reward) => options.presenter?.formatEventReward?.(reward) || '');
      this.activeEventId = null;
    }

    open(eventId) {
      const eventData = (this.getState().eventQueue || []).find((item) => item.id === eventId);
      if (!eventData) return null;
      this.activeEventId = eventId;
      return eventData;
    }

    close() {
      this.activeEventId = null;
    }

    isOpen() {
      return Boolean(this.activeEventId);
    }

    async claim(eventId, optionId = null) {
      if (eventId) this.open(eventId);
      return this.claimActive(optionId);
    }

    async claimActive(optionId = null) {
      if (!this.activeEventId) return false;
      const state = this.getState();
      const eventData = (state.eventQueue || []).find((item) => item.id === this.activeEventId);
      const option = optionId
        ? eventData?.options?.find((item) => item.id === optionId)
        : eventData?.options?.[0];
      if (!eventData || !option) return false;
      try {
        const result = await this.api.claimEvent(this.activeEventId, option.id);
        this.onStateApplied(result);
        this.close();
        this.onFloatingText(this.formatReward(result.reward));
        this.onLog(`🎁 ${result.message}`);
        return result;
      } catch (error) {
        this.onLog(`❌ ${error.payload?.message || error.message}`);
        return false;
      }
    }
  }

  global.EventController = EventController;
  if (typeof module !== 'undefined' && module.exports) module.exports = EventController;
})(typeof window !== 'undefined' ? window : globalThis);
