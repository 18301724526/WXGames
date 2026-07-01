(function (global) {
  // Secondary-panel UI state (tech-tree pan/zoom, famous-person detail, building
  // list scroll/category), extracted from CanvasGameAppRenderingRuntime. Pure
  // instance-field getters/setters plus their render nudges; no module-level deps.
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      scrollBuildings(action = {}) {
        const fromOffset = Math.max(0, Number(this.buildingOffset) || 0);
        const delta = Number(action.delta) || 0;
        const toOffset = Math.max(0, fromOffset + delta);
        this.buildingOffset = toOffset;
        if (toOffset !== fromOffset) {
          this.buildingTransition = {
            fromOffset,
            toOffset,
            direction: toOffset < fromOffset ? -1 : 1,
            startedAt: this.now(),
            durationMs: this.getTransitionDurationMs(),
          };
          this.startTransitionTimer();
        }
        return true;
      },

      selectBuildingCategory(action = {}) {
        const category = action.category || 'all';
        const previous = this.activeBuildingCategory || 'all';
        this.activeBuildingCategory = category;
        this.buildingOffset = 0;
        this.buildingTransition = null;
        return category !== previous;
      },

      getTechTreePan() {
        return {
          x: Number(this.techTreePanX) || 0,
          y: Number(this.techTreePanY) || 0,
        };
      },

      setTechTreePan(pan = {}) {
        const x = Number(pan.x) || 0;
        const y = Number(pan.y) || 0;
        this.techTreePanX = x;
        this.techTreePanY = y;
        return true;
      },

      getTechTreeZoom() {
        return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
      },

      setTechTreeZoom(zoom = 1) {
        const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
        this.techTreeZoom = nextZoom;
        return true;
      },

      changeFamousPersonsPage(action = {}) {
        const delta = Number(action.delta) || 0;
        this.famousPersonsPage = Math.max(0, (Number(this.famousPersonsPage) || 0) + delta);
        this.selectedFamousPersonId = '';
        this.renderer?.clearFamousSkillTooltip?.();
        return this.renderCanvasSurface();
      },

      openFamousPersonDetail(action = {}) {
        this.selectedFamousPersonId = action.personId || '';
        this.renderer?.clearFamousSkillTooltip?.();
        return this.renderCanvasSurface();
      },

      closeFamousPersonDetail() {
        this.selectedFamousPersonId = '';
        this.renderer?.clearFamousSkillTooltip?.();
        return this.renderCanvasSurface();
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppSecondaryPanels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
