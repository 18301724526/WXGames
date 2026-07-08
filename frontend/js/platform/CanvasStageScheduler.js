(function (global) {
  // UI stage dirty scheduler. This is distinct from CanvasGameAppRenderScheduler,
  // which owns timers and animation frame helpers.
  class CanvasStageScheduler {
    constructor({ host, panelSurfaceManager, log } = {}) {
      this.host = host || null;
      this.panelSurfaceManager = panelSurfaceManager || null;
      this.log = typeof log === 'function' ? log : null;
      this.dirtySlots = new Map();
      this.atomicDepth = 0;
    }

    getPanelSurfaceManager() {
      return this.panelSurfaceManager
        || this.host?.panelSurfaceManager
        || this.host?.getPanelSurfaceManager?.()
        || null;
    }

    markDirty(slot, reason, payload) {
      const key = String(slot || '');
      if (!key) return false;
      const entries = this.dirtySlots.get(key) || [];
      entries.push({ reason: reason || '', payload: payload || null });
      this.dirtySlots.set(key, entries);
      return true;
    }

    isAtomic() {
      return this.atomicDepth > 0;
    }

    flush(slots) {
      const requested = Array.isArray(slots) && slots.length ? slots : Array.from(this.dirtySlots.keys());
      let handled = false;
      requested.forEach((slot) => {
        const key = String(slot || '');
        const entries = this.dirtySlots.get(key) || [];
        if (!entries.length) return;
        try {
          if (key === 'modal') {
            const manager = this.getPanelSurfaceManager();
            const projected = manager?.projectModalLayer?.({
              reason: entries[entries.length - 1]?.reason || '',
              dirty: entries.slice(),
            });
            handled = projected !== false || handled;
          } else if (key === 'base') {
            if (typeof this.host?.renderCanvasSurface === 'function') handled = this.host.renderCanvasSurface() !== false || handled;
            else if (typeof this.host?.renderActive === 'function') handled = this.host.renderActive() !== false || handled;
            else if (typeof this.host?.render === 'function') handled = this.host.render() !== false || handled;
          }
          this.dirtySlots.delete(key);
        } catch (error) {
          this.log?.(error);
        }
      });
      return handled;
    }

    flushAll() {
      return this.flush(Array.from(this.dirtySlots.keys()));
    }

    runAtomic(fn, options = {}) {
      if (typeof fn !== 'function') return false;
      this.atomicDepth += 1;
      try {
        return fn();
      } catch (error) {
        this.log?.(error);
        return false;
      } finally {
        this.atomicDepth -= 1;
        if (this.atomicDepth <= 0) {
          const slots = Array.isArray(options.flush) ? options.flush : Array.from(this.dirtySlots.keys());
          this.flush(slots);
        }
      }
    }
  }

  global.CanvasStageScheduler = CanvasStageScheduler;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasStageScheduler;
})(typeof window !== 'undefined' ? window : globalThis);

