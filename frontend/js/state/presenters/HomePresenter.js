(function (global) {
  class HomePresenter {
    static POPULATION_PER_OFFICIAL = 100;

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static trimDecimal(value) {
      const text = `${value}`;
      return text.endsWith('.0') ? text.slice(0, -2) : text;
    }

    static formatCompactNumber(value, options = {}) {
      const number = this.toNumber(value);
      const floorSmall = options.floorSmall !== false;
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) {
        return floorSmall ? Math.floor(number) : this.trimDecimal(Math.round(number * 100) / 100);
      }
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${this.trimDecimal(scaled.toFixed(1))}${unit.suffix}`;
    }

    static formatResourceAmount(value) {
      return this.formatCompactNumber(value, { floorSmall: true });
    }

    static formatRate(value) {
      const number = this.toNumber(value);
      return `${number >= 0 ? '+' : ''}${this.formatCompactNumber(number, { floorSmall: false })}/s`;
    }

    static formatNegativeRate(value) {
      return `-${this.formatCompactNumber(Math.abs(this.toNumber(value)), { floorSmall: false })}/s`;
    }

    static toDisplayPopulation(officials) {
      return this.toInteger(officials) * this.POPULATION_PER_OFFICIAL;
    }

    static calculatePopulationGrowthMultiplier(habitability = 0) {
      const score = this.toNumber(habitability);
      return Math.round(Math.max(0.5, Math.min(1.5, 1 + score / 100)) * 100) / 100;
    }

    static formatPopulationGrowthStatus(growthMultiplier = 1) {
      const multiplier = this.toNumber(growthMultiplier, 1);
      if (multiplier <= 0.55) return '人口成长停滞';
      if (multiplier < 0.9) return '人口成长缓慢';
      if (multiplier < 1.08) return '人口成长平稳';
      if (multiplier < 1.25) return '人口成长良好';
      return '人口成长旺盛';
    }

    static buildResourceViewState(state = {}) {
      const resources = state.resources || {};
      const population = state.population || {};
      const capacity = population.capacity || {};
      const foodOutput = this.toNumber(resources.foodOutputPerSecond);
      const foodConsumption = this.toNumber(resources.foodConsumptionPerSecond);
      const knowledgeRate = this.toNumber(resources.knowledgePerSecond);
      const woodRate = this.toNumber(resources.woodPerSecond);
      const ironRate = this.toNumber(resources.ironPerSecond ?? resources.metalPerSecond);
      const stoneRate = this.toNumber(resources.stonePerSecond);
      const foodNet = Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
        ? this.toNumber(resources.foodNetPerSecond)
        : this.toNumber(resources.foodPerSecond);
      const food = this.formatResourceAmount(resources.food);
      const knowledge = this.formatResourceAmount(resources.knowledge);
      const wood = this.formatResourceAmount(resources.wood);
      const iron = this.formatResourceAmount(resources.iron ?? resources.metal);
      const stone = this.formatResourceAmount(resources.stone);
      const populationTotal = this.toInteger(population.total ?? state.totalPop);
      const eraCap = this.toInteger(capacity.eraCap ?? population.eraCap);
      const housingCap = this.toInteger(capacity.housingCap ?? population.housingCap);
      const populationAtEraCap = Boolean(
        capacity.active
        && capacity.limitingSource === 'era'
        && eraCap > 0
        && housingCap > 0
        && populationTotal >= eraCap
        && eraCap <= housingCap,
      );

      return {
        hasWood: true,
        hasIron: true,
        hasStone: true,
        foodNet,
        population: {
          total: populationTotal,
          display: this.toDisplayPopulation(populationTotal),
          atEraCap: populationAtEraCap,
        },
        text: {
          foodValue: food,
          knowledgeValue: knowledge,
          woodValue: wood,
          ironValue: iron,
          stoneValue: stone,
          foodDetailValue: food,
          knowledgeDetailValue: knowledge,
          woodDetailValue: wood,
          ironDetailValue: iron,
          stoneDetailValue: stone,
          foodRate: this.formatRate(foodNet),
          foodOutputRate: this.formatRate(foodOutput),
          foodConsumptionRate: this.formatNegativeRate(foodConsumption),
          foodNetRate: this.formatRate(foodNet),
          knowledgeRate: this.formatRate(knowledgeRate),
          woodRate: this.formatRate(woodRate),
          ironRate: this.formatRate(ironRate),
          stoneRate: this.formatRate(stoneRate),
          knowledgeDetailRate: this.formatRate(knowledgeRate),
          woodDetailRate: this.formatRate(woodRate),
          ironDetailRate: this.formatRate(ironRate),
          stoneDetailRate: this.formatRate(stoneRate),
          happinessValue: state.happiness || 100,
          gameTime: `第 ${state.gameDay || 1} 天`,
          populationValue: this.toDisplayPopulation(populationTotal),
          populationStatus: populationAtEraCap ? '人口已无法增长，请推进时代' : '',
        },
        classState: {
          foodNetRate: {
            'is-positive': foodNet >= 0,
            'is-negative': foodNet < 0,
          },
        },
      };
    }

    static getActiveCity(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const activeCityId = state.activeCityId || cityState.activeCityId || cityState.capitalCityId || 'capital';
      return cities.find((city) => city.id === activeCityId) || cities[0] || null;
    }

    static buildCityPlanningViewState(state = {}) {
      const activeCity = this.getActiveCity(state) || {};
      const planning = activeCity.planning || {};
      const habitability = this.toInteger(
        planning.habitability ?? activeCity.habitability,
        0,
      );
      const label = planning.habitabilityLabel || activeCity.habitabilityLabel || '平稳';
      const terrainLabel = planning.terrainLabel || activeCity.terrainLabel || '平原';
      const notes = Array.isArray(planning.habitabilityNotes) ? planning.habitabilityNotes : [];
      const growthMultiplier = this.toNumber(
        planning.populationGrowthMultiplier ?? activeCity.populationGrowthMultiplier ?? state.population?.growthMultiplier,
        this.calculatePopulationGrowthMultiplier(habitability),
      );
      return {
        terrainId: planning.terrainId || activeCity.terrain || 'plains',
        terrainLabel,
        terrainSummary: planning.terrainSummary || '适合均衡建设。',
        terrainHint: planning.terrainHint || '保持建筑搭配，会让城市更稳定。',
        habitability,
        habitabilityLabel: label,
        habitabilityTone: planning.habitabilityTone || 'neutral',
        populationGrowthMultiplier: growthMultiplier,
        habitabilitySummary: planning.habitabilitySummary || `${terrainLabel}城市规划${label}`,
        habitabilityNotes: notes,
        text: {
          terrain: terrainLabel,
          habitability: `${habitability >= 0 ? '+' : ''}${habitability}`,
          habitabilityLabel: label,
          habitabilityStatus: `宜居度${label}`,
          populationGrowthStatus: this.formatPopulationGrowthStatus(growthMultiplier),
          summary: planning.habitabilitySummary || `${terrainLabel}城市规划${label}`,
          note: notes[0] || planning.terrainHint || '保持建筑搭配，会让城市更稳定。',
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
      const totalOfficials = this.toInteger(pop.total ?? state.totalPop);
      const maxOfficials = this.toInteger(pop.maxPop ?? pop.max ?? state.maxPop);

      return {
        showCraftsman: currentEra >= 2,
        unassigned,
        jobs,
        planning: this.buildCityPlanningViewState(state),
        text: {
          title: '人才分配',
          subtitle: '核心岗位',
          total: totalOfficials,
          max: maxOfficials,
          unassigned,
          population: this.toDisplayPopulation(totalOfficials),
          maxPopulation: this.toDisplayPopulation(maxOfficials),
        },
      };
    }

    static buildCitySwitcherViewState(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const hidden = cities.length <= 1;
      const activeCityId = state.activeCityId || cityState.activeCityId || cityState.capitalCityId || 'capital';
      const activeCity = this.getActiveCity(state);
      const options = cities.map((city) => {
        const isActive = city.id === activeCityId;
        const officials = this.toInteger(city.population?.total);
        const population = this.toDisplayPopulation(officials);
        const buildings = this.toInteger(city.totalBuildings);
        const planning = city.planning || {};
        const terrainLabel = planning.terrainLabel || city.terrainLabel || '平原';
        const habitabilityLabel = planning.habitabilityLabel || city.habitabilityLabel || '平稳';
        return {
          id: city.id || '',
          name: city.name || '未命名城市',
          tag: city.isCapital ? '主城' : '分城',
          officials,
          population,
          buildings,
          terrainLabel,
          habitabilityLabel,
          metaText: `人口 ${population} · ${terrainLabel} · 宜居${habitabilityLabel}`,
          isActive,
        };
      });

      return {
        hidden,
        activeCityId,
        activeCityName: activeCity?.name || '首都',
        activeTerrainLabel: activeCity?.planning?.terrainLabel || activeCity?.terrainLabel || '平原',
        activeHabitabilityLabel: activeCity?.planning?.habitabilityLabel || activeCity?.habitabilityLabel || '平稳',
        options,
        signature: JSON.stringify(options),
      };
    }

    static buildHomeFeatureViewState(state = {}, options = {}) {
      const tasks = options.taskCenterViewState
        || (typeof options.buildTaskCenterViewState === 'function'
          ? options.buildTaskCenterViewState(state)
          : { summary: { claimableCount: 0 } });
      const entries = [
        {
          id: 'tasks',
          label: '任务',
          icon: 'assets/art/icon-event-cutout.webp',
          statusText: tasks.summary?.claimableCount > 0 ? '可领取' : '进行中',
          badge: this.toInteger(tasks.summary?.claimableCount),
          action: { type: 'openTaskCenter', source: 'taskIcon', tab: 'main' },
        },
        {
          id: 'guidebook',
          label: '攻略',
          icon: 'assets/art/icon-knowledge-cutout.webp',
          statusText: '城市规划',
          badge: 0,
          action: { type: 'openGuidebook', source: 'homeFeature' },
        },
      ];
      return {
        title: '功能',
        subtitle: '从这里进入文明的更多系统',
        entries,
      };
    }
  }

  global.HomePresenter = HomePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = HomePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
