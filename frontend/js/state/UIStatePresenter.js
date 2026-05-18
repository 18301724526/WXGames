(function (global) {
  class UIStatePresenter {
    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static formatRate(value) {
      const number = this.toNumber(value);
      return `${number >= 0 ? '+' : ''}${number}/s`;
    }

    static buildResourceViewState(state = {}) {
      const resources = state.resources || {};
      const foodOutput = this.toNumber(resources.foodOutputPerSecond);
      const foodConsumption = this.toNumber(resources.foodConsumptionPerSecond);
      const knowledgeRate = this.toNumber(resources.knowledgePerSecond);
      const woodRate = this.toNumber(resources.woodPerSecond);
      const foodNet = Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
        ? this.toNumber(resources.foodNetPerSecond)
        : this.toNumber(resources.foodPerSecond);
      const hasWood = this.toNumber(state.currentEra) >= 2;
      const food = this.toInteger(resources.food);
      const knowledge = this.toInteger(resources.knowledge);
      const wood = hasWood ? this.toInteger(resources.wood) : 0;

      return {
        hasWood,
        foodNet,
        text: {
          foodValue: food,
          knowledgeValue: knowledge,
          woodValue: wood,
          foodDetailValue: food,
          knowledgeDetailValue: knowledge,
          woodDetailValue: wood,
          foodRate: this.formatRate(foodNet),
          foodOutputRate: this.formatRate(foodOutput),
          foodConsumptionRate: `-${Math.abs(foodConsumption)}/s`,
          foodNetRate: this.formatRate(foodNet),
          knowledgeRate: this.formatRate(knowledgeRate),
          woodRate: hasWood ? this.formatRate(woodRate) : '+0/s',
          knowledgeDetailRate: this.formatRate(knowledgeRate),
          woodDetailRate: hasWood ? this.formatRate(woodRate) : '+0/s',
          happinessValue: state.happiness || 100,
          gameTime: `第 ${state.gameDay || 1} 天`,
        },
        classState: {
          resourcePanel: { 'has-era-two': hasWood },
          foodNetRate: {
            'is-positive': foodNet >= 0,
            'is-negative': foodNet < 0,
          },
        },
        visibility: {
          woodCard: hasWood,
          woodDetailCard: hasWood,
        },
      };
    }

    static buildPopulationViewState(state = {}) {
      const pop = state.population || {};
      const currentEra = this.toNumber(state.currentEra);
      const unassigned = this.toInteger(pop.unassigned);
      const counts = {
        farmer: this.toInteger(pop.farmers ?? state.farmers),
        scholar: this.toInteger(pop.scholars ?? state.scholars),
        craftsman: this.toInteger(pop.craftsmen ?? state.craftsmen),
      };
      const jobs = [
        { id: 'farmer', count: counts.farmer, visible: true },
        { id: 'scholar', count: counts.scholar, visible: true },
        { id: 'craftsman', count: counts.craftsman, visible: currentEra >= 2 },
      ].map((job) => ({
        ...job,
        canIncrease: unassigned > 0,
        canDecrease: job.count > 0,
      }));

      return {
        showCraftsman: currentEra >= 2,
        unassigned,
        jobs,
        text: {
          totalPop: this.toInteger(pop.total ?? state.totalPop),
          maxPop: this.toInteger(pop.maxPop ?? pop.max ?? state.maxPop),
          unassignedPop: unassigned,
          farmerCount: counts.farmer,
          scholarCount: counts.scholar,
          craftsmanCount: counts.craftsman,
        },
      };
    }
  }

  global.UIStatePresenter = UIStatePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
