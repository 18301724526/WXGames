(function (global) {
  class TechTreeInteractionModel {
    constructor(options = {}) {
      this.host = options.host || null;
      this.getState = typeof options.getState === 'function' ? options.getState : (() => this.host?.state || {});
      this.dragStart = null;
    }

    getRenderer() {
      return this.host?.renderer || null;
    }

    getPresenter(renderer = this.getRenderer()) {
      return renderer?.presenter || this.host?.presenter || null;
    }

    getCurrentPan() {
      return this.host?.getTechTreePan?.() || {
        x: Number(this.host?.techTreePanX) || 0,
        y: Number(this.host?.techTreePanY) || 0,
      };
    }

    setPan(pan = {}) {
      const nextPan = {
        x: Number(pan.x) || 0,
        y: Number(pan.y) || 0,
      };
      if (this.host?.setTechTreePan) this.host.setTechTreePan(nextPan);
      else if (this.host) {
        this.host.techTreePanX = nextPan.x;
        this.host.techTreePanY = nextPan.y;
      }
      return nextPan;
    }

    getCurrentZoom() {
      return this.host?.getTechTreeZoom?.() || Number(this.host?.techTreeZoom) || 1;
    }

    setZoom(zoom) {
      const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
      if (this.host?.setTechTreeZoom) this.host.setTechTreeZoom(nextZoom);
      else if (this.host) this.host.techTreeZoom = nextZoom;
      return nextZoom;
    }

    getPanel(renderer = this.getRenderer()) {
      const renderLayout = typeof renderer?.getLayout === 'function'
        ? renderer.getLayout()
        : { contentX: 12, contentWidth: Math.max(300, Number(renderer?.width) || 390) - 24 };
      return renderer?.lastTechTreeScroll?.panel || {
        x: renderLayout.contentX + 24,
        y: 352,
        width: renderLayout.contentWidth - 48,
        height: Math.max(128, (Number(renderer?.height) || 844) - 438),
      };
    }

    getView(renderer = this.getRenderer()) {
      const presenter = this.getPresenter(renderer);
      if (!presenter || typeof presenter.buildTechViewState !== 'function') return null;
      return presenter.buildTechViewState(this.getState());
    }

    clampPan(xValue, yValue, options = {}) {
      const requestedX = Number(xValue) || 0;
      const requestedY = Number(yValue) || 0;
      const renderer = this.getRenderer();
      if (!renderer || typeof renderer.getTechTreeLayout !== 'function') {
        return { x: requestedX, y: requestedY };
      }
      const view = options.view || this.getView(renderer);
      if (!view) return { x: requestedX, y: requestedY };
      const panel = options.panel || this.getPanel(renderer);
      const layoutInfo = renderer.getTechTreeLayout(view, panel, {
        techTreePanX: requestedX,
        techTreePanY: requestedY,
        techTreeZoom: options.zoom || this.getCurrentZoom(),
      });
      return {
        x: Math.max(
          Number(layoutInfo.minPanX) || 0,
          Math.min(requestedX, Number(layoutInfo.maxPanX) || 0),
        ),
        y: Math.max(
          Number(layoutInfo.minPanY) || 0,
          Math.min(requestedY, Number(layoutInfo.maxPanY) || 0),
        ),
      };
    }

    handleDrag(action = {}) {
      const pointer = action.pointer || {};
      const x = Number(pointer.x) || 0;
      const y = Number(pointer.y) || 0;
      if (action.phase === 'start') {
        const currentPan = this.getCurrentPan();
        const pan = this.clampPan(currentPan.x, currentPan.y);
        this.dragStart = { x, y, panX: pan.x, panY: pan.y };
        if (this.host) this.host.techTreeDragStart = this.dragStart;
        this.setPan(pan);
        return true;
      }
      if (action.phase === 'move') {
        if (!this.host) return false;
        const currentPan = this.getCurrentPan();
        const nextPanX = this.dragStart ? this.dragStart.panX + x - this.dragStart.x : currentPan.x;
        const nextPanY = this.dragStart ? this.dragStart.panY + y - this.dragStart.y : currentPan.y;
        this.setPan(this.clampPan(nextPanX, nextPanY));
        return true;
      }
      if (action.phase === 'end' || action.phase === 'cancel') {
        this.dragStart = null;
        if (this.host) this.host.techTreeDragStart = null;
        return true;
      }
      return false;
    }

    handleZoom(action = {}) {
      const renderer = this.getRenderer();
      if (!renderer || typeof renderer.getTechTreeLayout !== 'function') return false;
      const view = this.getView(renderer);
      if (!view) return false;
      const gesture = action.gesture || {};
      const rawDelta = Number(gesture.scaleDelta);
      if (!Number.isFinite(rawDelta) || rawDelta <= 0) return false;
      const panel = this.getPanel(renderer);
      const centerX = Number.isFinite(Number(gesture.centerX ?? gesture.x))
        ? Number(gesture.centerX ?? gesture.x)
        : panel.x + panel.width / 2;
      const centerY = Number.isFinite(Number(gesture.centerY ?? gesture.y))
        ? Number(gesture.centerY ?? gesture.y)
        : panel.y + panel.height / 2;
      const currentPan = this.getCurrentPan();
      const oldZoom = Math.max(0.65, Math.min(1.6, this.getCurrentZoom()));
      const scaleDelta = Math.max(0.82, Math.min(1.22, rawDelta));
      const nextZoom = Math.max(0.65, Math.min(1.6, oldZoom * scaleDelta));
      if (Math.abs(nextZoom - oldZoom) < 0.001) return false;
      const contentX = (centerX - panel.x - currentPan.x) / oldZoom;
      const contentY = (centerY - panel.y - currentPan.y) / oldZoom;
      const requestedPan = {
        x: centerX - panel.x - contentX * nextZoom,
        y: centerY - panel.y - contentY * nextZoom,
      };
      const pan = this.clampPan(requestedPan.x, requestedPan.y, { view, panel, zoom: nextZoom });
      this.setZoom(nextZoom);
      this.setPan(pan);
      return true;
    }
  }

  global.TechTreeInteractionModel = TechTreeInteractionModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = TechTreeInteractionModel;
})(typeof globalThis !== 'undefined' ? globalThis : window);
