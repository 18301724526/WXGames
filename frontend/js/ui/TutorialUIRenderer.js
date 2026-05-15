(function (global) {
  class TutorialUIRenderer {
    constructor() {
      this.overlay = document.getElementById('tutorialOverlay');
      this.bubble = document.getElementById('tutorialBubble');
      this.pointer = document.getElementById('tutorialPointer');
      this.activeTarget = null;
    }

    clearHighlight() {
      if (this.activeTarget) {
        this.activeTarget.classList.remove('tutorial-highlight');
        this.activeTarget = null;
      }
    }

    hide() {
      this.clearHighlight();
      if (this.overlay) this.overlay.classList.remove('active');
      if (this.bubble) {
        this.bubble.classList.remove('active');
        this.bubble.textContent = '';
      }
      if (this.pointer) this.pointer.classList.remove('active');
    }

    show(target, message) {
      if (!target) {
        this.hide();
        return;
      }
      this.clearHighlight();
      this.activeTarget = target;
      target.classList.add('tutorial-highlight');
      const rect = target.getBoundingClientRect();
      if (this.overlay) this.overlay.classList.add('active');
      if (this.bubble) {
        this.bubble.textContent = message;
        this.bubble.classList.add('active');
        this.bubble.style.top = `${Math.max(12, rect.top - 70)}px`;
        this.bubble.style.left = `${Math.min(window.innerWidth - 220, Math.max(12, rect.left))}px`;
      }
      if (this.pointer) {
        this.pointer.classList.add('active');
        this.pointer.style.top = `${rect.bottom + 8}px`;
        this.pointer.style.left = `${rect.left + rect.width / 2 - 12}px`;
      }
    }
  }

  global.TutorialUIRenderer = TutorialUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
