// Population panel remains DOM-backed for now, but it consumes a renderer-neutral
// view state so the same data can feed a future canvas or mini-game renderer.
window.mountPopulationMethods = function mountPopulationMethods(game) {
  game.renderPopulation = function renderPopulation() {
    const view = window.UIStatePresenter.buildPopulationViewState(this.state);
    Object.entries(view.text).forEach(([id, value]) => this.setText(id, value));
  };

  game.updatePopulationButtons = function updatePopulationButtons() {
    const view = window.UIStatePresenter.buildPopulationViewState(this.state);
    const jobs = new Map(view.jobs.map((job) => [job.id, job]));

    document.querySelectorAll('.job-controls .btn-plus').forEach((button) => {
      const job = jobs.get(button.dataset.job);
      button.disabled = !job || !job.canIncrease;
    });

    document.querySelectorAll('.job-controls .btn-minus').forEach((button) => {
      const job = jobs.get(button.dataset.job);
      button.disabled = !job || !job.canDecrease;
    });

    const craftsmanCard = document.getElementById('craftsmanCard');
    if (craftsmanCard) craftsmanCard.style.display = view.showCraftsman ? '' : 'none';
  };

  game.assignJob = async function assignJob(job, delta) {
    if (!this.token) {
      this.log('请先登录');
      return;
    }

    try {
      const result = await this.apiPost('/game/action', {
        action: 'assign',
        target: job,
        count: delta,
      });

      if (result.success) {
        this.applyApiState(result);
        if (job === 'craftsman' && delta > 0 && this.tutorialController) {
          this.tutorialController.notifyCraftsmanAssigned(result.tutorial);
        }
        this.log(`人口分配 ${delta > 0 ? '+' : ''}${delta} ${job}`);
      } else {
        this.log(result.message || '人口分配失败');
        const data = await this.apiGet('/game/state');
        if (data.gameState) this.applyApiState(data);
      }
    } catch (error) {
      console.error('assignJob API error:', error);
      this.log('网络错误，人口分配失败');
      try {
        const data = await this.apiGet('/game/state');
        if (data.gameState) this.applyApiState(data);
      } catch (_) {}
    }
  };

  game.bindPopulationEvents = function bindPopulationEvents() {
    if (game._populationEventsBound) return;
    game._populationEventsBound = true;

    document.querySelectorAll('.job-controls button').forEach((button) => {
      if (button.dataset.popBound === 'true') return;
      button.dataset.popBound = 'true';

      button.addEventListener('click', (event) => {
        const target = event.target.closest('button[data-job]');
        if (!target) return;
        const delta = target.classList.contains('btn-plus') ? 1 : -1;
        this.assignJob(target.dataset.job, delta);
      });
    });
  };
};
