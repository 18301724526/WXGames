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

  class CivilizationPresenter {
    static POPULATION_PER_OFFICIAL = 100;

    static t(key, params = {}, fallback = '') {
      return LocaleText?.t?.(key, params, { fallback }) || fallback || key;
    }

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static toDisplayPopulation(officials) {
      return this.toInteger(officials) * this.POPULATION_PER_OFFICIAL;
    }

    static canAdvanceEraByTutorial(state = {}, tutorial = {}) {
      if (tutorial.completed) return true;
      const step = Number(tutorial.currentStep) || 0;
      if (this.toNumber(state.currentEra) === 0) return step >= 2;
      if (this.toNumber(state.currentEra) === 1) return step >= 9;
      return true;
    }

    static buildEraConditionViewState(condition = {}) {
      return {
        name: condition.name || '',
        met: Boolean(condition.met),
        className: condition.met ? 'met' : 'unmet',
        progressText: `${condition.current}/${condition.required}`,
      };
    }

    static buildCivilizationViewState(state = {}, tutorial = {}, options = {}) {
      const eraName = state.currentEraName || this.t('civilization.era.fallback', {}, '原始时代');
      const progress = state.eraProgress || { percentage: 0, canAdvance: false, conditions: [] };
      const percentage = Math.max(0, Math.min(100, this.toNumber(progress.percentage)));
      const canAdvanceByTutorial = this.canAdvanceEraByTutorial(state, tutorial);
      const canOpenCivilizationTab = options.canOpenCivilizationTab !== false;
      const canAdvance = Boolean(progress.canAdvance)
        && state.isCapitalCity !== false
        && canAdvanceByTutorial
        && canOpenCivilizationTab;

      let advanceLabel = this.t('civilization.advance.insufficient', {}, '条件不足，无法进阶');
      if (state.isCapitalCity === false) {
        advanceLabel = this.t('civilization.advance.subcity', {}, '分城跟随主城时代');
      } else if (progress.canAdvance && !canAdvanceByTutorial) {
        advanceLabel = this.t('civilization.advance.guideLocked', {}, '引导未解锁');
      } else if (progress.canAdvance) {
        advanceLabel = this.t('civilization.advance.ready', {}, '满足条件，可进阶');
      }

      return {
        text: {
          eraName,
          civOverviewEraName: eraName,
          civOverviewDay: this.t('civilization.day', { day: state.gameDay || 1 }, `第 ${state.gameDay || 1} 天`),
          civOverviewPop: this.toDisplayPopulation(state.population?.total),
          civOverviewBuildings: this.toInteger(state.totalBuildings),
          civOverviewTechs: `${Object.keys(state.techs || {}).length}/0`,
          civOverviewHappiness: `${state.happiness || 100}%`,
          eraProgressText: this.t('civilization.progress', { percentage }, `总进度 ${percentage}%`),
          eraTargetName: progress.targetEraName || this.t('civilization.target.locked', {}, '时代未开放'),
          advanceLabel,
          featureDescription: state.currentEraDescription
            || this.t('civilization.feature.default', { era: eraName }, `${eraName}：继续建设你的文明。`),
        },
        progress: {
          percentage,
          width: `${percentage}%`,
          canAdvance: Boolean(progress.canAdvance),
        },
        advanceButton: {
          disabled: !canAdvance,
          canAdvance,
          canAdvanceByTutorial,
          canOpenCivilizationTab,
        },
        conditions: (progress.conditions || []).map((condition) => this.buildEraConditionViewState(condition)),
      };
    }
  }

  global.CivilizationPresenter = CivilizationPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = CivilizationPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
