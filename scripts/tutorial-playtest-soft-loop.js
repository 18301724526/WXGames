const DEFAULT_SOFT_LOOP_THRESHOLD = 8;

class TutorialPlaytestSoftLoopGuard {
  constructor(options = {}) {
    const threshold = Number(options.threshold ?? DEFAULT_SOFT_LOOP_THRESHOLD);
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw new Error('soft-loop threshold must be a positive integer');
    }
    this.threshold = threshold;
    this.key = '';
    this.count = 0;
    this.lastObservation = null;
  }

  reset() {
    this.key = '';
    this.count = 0;
    this.lastObservation = null;
  }

  observe(options = {}) {
    const label = String(options.label || '').trim();
    const beforeStep = Number(options.beforeStep);
    const afterStep = Number(options.afterStep);
    const noProgress = Number.isFinite(beforeStep)
      && Number.isFinite(afterStep)
      && beforeStep === afterStep;

    if (!label || !noProgress) {
      this.reset();
      return {
        schema: 'tutorial-playtest-soft-loop/v1',
        triggered: false,
        count: 0,
        threshold: this.threshold,
        label,
        step: Number.isFinite(afterStep) ? afterStep : null,
      };
    }

    const key = `${beforeStep}\u0000${label}`;
    if (this.key === key) this.count += 1;
    else {
      this.key = key;
      this.count = 1;
    }

    this.lastObservation = {
      schema: 'tutorial-playtest-soft-loop/v1',
      triggered: this.count >= this.threshold,
      count: this.count,
      threshold: this.threshold,
      label,
      step: beforeStep,
      highlight: options.highlight || null,
    };
    return this.lastObservation;
  }

  getSnapshot() {
    return this.lastObservation;
  }
}

module.exports = {
  DEFAULT_SOFT_LOOP_THRESHOLD,
  TutorialPlaytestSoftLoopGuard,
};
