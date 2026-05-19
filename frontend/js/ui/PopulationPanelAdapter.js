(function (global) {
  class PopulationPanelAdapter {
    constructor(elements = {}) {
      this.jobButtons = elements.jobButtons || [];
      this.craftsmanCard = elements.craftsmanCard || null;
    }

    static fromDocument(doc = document) {
      const jobButtons = typeof doc.querySelectorAll === 'function'
        ? Array.from(doc.querySelectorAll('.job-controls button'))
        : [];
      return new PopulationPanelAdapter({
        jobButtons,
        craftsmanCard: doc.getElementById('craftsmanCard'),
      });
    }

    render(view = {}) {
      const jobs = new Map((view.jobs || []).map((job) => [job.id, job]));
      this.jobButtons.forEach((button) => {
        const job = jobs.get(button.dataset?.job);
        const isIncrease = button.classList?.contains('btn-plus');
        button.disabled = isIncrease ? !job?.canIncrease : !job?.canDecrease;
      });
      if (this.craftsmanCard) this.craftsmanCard.style.display = view.showCraftsman ? '' : 'none';
    }

    bind(onAssign) {
      this.jobButtons.forEach((button) => {
        if (button.dataset?.popBound === 'true') return;
        button.dataset.popBound = 'true';
        button.addEventListener?.('click', (event) => {
          const target = event.target.closest('button[data-job]');
          if (!target) return;
          const delta = target.classList.contains('btn-plus') ? 1 : -1;
          onAssign(target.dataset.job, delta);
        });
      });
    }
  }

  global.PopulationPanelAdapter = PopulationPanelAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = PopulationPanelAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
