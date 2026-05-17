(function (global) {
  class EventController {
    constructor(options) {
      this.api = options.api;
      this.renderer = options.renderer;
      this.getState = options.getState;
      this.onStateApplied = options.onStateApplied;
      this.onTutorialUpdated = options.onTutorialUpdated;
      this.onFloatingText = options.onFloatingText;
      this.onLog = options.onLog;
      this.activeEventId = null;
    }

    open(eventId) {
      const eventData = (this.getState().eventQueue || []).find((item) => item.id === eventId);
      if (!eventData) return;
      this.activeEventId = eventId;
      this.renderer.open(eventData);
    }

    close() {
      this.activeEventId = null;
      this.renderer.close();
    }

    async claimActive(optionId = null) {
      if (!this.activeEventId) return;
      const state = this.getState();
      const eventData = (state.eventQueue || []).find((item) => item.id === this.activeEventId);
      const option = optionId
        ? eventData?.options?.find((item) => item.id === optionId)
        : eventData?.options?.[0];
      if (!eventData || !option) return;
      try {
        const result = await this.api.claimEvent(this.activeEventId, option.id);
        this.onStateApplied(result);
        this.onTutorialUpdated(result.tutorial);
        this.close();
        this.onFloatingText(this.renderer.formatReward(result.reward));
        this.onLog(`🎁 ${result.message}`);
      } catch (error) {
        this.onLog(`❌ ${error.payload?.message || error.message}`);
      }
    }
  }

  global.EventController = EventController;
  if (typeof module !== 'undefined' && module.exports) module.exports = EventController;
})(typeof window !== 'undefined' ? window : globalThis);
