(function (global) {
  class UIStatePresenter {
    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static trimDecimal(value) {
      return String(value).replace(/\.0$/, '');
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
      const food = this.formatResourceAmount(resources.food);
      const knowledge = this.formatResourceAmount(resources.knowledge);
      const wood = hasWood ? this.formatResourceAmount(resources.wood) : 0;

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
          foodConsumptionRate: this.formatNegativeRate(foodConsumption),
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

    static getBuildingLevel(buildings, id) {
      if (global.FrontendBuildingState?.getLevel) {
        return global.FrontendBuildingState.getLevel(buildings, id);
      }
      const entry = buildings?.[id];
      return entry && typeof entry === 'object' ? this.toInteger(entry.level) : this.toInteger(entry);
    }

    static getBuildingActionLabel(cost, level) {
      if (global.FrontendBuildingState?.getActionLabel) {
        return global.FrontendBuildingState.getActionLabel(cost, level);
      }
      if (cost === null) return '已满级';
      return level > 0 ? '升级' : '建造';
    }

    static getVisibleBuildingIds(state = {}) {
      const unlocked = Array.isArray(state.unlockedBuildings) ? state.unlockedBuildings : [];
      const built = Object.entries(state.buildings || {})
        .filter(([, entry]) => (entry && typeof entry === 'object' ? entry.level : entry) > 0)
        .map(([id]) => id);
      return Array.from(new Set([...unlocked, ...built]));
    }

    static getBuildingConfig(state = {}, buildingConfig = {}, id) {
      return state.buildingDefinitions?.[id] || buildingConfig[id] || null;
    }

    static buildCostViewState(cost) {
      if (cost === null) return { text: '已满级', parts: [], isMax: true };
      if (!cost) return { text: '免费建造', parts: [], isMax: false };
      const parts = ['food', 'wood', 'knowledge', 'stone', 'metal']
        .filter((resource) => cost[resource])
        .map((resource) => ({
          resource,
          value: cost[resource],
          text: this.formatResourceAmount(cost[resource]),
        }));
      return {
        text: parts.length ? '' : '免费建造',
        parts,
        isMax: false,
      };
    }

    static formatEffectPart(template, effect) {
      if (!template?.field || !template?.label) return '';
      const value = effect?.[template.field];
      if (typeof value !== 'number') return '';
      if (template.format === 'percent') {
        return `${template.label} +${Math.round(value * 100)}%`;
      }
      return `${template.label} +${value}`;
    }

    static getBuildingEffectText(config, buildingEffects = {}) {
      const effect = buildingEffects?.byBuilding?.[config?.id] || {};
      const templates = config?.ui?.effectText || [];
      const parts = templates
        .map((template) => this.formatEffectPart(template, effect))
        .filter(Boolean);
      return parts.join('，');
    }

    static getBuildingMilitaryLines(id, military = {}, buildingEffects = {}) {
      if (id !== 'barracks' || !military || !military.soldierCap) return [];
      const soldiers = this.toInteger(military.soldiers);
      const cap = this.toInteger(military.soldierCap);
      const progress = this.toInteger(military.trainingProgress);
      const interval = this.toInteger(military.trainingIntervalSeconds);
      const defense = this.toInteger((military.defense || 0) + (buildingEffects?.threatDefense || 0));
      return [
        `士兵 ${soldiers}/${cap} · 防御 ${defense}`,
        soldiers >= cap ? '训练已满' : `下一名 ${progress}/${interval}秒`,
      ];
    }

    static buildBuildingCardViewState(state = {}, tutorial = {}, buildingConfig = {}, id) {
      const config = this.getBuildingConfig(state, buildingConfig, id);
      if (!config) return null;
      const level = this.getBuildingLevel(state.buildings, id);
      const cost = state.buildingCosts && Object.prototype.hasOwnProperty.call(state.buildingCosts, id)
        ? state.buildingCosts[id]
        : undefined;
      const actionLabel = this.getBuildingActionLabel(cost, level);
      const disabledByTutorial = Boolean(tutorial && !tutorial.completed && (
        (tutorial.currentStep === 5 && id !== 'farm')
        || (tutorial.currentStep === 7 && id !== 'house')
        || (tutorial.currentStep >= 13 && tutorial.currentStep <= 14 && id !== 'lumbermill')
      ));
      const isMax = cost === null || actionLabel === '已满级' || actionLabel === '宸叉弧绾?' || actionLabel === 'max';
      const disabled = disabledByTutorial || isMax;
      const effectText = this.getBuildingEffectText(config, state.buildingEffects);
      const militaryLines = this.getBuildingMilitaryLines(id, state.military, state.buildingEffects);
      const descText = config?.ui?.description || '';

      return {
        id,
        name: config.name || id,
        art: config.art || '',
        icon: config.icon || '',
        level,
        levelText: `等级 ${level}`,
        isMuted: disabledByTutorial,
        effectText,
        descText,
        militaryLines,
        button: {
          action: level ? 'upgrade' : 'build',
          disabled,
          label: disabledByTutorial ? '引导中锁定' : actionLabel,
        },
        cost: this.buildCostViewState(cost),
        structure: {
          hasEffect: Boolean(effectText),
          hasMilitary: militaryLines.length > 0,
          hasDescription: Boolean(descText),
        },
      };
    }

    static buildBuildingViewState(state = {}, tutorial = {}, buildingConfig = {}) {
      const ids = this.getVisibleBuildingIds(state);
      const cards = ids
        .map((id) => this.buildBuildingCardViewState(state, tutorial, buildingConfig, id))
        .filter(Boolean);
      return {
        ids: cards.map((card) => card.id),
        isEmpty: cards.length === 0,
        emptyText: '当前时代暂无可建造建筑',
        cards,
        structureSignature: JSON.stringify(cards.map((card) => ({
          id: card.id,
          name: card.name,
          art: card.art,
          icon: card.icon,
          structure: card.structure,
        }))),
      };
    }
  }

  global.UIStatePresenter = UIStatePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
