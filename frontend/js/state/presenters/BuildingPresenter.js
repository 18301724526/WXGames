(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class BuildingPresenter {
    static POPULATION_PER_OFFICIAL = 100;

    static t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

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

    static toDisplayPopulation(officials) {
      return this.toInteger(officials) * this.POPULATION_PER_OFFICIAL;
    }

    static getBuildingLevel(buildings, id) {
      const entry = buildings?.[id];
      return entry && typeof entry === 'object' ? this.toInteger(entry.level) : this.toInteger(entry);
    }

    static getBuildingActionLabel(cost, level) {
      if (cost === null) return this.t('building.action.maxLevel', {});
      return level > 0 ? this.t('building.action.upgrade', {}) : this.t('building.action.build', {});
    }

    static isBuildingOpenEnded(config = {}) {
      return Boolean(config?.scalePlan?.openEnded);
    }

    static getExtraBuildingEffectEfficiency(curve, extraIndex) {
      if (curve === 'linear') return 1;
      if (curve === 'step') return 0.5;
      const floor = 0.05;
      return floor + (1 - floor) / Math.sqrt(extraIndex + 2);
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

    static getBuildingCategoryDefinitions(state = {}, buildingConfig = {}) {
      const source = state.buildingCategories || buildingConfig.categories || {};
      const fallback = {
        agriculture: { label: this.t('building.category.agriculture', {}), order: 1 },
        livelihood: { label: this.t('building.category.livelihood', {}), order: 2 },
        production: { label: this.t('building.category.production', {}), order: 3 },
        culture: { label: this.t('building.category.culture', {}), order: 4 },
        entertainment: { label: this.t('building.category.entertainment', {}), order: 5 },
        military: { label: this.t('building.category.military', {}), order: 6 },
      };
      return { ...fallback, ...(source && typeof source === 'object' ? source : {}) };
    }

    static getBuildingCategory(config = {}) {
      return config.category || 'production';
    }

    static buildBuildingCategoryTabs(cards = [], activeCategory = 'all', definitions = {}) {
      const counts = cards.reduce((result, card) => {
        const category = card.category || 'production';
        result[category] = (result[category] || 0) + 1;
        return result;
      }, {});
      const categoryTabs = Object.entries(definitions)
        .map(([id, definition]) => ({
          id,
          label: definition?.label || id,
          order: Number(definition?.order) || 99,
          count: counts[id] || 0,
        }))
        .filter((tab) => tab.count > 0)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
      const tabs = [
        { id: 'all', label: this.t('building.category.all', {}), count: cards.length, active: activeCategory === 'all' },
        ...categoryTabs,
      ];
      const hasActive = tabs.some((tab) => tab.id === activeCategory && tab.count > 0);
      const resolvedActiveCategory = hasActive ? activeCategory : 'all';
      return tabs.map((tab) => ({
        ...tab,
        active: tab.id === resolvedActiveCategory,
      }));
    }

    static buildCostViewState(cost) {
      if (cost === null) return { text: this.t('building.action.maxLevel', {}), parts: [], isMax: true };
      if (!cost) return { text: this.t('building.cost.free', {}), parts: [], isMax: false };
      const parts = ['wood', 'iron', 'stone', 'food', 'knowledge', 'metal']
        .filter((resource) => cost[resource])
        .map((resource) => ({
          resource,
          value: cost[resource],
          text: this.formatResourceAmount(cost[resource]),
        }));
      return {
        text: parts.length ? '' : this.t('building.cost.free', {}),
        parts,
        isMax: false,
      };
    }

    static getBuildingEffectSummary(config = {}, level = 0) {
      const currentLevel = Math.max(0, this.toInteger(level));
      const perLevel = config.effects?.perLevel || {};
      const summary = { level: currentLevel };
      if (perLevel.foodOutputMultiplier) summary.foodOutputBonus = this.calculateBuildingEffectBonus(config, 'foodOutputMultiplier', currentLevel);
      if (perLevel.populationCap) summary.populationCapBonus = this.calculateBuildingEffectBonus(config, 'populationCap', currentLevel);
      if (perLevel.knowledgeOutputMultiplier) summary.knowledgeOutputBonus = this.calculateBuildingEffectBonus(config, 'knowledgeOutputMultiplier', currentLevel);
      if (perLevel.craftsmanOutputMultiplier) summary.craftsmanOutputBonus = this.calculateBuildingEffectBonus(config, 'craftsmanOutputMultiplier', currentLevel);
      if (perLevel.woodOutputBase) summary.woodOutputBase = this.calculateBuildingEffectBonus(config, 'woodOutputBase', currentLevel);
      if (perLevel.stoneOutputBase) summary.stoneOutputBase = this.calculateBuildingEffectBonus(config, 'stoneOutputBase', currentLevel);
      if (perLevel.ironOutputBase) summary.ironOutputBase = this.calculateBuildingEffectBonus(config, 'ironOutputBase', currentLevel);
      if (perLevel.offlineEfficiency) summary.offlineEfficiencyBonus = this.calculateBuildingEffectBonus(config, 'offlineEfficiency', currentLevel);
      if (perLevel.defense) summary.defenseLevel = this.calculateBuildingEffectBonus(config, 'defense', currentLevel);
      if (perLevel.threatDefense) summary.threatDefenseBonus = this.calculateBuildingEffectBonus(config, 'threatDefense', currentLevel);
      if (perLevel.globalOutputMultiplier) summary.globalOutputBonus = this.calculateBuildingEffectBonus(config, 'globalOutputMultiplier', currentLevel);
      return summary;
    }

    static calculateBuildingEffectBonus(config = {}, field = '', level = 0) {
      const currentLevel = Math.max(0, this.toInteger(level));
      const perLevel = this.toNumber(config.effects?.perLevel?.[field]);
      if (currentLevel <= 0 || perLevel <= 0) return 0;
      const configuredMaxLevel = this.toInteger(config.maxLevel);
      if (configuredMaxLevel <= 0) return Math.round(currentLevel * perLevel * 1000) / 1000;
      const maxLevel = Math.max(1, configuredMaxLevel);
      let total = Math.min(currentLevel, maxLevel) * perLevel;
      if (this.isBuildingOpenEnded(config) && currentLevel > maxLevel) {
        const curve = config.scalePlan?.effectCurve || 'diminishing';
        for (let index = 0; index < currentLevel - maxLevel; index += 1) {
          total += perLevel * this.getExtraBuildingEffectEfficiency(curve, index);
        }
      }
      return Math.round(total * 1000000) / 1000000;
    }

    static formatBuildingEffectValue(template, value, previousValue = null) {
      if (!template?.field || !template?.label || typeof value !== 'number' || value <= 0) return '';
      let totalText = '';
      let deltaText = '';
      const previous = typeof previousValue === 'number' ? previousValue : null;
      const delta = previous === null ? 0 : value - previous;
      if (template.field === 'populationCapBonus') {
        totalText = `${template.label} ${this.toDisplayPopulation(value)}`;
        if (delta > 0) {
          deltaText = this.t(
            'building.effect.delta',
            { value: this.toDisplayPopulation(delta) });
        }
      } else if (template.format === 'percent') {
        totalText = this.t(
          'building.effect.percentEfficiency',
          { label: template.label, percent: Math.round((1 + value) * 100) });
        if (delta > 0) {
          const deltaPercent = delta * 100;
          const valueText = `${deltaPercent < 1 ? '<1' : Math.round(deltaPercent)}%`;
          deltaText = this.t('building.effect.delta', { value: valueText });
        }
      } else {
        totalText = `${template.label} ${this.formatCompactNumber(value, { floorSmall: false })}`;
        if (delta > 0) {
          const valueText = this.formatCompactNumber(delta, { floorSmall: false });
          deltaText = this.t('building.effect.delta', { value: valueText });
        }
      }
      return deltaText ? `${totalText}（${deltaText}）` : totalText;
    }

    static formatMilitaryEffectParts(config = {}, level = 0, previousLevel = null) {
      const military = config.military || {};
      const currentLevel = Math.max(0, this.toInteger(level));
      const previous = previousLevel === null ? null : Math.max(0, this.toInteger(previousLevel));
      const parts = [];
      const soldierCaps = Array.isArray(military.soldierCapByLevel) ? military.soldierCapByLevel : [];
      const intervals = Array.isArray(military.trainingIntervalSecondsByLevel) ? military.trainingIntervalSecondsByLevel : [];
      const batchSizes = Array.isArray(military.trainingBatchSizeByLevel) ? military.trainingBatchSizeByLevel : [];
      const cap = this.toInteger(soldierCaps[currentLevel]);
      const previousCap = previous === null ? null : this.toInteger(soldierCaps[previous]);
      if (cap > 0) {
        const delta = previousCap === null ? 0 : cap - previousCap;
        parts.push(delta > 0
          ? this.t('building.military.soldierCapacityDelta', { cap, delta })
          : this.t('building.military.soldierCapacity', { cap }));
      }
      const interval = this.toInteger(intervals[currentLevel]);
      const previousInterval = previous === null ? null : this.toInteger(intervals[previous]);
      if (interval > 0) {
        const faster = previousInterval && previousInterval > interval ? previousInterval - interval : 0;
        const batchSize = this.toInteger(batchSizes[currentLevel], 1);
        const batchText = batchSize > 1
          ? this.t('building.military.batchRate', { seconds: interval, batchSize })
          : this.t('building.military.personRate', { seconds: interval });
        parts.push(faster > 0
          ? this.t('building.military.trainingRateDelta', { rate: batchText, seconds: faster })
          : this.t('building.military.trainingRate', { rate: batchText }));
      }
      return parts;
    }

    static formatBuildingEffectText(config = {}, level = 0, previousLevel = null, effectOverride = null) {
      const effect = effectOverride || this.getBuildingEffectSummary(config, level);
      const previousEffect = previousLevel === null ? null : this.getBuildingEffectSummary(config, previousLevel);
      const templates = config?.ui?.effectText || [];
      const parts = templates
        .map((template) => this.formatBuildingEffectValue(
          template,
          effect?.[template.field],
          previousEffect?.[template.field],
        ))
        .filter(Boolean);
      parts.push(...this.formatMilitaryEffectParts(config, level, previousLevel));
      return parts.join('，');
    }

    static getBuildingEffectText(config, buildingEffects = {}) {
      const effect = buildingEffects?.byBuilding?.[config?.id] || {};
      const level = this.toInteger(effect.level);
      return this.formatBuildingEffectText(config, level);
    }

    static getResourceDisplayName(resource) {
      return {
        food: this.t('resource.food', {}),
        knowledge: this.t('resource.knowledge', {}),
        wood: this.t('resource.wood', {}),
        iron: this.t('resource.iron', {}),
        stone: this.t('resource.stone', {}),
        metal: this.t('resource.metal', {}),
      }[resource] || resource;
    }

    static getMaintenanceResourceKeys(maintenance = {}) {
      return Object.entries(maintenance.perLevelPerMinute || {})
        .filter(([, value]) => this.toNumber(value) > 0)
        .map(([resource]) => resource);
    }

    static formatHabitabilityPressure(value) {
      const pressure = this.toNumber(value);
      if (pressure <= 0) return this.t('building.habitability.stable', {});
      if (pressure <= 1) return this.t('building.habitability.light', {});
      if (pressure <= 2) return this.t('building.habitability.high', {});
      return this.t('building.habitability.heavy', {});
    }

    static formatHabitabilityPressureShort(value) {
      const pressure = this.toNumber(value);
      if (pressure <= 0) return this.t('building.habitability.short.stable', {});
      if (pressure <= 1) return this.t('building.habitability.short.light', {});
      if (pressure <= 2) return this.t('building.habitability.short.high', {});
      return this.t('building.habitability.short.heavy', {});
    }

    static formatBuildingScale(level = 0) {
      const currentLevel = this.toInteger(level);
      if (currentLevel <= 0) return this.t('building.scale.unbuilt', {});
      if (currentLevel <= 2) return this.t('building.scale.small', {});
      if (currentLevel <= 4) return this.t('building.scale.medium', {});
      return this.t('building.scale.large', {});
    }

    static formatMaintenanceRate(value) {
      const perSecond = this.toNumber(value) / 60;
      if (perSecond <= 0) return '';
      const rounded = perSecond < 0.01
        ? Math.round(perSecond * 1000) / 1000
        : Math.round(perSecond * 100) / 100;
      return this.trimDecimal(rounded);
    }

    static formatBuildingMaintenanceText(config = {}, level = 0) {
      const maintenance = config.maintenance || {};
      const currentLevel = this.toInteger(level);
      if (currentLevel <= 0) return this.t('building.maintenance.none', {});
      const parts = Object.entries(maintenance.perLevelPerMinute || {})
        .map(([resource, value]) => {
          const rate = this.formatMaintenanceRate(this.toNumber(value) * currentLevel);
          return rate ? `${this.getResourceDisplayName(resource)} ${rate}/s` : '';
        })
        .filter(Boolean);
      if (!parts.length) return this.t('building.maintenance.none', {});
      const inlineSeparator = this.t('common.inlineSeparator', {});
      return this.t(
        'building.maintenance.required',
        { parts: parts.join(inlineSeparator) });
    }

    static formatBuildingCityImpactText(config = {}) {
      const pressure = this.formatHabitabilityPressure(config.maintenance?.habitabilityPressure);
      return this.t('building.cityImpact', { pressure });
    }

    static getBuildingMilitaryLines(id, military = {}, buildingEffects = {}) {
      if (id !== 'barracks' || !military || !military.soldierCap) return [];
      const soldiers = this.toInteger(military.soldiers);
      const cap = this.toInteger(military.soldierCap);
      const progress = this.toInteger(military.trainingProgress);
      const interval = this.toInteger(military.trainingIntervalSeconds);
      const batchSize = this.toInteger(military.trainingBatchSize, 1);
      const defense = this.toInteger((military.defense || 0) + (buildingEffects?.threatDefense || 0));
      return [
        this.t('building.military.line', { soldiers, cap, defense }),
        soldiers >= cap
          ? this.t('building.military.trainingFull', {})
          : this.t(
            'building.military.nextBatch',
            { batchSize, progress, interval }),
      ];
    }

    static canAffordCost(resources = {}, cost) {
      if (!cost || cost === null) return true;
      return ['wood', 'iron', 'stone', 'food', 'knowledge', 'metal']
        .every((resource) => this.toNumber(resources?.[resource]) >= this.toNumber(cost?.[resource]));
    }

    static buildBuildingCardViewState(state = {}, tutorial = {}, buildingConfig = {}, id) {
      const config = this.getBuildingConfig(state, buildingConfig, id);
      if (!config) return null;
      const level = this.getBuildingLevel(state.buildings, id);
      const cost = state.buildingCosts && Object.prototype.hasOwnProperty.call(state.buildingCosts, id)
        ? state.buildingCosts[id]
        : undefined;
      const actionLabel = this.getBuildingActionLabel(cost, level);
      const guideTarget = state.softGuide?.mode === 'strong' ? state.softGuide.target : null;
      const guidedBuildingId = {
        'card-farm': 'farm',
        'card-house': 'house',
        'card-lumbermill': 'lumbermill',
        'card-barracks': 'barracks',
        'card-watchtower': 'watchtower',
        'card-barracks-upgrade': 'barracks',
      }[guideTarget] || null;
      const tutorialSteps = global.TutorialGuideController?.TUTORIAL_STEPS || {
        houseGuideReady: 3,
        houseBuilt: 4,
        buildingsTabOpened: 7,
        farmBuilt: 9,
        buildingsTabOpenedForLumbermill: 14,
        lumbermillBuilt: 15,
      };
      const step = Number(tutorial?.currentStep) || 0;
      const disabledByTutorial = Boolean(tutorial && !tutorial.completed && guidedBuildingId !== id && (
        (step >= tutorialSteps.houseGuideReady && step < tutorialSteps.houseBuilt && id !== 'house')
        || (step >= tutorialSteps.buildingsTabOpened && step < tutorialSteps.farmBuilt && id !== 'farm')
        || (step >= tutorialSteps.buildingsTabOpenedForLumbermill && step <= tutorialSteps.lumbermillBuilt && id !== 'lumbermill')
      ));
      const maxLevelLabel = this.t('building.action.maxLevel', {});
      const isMax = cost === null || actionLabel === maxLevelLabel || actionLabel === 'max';
      const canAfford = this.canAffordCost(state.resources, cost);
      const disabledByCost = !isMax && !canAfford;
      const disabled = disabledByTutorial || isMax || disabledByCost;
      const maxLevel = this.toInteger(config.maxLevel);
      const nextLevel = isMax ? null : level + 1;
      const currentEffectSummary = state.buildingEffects?.byBuilding?.[id] || this.getBuildingEffectSummary(config, level);
      const noneText = this.t('building.effect.none', {});
      const currentEffectText = this.formatBuildingEffectText(config, level, null, currentEffectSummary) || noneText;
      const nextEffectValue = nextLevel === null
        ? this.t('building.effect.expansionLocked', {})
        : (this.formatBuildingEffectText(config, nextLevel, level) || noneText);
      const nextEffectLabel = level > 0
        ? this.t('building.effect.nextLevel', {})
        : this.t('building.effect.afterBuilt', {});
      const effectText = currentEffectText === noneText ? '' : currentEffectText;
      const militaryLines = this.getBuildingMilitaryLines(id, state.military, state.buildingEffects);
      const descText = config?.ui?.description || '';

      return {
        id,
        name: config.name || id,
        art: config.art || '',
        icon: config.icon || '',
        level,
        levelText: this.t('building.level', { level }),
        category: this.getBuildingCategory(config),
        maxLevel,
        scaleText: this.t('building.scaleText', { scale: this.formatBuildingScale(level) }),
        metaText: this.t(
          'building.meta',
          { level, scale: this.formatBuildingScale(level) }),
        isMuted: disabledByTutorial,
        effectText,
        currentEffectText: this.t('building.effect.current', { effect: currentEffectText }),
        nextEffectText: this.t('building.effect.next', { label: nextEffectLabel, effect: nextEffectValue }),
        maintenanceText: this.formatBuildingMaintenanceText(config, level),
        cityImpactText: this.formatBuildingCityImpactText(config),
        costTitle: level > 0 ? this.t('building.cost.upgrade', {}) : this.t('building.cost.build', {}),
        descText,
        militaryLines,
        button: {
          action: level ? 'upgrade' : 'build',
          disabled,
          label: disabledByTutorial
            ? this.t('building.action.guideLocked', {})
            : disabledByCost
              ? this.t('building.action.insufficientResources', {})
              : actionLabel,
        },
        cost: this.buildCostViewState(cost),
        structure: {
          hasEffect: currentEffectText !== noneText || nextEffectValue !== noneText,
          hasMilitary: Boolean(config.military),
          hasDescription: Boolean(descText),
          hasPlanning: true,
        },
      };
    }

    static buildBuildingViewState(state = {}, tutorial = {}, buildingConfig = {}, options = {}) {
      const ids = this.getVisibleBuildingIds(state);
      const allCards = ids
        .map((id) => this.buildBuildingCardViewState(state, tutorial, buildingConfig, id))
        .filter(Boolean);
      const activeCategory = options.activeCategory || 'all';
      const categoryDefinitions = this.getBuildingCategoryDefinitions(state, buildingConfig);
      const categoryTabs = this.buildBuildingCategoryTabs(allCards, activeCategory, categoryDefinitions);
      const resolvedActiveCategory = categoryTabs.find((tab) => tab.active)?.id || 'all';
      const cards = resolvedActiveCategory === 'all'
        ? allCards
        : allCards.filter((card) => card.category === resolvedActiveCategory);
      return {
        ids: allCards.map((card) => card.id),
        filteredIds: cards.map((card) => card.id),
        isEmpty: cards.length === 0,
        emptyText: allCards.length === 0
          ? this.t('building.empty.all', {})
          : this.t('building.empty.category', {}),
        activeCategory: resolvedActiveCategory,
        categoryTabs,
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

  global.BuildingPresenter = BuildingPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = BuildingPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
