window.mountPopulationMethods = function mountPopulationMethods(game) {
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
};
