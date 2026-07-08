// HitTargetManager -- plain class composed by CanvasGameRenderer (god-file
// re-decomposition slice 12). Wraps the host's CanvasSurfaceState container: accessor
// bodies (hitTargets/famousSkillHitTargets/suppressHitTargets) and the
// setHitTargets/addHitTarget/appendWorldMapRuntimeHitTargets/getHitTarget/
// withSuppressedHitTargets/findHitTarget methods are verbatim relocations from
// CanvasGameRenderer. Sub-renderer forward-probes (surfaceRenderer/tutorialRenderer)
// live INSIDE this manager, resolved through the host, so the renderer keeps 1-line
// delegators and no call site changes.
(function (global) {
  const SharedCanvasSurfaceState = (() => {
    if (global.CanvasSurfaceState) return global.CanvasSurfaceState;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./renderers/CanvasSurfaceState');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class HitTargetManager {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get surfaceState() {
      return this.host?.surfaceState || null;
    }

    // Backing for the renderer's `hitTargets` accessor pair.
    readHitTargets() {
      return SharedCanvasSurfaceState.getHitTargets(this.surfaceState);
    }

    writeHitTargets(value) {
      SharedCanvasSurfaceState.setHitTargets(this.surfaceState, value);
    }

    // Backing for the renderer's `famousSkillHitTargets` accessor pair.
    readFamousSkillHitTargets() {
      if (!Array.isArray(this.surfaceState.famousSkillHitTargets)) {
        this.surfaceState.famousSkillHitTargets = [];
      }
      return this.surfaceState.famousSkillHitTargets;
    }

    writeFamousSkillHitTargets(value) {
      this.surfaceState.famousSkillHitTargets = Array.isArray(value) ? value : [];
    }

    // Backing for the renderer's `suppressHitTargets` accessor pair.
    readSuppressHitTargets() {
      return Boolean(this.surfaceState.suppressHitTargets);
    }

    writeSuppressHitTargets(value) {
      this.surfaceState.suppressHitTargets = Boolean(value);
    }

    setHitTargets(...args) {
      const renderer = this.host?.surfaceRenderer;
      return typeof renderer?.setHitTargets === 'function'
        ? renderer.setHitTargets(...args)
        : SharedCanvasSurfaceState.setHitTargets(this.surfaceState, args[0] || [], args[1] ?? null);
    }

    addHitTarget(...args) {
      const renderer = this.host?.surfaceRenderer;
      if (typeof renderer?.addHitTarget === 'function') {
        return renderer.addHitTarget(...args);
      }
      const [rect, action] = args;
      if (this.readSuppressHitTargets()) return undefined;
      if (!action || !rect) return undefined;
      SharedCanvasSurfaceState.appendHitTarget(this.surfaceState, {
        x: Number(rect.x) || 0,
        y: Number(rect.y) || 0,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
        action,
      }, args[2] ?? null);
      return undefined;
    }

    appendWorldMapRuntimeHitTargets(targets = []) {
      if (!Array.isArray(targets) || !targets.length) return false;
      targets.forEach((target) => {
        // Dispatch through the host so renderer-level addHitTarget stays the entry point
        // (verbatim: the original body called this.addHitTarget on the renderer).
        this.host.addHitTarget(
          {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
          },
          target.action,
        );
      });
      return true;
    }

    getHitTarget(...args) {
      const renderer = this.host?.surfaceRenderer;
      const result =
        typeof renderer?.getHitTarget === 'function' ? renderer.getHitTarget(...args) : undefined;
      return result === undefined ? null : result;
    }

    withSuppressedHitTargets(...args) {
      const renderer = this.host?.surfaceRenderer;
      return typeof renderer?.withSuppressedHitTargets === 'function'
        ? renderer.withSuppressedHitTargets(...args)
        : args[0]?.();
    }

    clearHitTargetPool(...args) {
      const renderer = this.host?.surfaceRenderer;
      return typeof renderer?.clearHitTargetPool === 'function'
        ? renderer.clearHitTargetPool(...args)
        : SharedCanvasSurfaceState.clearHitTargetPool(this.surfaceState, args[0] || 'base');
    }

    setHitTargetPool(...args) {
      const renderer = this.host?.surfaceRenderer;
      return typeof renderer?.setHitTargetPool === 'function'
        ? renderer.setHitTargetPool(...args)
        : SharedCanvasSurfaceState.setActiveHitTargetPool(this.surfaceState, args[0] || 'base');
    }

    getHitTargetPool(...args) {
      const renderer = this.host?.surfaceRenderer;
      return typeof renderer?.getHitTargetPool === 'function'
        ? renderer.getHitTargetPool(...args)
        : SharedCanvasSurfaceState.getHitTargets(this.surfaceState, args[0] ?? null);
    }

    withHitTargetPool(pool = 'base', callback = null) {
      const renderer = this.host?.surfaceRenderer;
      if (typeof renderer?.withHitTargetPool === 'function') {
        return renderer.withHitTargetPool(pool, callback);
      }
      const previous = SharedCanvasSurfaceState.getActiveHitTargetPool(this.surfaceState);
      SharedCanvasSurfaceState.setActiveHitTargetPool(this.surfaceState, pool);
      try {
        return typeof callback === 'function' ? callback() : undefined;
      } finally {
        SharedCanvasSurfaceState.setActiveHitTargetPool(this.surfaceState, previous);
        SharedCanvasSurfaceState.syncMergedHitTargets(this.surfaceState);
      }
    }

    findHitTarget(...args) {
      const renderer = this.host?.tutorialRenderer;
      const result =
        typeof renderer?.findHitTarget === 'function' ? renderer.findHitTarget(...args) : undefined;
      return result === undefined ? null : result;
    }
  }

  global.HitTargetManager = HitTargetManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = HitTargetManager;
})(typeof window !== 'undefined' ? window : globalThis);
