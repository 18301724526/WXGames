(function (global) {
  const DEFAULT_MODAL_PANEL_KEY = 'famousPersons';

  // UI stage dirty scheduler. This is distinct from CanvasGameAppRenderScheduler,
  // which owns timers and animation frame helpers.
  class CanvasStageScheduler {
    constructor({ host, panelSurfaceManager, log } = {}) {
      this.host = host || null;
      this.panelSurfaceManager = panelSurfaceManager || null;
      this.log = typeof log === 'function' ? log : null;
      this.dirtySlots = new Map();
      this.atomicDepth = 0;
      this.failures = [];
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

    getFailures() {
      return this.failures.slice();
    }

    recordFailure(slot, reason, detail = {}) {
      const record = {
        slot: String(slot || ''),
        reason: reason || '',
        detail,
      };
      this.failures.push(record);
      if (detail.error) this.log?.(detail.error);
      else if (detail.message) this.log?.(detail.message);
      return false;
    }

    getModalPanelKeys() {
      return [DEFAULT_MODAL_PANEL_KEY];
    }

    buildModalFlushOptions(entries = []) {
      const lastEntry = entries[entries.length - 1] || {};
      const payload = lastEntry.payload || {};
      return {
        action: payload.action || null,
        descriptor: payload.descriptor || null,
        dirty: entries.slice(),
        reason: lastEntry.reason || '',
      };
    }

    flushModal(entries = []) {
      const manager = this.getPanelSurfaceManager();
      const reason = entries[entries.length - 1]?.reason || '';
      if (!manager?.refreshPanelSurface) {
        return this.recordFailure('modal', reason, { message: 'missing panel surface manager' });
      }

      const options = this.buildModalFlushOptions(entries);
      let handled = false;
      this.getModalPanelKeys(entries).forEach((panelKey) => {
        try {
          const refreshed = manager.refreshPanelSurface(panelKey, options);
          if (refreshed === false) {
            this.recordFailure('modal', reason, { panelKey, message: 'modal projection returned false' });
            return;
          }
          handled = true;
        } catch (error) {
          this.recordFailure('modal', reason, { panelKey, error });
        }
      });
      return handled;
    }

    flushBase() {
      if (typeof this.host?.renderCanvasSurface === 'function') return this.host.renderCanvasSurface() !== false;
      if (typeof this.host?.renderActive === 'function') return this.host.renderActive() !== false;
      if (typeof this.host?.render === 'function') return this.host.render() !== false;
      return this.recordFailure('base', '', { message: 'missing base renderer' });
    }

    flushSlot(slot, entries = []) {
      if (slot === 'modal') return this.flushModal(entries);
      if (slot === 'base') return this.flushBase(entries);
      return this.recordFailure(slot, entries[entries.length - 1]?.reason || '', { message: 'unsupported stage slot' });
    }

    flush(slots) {
      const requested = Array.isArray(slots) && slots.length ? slots : Array.from(this.dirtySlots.keys());
      let handled = false;
      requested.forEach((slot) => {
        const key = String(slot || '');
        const entries = this.dirtySlots.get(key) || [];
        if (!entries.length) return;
        const slotHandled = this.flushSlot(key, entries);
        this.dirtySlots.delete(key);
        handled = slotHandled || handled;
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
