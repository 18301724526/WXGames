(function (global) {
  class ResourceRenderer {
    constructor(setText) {
      this.setText = setText;
    }

    render(state) {
      const resources = state.resources || {};
      const foodOutput = Number(resources.foodOutputPerSecond || 0);
      const foodConsumption = Number(resources.foodConsumptionPerSecond || 0);
      const knowledgeRate = Number(resources.knowledgePerSecond || 0);
      const woodRate = Number(resources.woodPerSecond || 0);
      const foodNet = Number(
        Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
          ? resources.foodNetPerSecond
          : resources.foodPerSecond || 0,
      );
      const hasWoodLayout = state.currentEra >= 2;
      const panel = document.getElementById('resourcePanel');
      const woodCard = document.getElementById('woodCard');
      if (panel) panel.classList.toggle('has-era-two', hasWoodLayout);
      if (woodCard) {
        woodCard.hidden = !hasWoodLayout;
        woodCard.classList.toggle('is-hidden', !hasWoodLayout);
        woodCard.style.display = hasWoodLayout ? '' : 'none';
      }
      const woodDetailCard = document.getElementById('woodDetailCard');
      if (woodDetailCard) {
        woodDetailCard.hidden = !hasWoodLayout;
        woodDetailCard.classList.toggle('is-hidden', !hasWoodLayout);
        woodDetailCard.style.display = hasWoodLayout ? '' : 'none';
      }

      this.setText('foodValue', Math.floor(resources.food || 0));
      this.setText('knowledgeValue', Math.floor(resources.knowledge || 0));
      this.setText('woodValue', hasWoodLayout ? Math.floor(resources.wood || 0) : 0);
      this.setText('foodDetailValue', Math.floor(resources.food || 0));
      this.setText('knowledgeDetailValue', Math.floor(resources.knowledge || 0));
      this.setText('woodDetailValue', hasWoodLayout ? Math.floor(resources.wood || 0) : 0);
      this.setText('foodRate', `${foodNet >= 0 ? '+' : ''}${foodNet}/s`);
      this.setText('foodOutputRate', `+${foodOutput}/s`);
      this.setText('foodConsumptionRate', `-${foodConsumption}/s`);
      this.setText('foodNetRate', `${foodNet >= 0 ? '+' : ''}${foodNet}/s`);
      this.setText('knowledgeRate', `${knowledgeRate >= 0 ? '+' : ''}${knowledgeRate}/s`);
      this.setText('woodRate', hasWoodLayout ? `${woodRate >= 0 ? '+' : ''}${woodRate}/s` : '+0/s');
      this.setText('knowledgeDetailRate', `${knowledgeRate >= 0 ? '+' : ''}${knowledgeRate}/s`);
      this.setText('woodDetailRate', hasWoodLayout ? `${woodRate >= 0 ? '+' : ''}${woodRate}/s` : '+0/s');
      this.setText('happinessValue', state.happiness || 100);
      this.setText('gameTime', `第 ${state.gameDay || 1} 天`);

      const netEl = document.getElementById('foodNetRate');
      if (netEl) {
        netEl.classList.toggle('is-positive', foodNet >= 0);
        netEl.classList.toggle('is-negative', foodNet < 0);
      }
    }
  }

  global.ResourceRenderer = ResourceRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = ResourceRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
