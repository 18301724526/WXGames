(function (global) {
  class H5CanvasInputController {
    constructor(owner) {
      this.owner = owner;
      this.pointerDown = null;
      this.dragActive = false;
      this.dragMoved = false;
      this.activePinch = null;
      this.suppressTapUntil = 0;
      this.lastTapAt = 0;
      this.lastTapKey = '';
    }

    bindEvents() {
      const owner = this.owner;
      if (!owner.canvas || owner.eventsBound) return;
      owner.eventsBound = true;
      owner.runtime.addEventListener?.('resize', owner.handleResize);
      const eventTarget = owner.canvas;
      eventTarget.addEventListener?.('pointerdown', owner.handlePointerDown, { capture: true });
      eventTarget.addEventListener?.('pointermove', owner.handlePointerMove, { capture: true });
      eventTarget.addEventListener?.('pointerup', owner.handlePointerUp, { capture: true });
      owner.document?.addEventListener?.('pointerup', owner.handlePointerUp, { capture: true });
      eventTarget.addEventListener?.('wheel', owner.handleWheel, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchstart', owner.handleTouchStart, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchmove', owner.handleTouchMove, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchend', owner.handleTouchEnd, { capture: true, passive: false });
      eventTarget.addEventListener?.('touchcancel', owner.handleTouchEnd, { capture: true, passive: false });
      if (!global.PointerEvent) {
        eventTarget.addEventListener?.('click', owner.handlePointerUp, { capture: true });
      }
    }

    getEventTime(event = {}) {
      const eventTime = Number(event.timeStamp);
      return Number.isFinite(eventTime) && eventTime > 0 ? eventTime : this.owner.now();
    }

    getTouchPoints(event = {}) {
      const touches = Array.from(event.touches || []);
      if (touches.length) return touches.map((touch) => this.owner.toCanvasPoint(touch));
      return Array.from(event.changedTouches || []).map((touch) => this.owner.toCanvasPoint(touch));
    }

    getGestureCenter(points = []) {
      const usable = points.slice(0, 2);
      const total = usable.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
      const count = Math.max(1, usable.length);
      return { x: total.x / count, y: total.y / count };
    }

    getGestureDistance(points = []) {
      if (points.length < 2) return 0;
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      return Math.hypot(dx, dy);
    }

    dispatchGesture(gesture, event = {}) {
      const owner = this.owner;
      if (!gesture || !owner.gestureHandlers.length) return false;
      let handled = false;
      owner.gestureHandlers.forEach((handler) => {
        if (handler(gesture, event)) handled = true;
      });
      if (handled) {
        this.dragMoved = true;
        this.suppressTapUntil = this.getEventTime(event) + 260;
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
      }
      return handled;
    }

    shouldIgnoreDuplicateTap(point, event = {}) {
      const now = this.getEventTime(event);
      const key = `${event.type || 'tap'}:${Math.round(point.x)}:${Math.round(point.y)}`;
      if (key === this.lastTapKey && now - this.lastTapAt < 180) return true;
      this.lastTapKey = key;
      this.lastTapAt = now;
      return false;
    }

    handlePointerDown(event) {
      const owner = this.owner;
      if (event?.touches?.length >= 2 || this.activePinch) return false;
      if (event?.pointerType === 'touch' && this.pointerDown) return false;
      const point = owner.toCanvasPoint(event);
      const pointerId = event.pointerId ?? event.changedTouches?.[0]?.identifier ?? event.touches?.[0]?.identifier ?? 1;
      try {
        event.currentTarget?.setPointerCapture?.(pointerId);
      } catch (error) {}
      this.pointerDown = { ...point, pointerId };
      this.dragActive = false;
      this.dragMoved = false;
      let handled = false;
      owner.dragHandlers.forEach((handler) => {
        if (handler('start', { ...point, pointerId }, event)) handled = true;
      });
      if (handled) {
        this.dragActive = true;
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
      }
      return handled;
    }

    handlePointerMove(event) {
      const owner = this.owner;
      const point = owner.toCanvasPoint(event);
      owner.pointerMoveHandlers.forEach((handler) => handler(point, event));
      if (this.activePinch) return false;
      if (!this.pointerDown || !this.dragActive) return false;
      const pointerId = event.pointerId ?? event.changedTouches?.[0]?.identifier ?? event.touches?.[0]?.identifier ?? this.pointerDown.pointerId;
      if (pointerId !== this.pointerDown.pointerId) return false;
      if (Math.abs(point.x - this.pointerDown.x) > 3 || Math.abs(point.y - this.pointerDown.y) > 3) this.dragMoved = true;
      let handled = false;
      owner.dragHandlers.forEach((handler) => {
        if (handler('move', { ...point, pointerId }, event)) handled = true;
      });
      if (handled) {
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
      }
      return handled;
    }

    handlePointerUp(event) {
      const owner = this.owner;
      const point = owner.toCanvasPoint(event);
      const pointerId = event.pointerId ?? event.changedTouches?.[0]?.identifier ?? event.touches?.[0]?.identifier ?? this.pointerDown?.pointerId ?? 1;
      try {
        event.currentTarget?.releasePointerCapture?.(pointerId);
      } catch (error) {}
      if (this.dragActive) {
        owner.dragHandlers.forEach((handler) => handler('end', { ...point, pointerId }, event));
      }
      const skipTap = this.dragMoved || this.getEventTime(event) < this.suppressTapUntil;
      this.pointerDown = null;
      this.dragActive = false;
      this.dragMoved = false;
      if (skipTap) {
        if (event?.cancelable !== false) event.preventDefault?.();
        event.stopPropagation?.();
        return true;
      }
      if (this.shouldIgnoreDuplicateTap(point, event)) return false;
      let handled = false;
      owner.tapHandlers.forEach((handler) => {
        if (handler(point, event)) handled = true;
      });
      if (handled && event?.cancelable !== false) event.preventDefault?.();
      if (handled) event.stopPropagation?.();
      return handled;
    }

    handleWheel(event = {}) {
      const deltaY = Number(event.deltaY) || 0;
      if (!deltaY) return false;
      const point = this.owner.toCanvasPoint(event);
      const scaleDelta = Math.max(0.82, Math.min(1.22, Math.exp(-deltaY * 0.0015)));
      return this.dispatchGesture({
        type: 'wheelZoom',
        scaleDelta,
        centerX: point.x,
        centerY: point.y,
        x: point.x,
        y: point.y,
      }, event);
    }

    handleTouchStart(event = {}) {
      const points = this.getTouchPoints(event);
      if (points.length < 2) {
        if (!global.PointerEvent) return this.handlePointerDown(event);
        return false;
      }
      if (this.dragActive) {
        const center = this.getGestureCenter(points);
        this.owner.dragHandlers.forEach((handler) => handler('cancel', center, event));
        this.dragActive = false;
      }
      this.pointerDown = null;
      this.dragMoved = true;
      this.activePinch = {
        distance: Math.max(1, this.getGestureDistance(points)),
        center: this.getGestureCenter(points),
      };
      this.suppressTapUntil = this.getEventTime(event) + 260;
      if (event?.cancelable !== false) event.preventDefault?.();
      return true;
    }

    handleTouchMove(event = {}) {
      if (!this.activePinch) {
        if (!global.PointerEvent) return this.handlePointerMove(event);
        return false;
      }
      const points = this.getTouchPoints(event);
      if (points.length < 2) return false;
      const distance = Math.max(1, this.getGestureDistance(points));
      const center = this.getGestureCenter(points);
      const previousDistance = Math.max(1, Number(this.activePinch.distance) || distance);
      const previousCenter = this.activePinch.center || center;
      this.activePinch = { distance, center };
      const scaleDelta = Math.max(0.82, Math.min(1.22, distance / previousDistance));
      return this.dispatchGesture({
        type: 'pinchZoom',
        phase: 'move',
        scaleDelta,
        centerX: center.x,
        centerY: center.y,
        deltaX: center.x - previousCenter.x,
        deltaY: center.y - previousCenter.y,
        x: center.x,
        y: center.y,
      }, event);
    }

    handleTouchEnd(event = {}) {
      if ((event.touches?.length || 0) >= 2) return this.handleTouchMove(event);
      if (!this.activePinch) {
        if (!global.PointerEvent) return this.handlePointerUp(event);
        return false;
      }
      const previousCenter = this.activePinch.center || this.getGestureCenter(this.getTouchPoints(event));
      const handled = this.dispatchGesture({
        type: 'pinchZoom',
        phase: 'end',
        scaleDelta: 1,
        centerX: previousCenter.x,
        centerY: previousCenter.y,
        deltaX: 0,
        deltaY: 0,
        x: previousCenter.x,
        y: previousCenter.y,
      }, event);
      this.activePinch = null;
      this.dragMoved = true;
      this.suppressTapUntil = this.getEventTime(event) + 260;
      if (event?.cancelable !== false) event.preventDefault?.();
      event.stopPropagation?.();
      return handled || true;
    }
  }

  global.H5CanvasInputController = H5CanvasInputController;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasInputController;
})(typeof window !== 'undefined' ? window : globalThis);
