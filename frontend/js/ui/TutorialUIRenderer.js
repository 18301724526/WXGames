(function (global) {
  class TutorialUIRenderer {
    constructor() {
      this.overlay = document.getElementById('tutorialOverlay');
      this.bubble = document.getElementById('tutorialBubble');
      this.pointer = document.getElementById('tutorialPointer');
      this.scrollContainer = document.querySelector('.page-container');
      this.activeTarget = null;
      this.activeMessage = '';
      this.rafId = null;

      this.handleViewportChange = () => this.schedulePositionUpdate();
      global.addEventListener && global.addEventListener('resize', this.handleViewportChange);
      if (this.scrollContainer && this.scrollContainer.addEventListener) {
        this.scrollContainer.addEventListener('scroll', this.handleViewportChange, { passive: true });
      }
    }

    clearHighlight() {
      this.activeTarget = null;
      this.activeMessage = '';
    }

    positionSoftBubble() {
      if (!this.bubble) return;
      const bubbleWidth = Math.min(320, Math.max(220, global.innerWidth - 32));
      const top = 16;
      const left = Math.max(12, Math.round((global.innerWidth - bubbleWidth) / 2));
      this.bubble.style.top = `${top}px`;
      this.bubble.style.left = `${left}px`;
      this.bubble.style.maxWidth = `${bubbleWidth}px`;
    }

    schedulePositionUpdate() {
      if (!this.activeTarget) return;
      if (this.rafId && global.cancelAnimationFrame) global.cancelAnimationFrame(this.rafId);
      const update = () => {
        this.rafId = null;
        this.positionElements();
      };
      if (global.requestAnimationFrame) {
        this.rafId = global.requestAnimationFrame(update);
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
        || rect.bottom > global.innerHeight - bottomPadding
        || rect.left < 12
        || rect.right > global.innerWidth - 12;
      if (!outOfView || typeof target.scrollIntoView !== 'function') return;
      target.scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'nearest',
      });
    }

    positionBubble(rect) {
      if (!this.bubble) return;
      const bubbleWidth = 220;
      const bubbleHeight = 72;
      const horizontalPadding = 12;
      const viewportTopPadding = 12;
      const prefersBelow = rect.top < bubbleHeight + 28;
      const bubbleTop = prefersBelow
        ? Math.min(global.innerHeight - bubbleHeight - viewportTopPadding, rect.bottom + 14)
        : Math.max(viewportTopPadding, rect.top - bubbleHeight - 14);
      const bubbleLeft = Math.max(
        horizontalPadding,
        Math.min(global.innerWidth - bubbleWidth - horizontalPadding, rect.left + rect.width / 2 - bubbleWidth / 2),
      );
      this.bubble.style.top = `${bubbleTop}px`;
      this.bubble.style.left = `${bubbleLeft}px`;
    }

    positionPointer(rect) {
      if (!this.pointer) return;
      const pointerWidth = 24;
      const pointerHeight = 28;
      const top = Math.max(
        12,
        Math.min(global.innerHeight - pointerHeight - 12, rect.bottom + 6),
      );
      const left = Math.max(
        12,
        Math.min(global.innerWidth - pointerWidth - 12, rect.left + rect.width / 2 - pointerWidth / 2),
      );
      this.pointer.style.top = `${top}px`;
      this.pointer.style.left = `${left}px`;
    }

    positionOverlay(rect) {
      if (!this.overlay) return;
      const padding = 8;
      const top = Math.max(6, rect.top - padding);
      const left = Math.max(6, rect.left - padding);
      const width = Math.max(28, Math.min(global.innerWidth - left - 6, rect.width + padding * 2));
      const height = Math.max(28, Math.min(global.innerHeight - top - 6, rect.height + padding * 2));
      this.overlay.style.top = `${top}px`;
      this.overlay.style.left = `${left}px`;
      this.overlay.style.width = `${width}px`;
      this.overlay.style.height = `${height}px`;
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
      if (this.rafId && global.cancelAnimationFrame) global.cancelAnimationFrame(this.rafId);
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
      }
      if (this.pointer) this.pointer.classList.add('active');
      this.schedulePositionUpdate();
    }

    showSoft(message) {
      if (this.rafId && global.cancelAnimationFrame) global.cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.clearHighlight();
      if (this.overlay) this.overlay.classList.remove('active');
      if (this.pointer) this.pointer.classList.remove('active');
      if (this.bubble) {
        this.bubble.textContent = message;
        this.bubble.classList.add('active');
        this.bubble.classList.add('soft');
        this.positionSoftBubble();
      }
    }
  }

  global.TutorialUIRenderer = TutorialUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
