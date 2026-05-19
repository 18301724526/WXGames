(function (global) {
  class TutorialUIRenderer {
    constructor(elements = {}, runtime = global) {
      this.runtime = runtime || global;
      this.overlay = elements.overlay || null;
      this.bubble = elements.bubble || null;
      this.pointer = elements.pointer || null;
      this.scrollContainer = elements.scrollContainer || null;
      this.onSoftGuide = null;
      this.activeTarget = null;
      this.activeMessage = '';
      this.rafId = null;

      this.handleViewportChange = () => this.schedulePositionUpdate();
      this.runtime.addEventListener && this.runtime.addEventListener('resize', this.handleViewportChange);
      if (this.scrollContainer && this.scrollContainer.addEventListener) {
        this.scrollContainer.addEventListener('scroll', this.handleViewportChange, { passive: true });
      }
    }

    static fromDocument(doc, runtime = global) {
      return new TutorialUIRenderer({
        overlay: doc?.getElementById?.('tutorialOverlay') || null,
        bubble: doc?.getElementById?.('tutorialBubble') || null,
        pointer: doc?.getElementById?.('tutorialPointer') || null,
        scrollContainer: doc?.querySelector?.('.page-container') || null,
      }, runtime);
    }

    clearHighlight() {
      this.activeTarget = null;
      this.activeMessage = '';
    }

    getPresenter() {
      if (global.UIStatePresenter || globalThis.UIStatePresenter) {
        return global.UIStatePresenter || globalThis.UIStatePresenter;
      }
      if (typeof require === 'function') {
        return require('../state/UIStatePresenter');
      }
      return null;
    }

    buildHighlightView(rect) {
      const presenter = this.getPresenter();
      return presenter.buildTutorialHighlightViewState(rect, {
        innerWidth: this.runtime.innerWidth,
        innerHeight: this.runtime.innerHeight,
      });
    }

    positionSoftBubble() {
      if (!this.bubble) return;
      const bubbleWidth = Math.min(320, Math.max(220, this.runtime.innerWidth - 32));
      const top = 16;
      const left = Math.max(12, Math.round((this.runtime.innerWidth - bubbleWidth) / 2));
      this.bubble.style.top = `${top}px`;
      this.bubble.style.left = `${left}px`;
      this.bubble.style.maxWidth = `${bubbleWidth}px`;
    }

    schedulePositionUpdate() {
      if (!this.activeTarget) return;
      if (this.rafId && this.runtime.cancelAnimationFrame) this.runtime.cancelAnimationFrame(this.rafId);
      const update = () => {
        this.rafId = null;
        this.positionElements();
      };
      if (this.runtime.requestAnimationFrame) {
        this.rafId = this.runtime.requestAnimationFrame(update);
        return;
      }
      update();
    }

    ensureVisible(target) {
      if (!target || typeof target.getBoundingClientRect !== 'function') return;
      const rect = target.getBoundingClientRect();
      const viewportPadding = 24;
      const bottomPadding = 96;
      const outOfView = rect.top < viewportPadding
        || rect.bottom > this.runtime.innerHeight - bottomPadding
        || rect.left < 12
        || rect.right > this.runtime.innerWidth - 12;
      if (!outOfView || typeof target.scrollIntoView !== 'function') return;
      target.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'nearest',
      });
    }

    positionBubble(rect) {
      if (!this.bubble) return;
      const view = this.buildHighlightView(rect);
      this.bubble.style.top = view.bubble.top;
      this.bubble.style.left = view.bubble.left;
    }

    positionPointer(rect) {
      if (!this.pointer) return;
      const view = this.buildHighlightView(rect);
      this.pointer.style.top = view.pointer.top;
      this.pointer.style.left = view.pointer.left;
    }

    positionOverlay(rect) {
      if (!this.overlay) return;
      const view = this.buildHighlightView(rect);
      this.overlay.style.top = view.overlay.top;
      this.overlay.style.left = view.overlay.left;
      this.overlay.style.width = view.overlay.width;
      this.overlay.style.height = view.overlay.height;
    }

    positionElements() {
      if (!this.activeTarget || typeof this.activeTarget.getBoundingClientRect !== 'function') {
        this.hide();
        return;
      }
      this.ensureVisible(this.activeTarget);
      const rect = this.activeTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        this.hide();
        return;
      }
      this.positionOverlay(rect);
      this.positionBubble(rect);
      this.positionPointer(rect);
    }

    hide() {
      if (this.rafId && this.runtime.cancelAnimationFrame) this.runtime.cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.clearHighlight();
      if (this.overlay) {
        this.overlay.classList.remove('active');
        this.overlay.style.top = '';
        this.overlay.style.left = '';
        this.overlay.style.width = '';
        this.overlay.style.height = '';
      }
      if (this.bubble) {
        this.bubble.classList.remove('active');
        this.bubble.classList.remove('soft');
        this.bubble.textContent = '';
        this.bubble.style.top = '';
        this.bubble.style.left = '';
        this.bubble.style.maxWidth = '';
      }
      if (this.pointer) {
        this.pointer.classList.remove('active');
        this.pointer.style.top = '';
        this.pointer.style.left = '';
      }
    }

    show(target, message) {
      if (!target) {
        this.hide();
        return;
      }
      this.clearHighlight();
      this.activeTarget = target;
      this.activeMessage = message;
      if (this.overlay) this.overlay.classList.add('active');
      if (this.bubble) {
        this.bubble.textContent = message;
        this.bubble.classList.add('active');
        this.bubble.classList.remove('soft');
        this.bubble.style.maxWidth = '';
      }
      if (this.pointer) this.pointer.classList.add('active');
      this.schedulePositionUpdate();
    }

    showSoft(message) {
      if (this.rafId && this.runtime.cancelAnimationFrame) this.runtime.cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.clearHighlight();
      if (this.overlay) this.overlay.classList.remove('active');
      if (this.pointer) this.pointer.classList.remove('active');
      if (this.bubble) {
        this.bubble.textContent = '';
        this.bubble.classList.remove('active');
        this.bubble.classList.remove('soft');
        this.bubble.style.top = '';
        this.bubble.style.left = '';
        this.bubble.style.maxWidth = '';
      }
      if (typeof this.onSoftGuide === 'function') this.onSoftGuide(message);
    }
  }

  global.TutorialUIRenderer = TutorialUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
