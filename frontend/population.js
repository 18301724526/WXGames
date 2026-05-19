// Population panel remains DOM-backed for now, but it consumes a renderer-neutral
// view state so the same data can feed a future canvas or mini-game renderer.
window.mountPopulationMethods = function mountPopulationMethods(game, deps = {}) {
  const presenter = deps.presenter;

  game.renderPopulation = function renderPopulation() {
    const view = presenter.buildPopulationViewState(this.state);
    Object.entries(view.text).forEach(([id, value]) => this.setText(id, value));
    this.populationPanel?.render(view);
  };

  game.updatePopulationButtons = function updatePopulationButtons() {
    const view = presenter.buildPopulationViewState(this.state);
    this.populationPanel?.render(view);
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
    this.populationPanel?.bind((job, delta) => this.assignJob(job, delta));
  };
};
