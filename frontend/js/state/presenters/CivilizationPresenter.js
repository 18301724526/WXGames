(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CivilizationPresenter {
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
      const eraName = state.currentEraName || this.t('civilization.era.fallback', {});
      const progress = state.eraProgress || { percentage: 0, canAdvance: false, conditions: [] };
      const percentage = Math.max(0, Math.min(100, this.toNumber(progress.percentage)));
      const canAdvanceByTutorial = this.canAdvanceEraByTutorial(state, tutorial);
      const canOpenCivilizationTab = options.canOpenCivilizationTab !== false;
      const canAdvance = Boolean(progress.canAdvance)
        && state.isCapitalCity !== false
        && canAdvanceByTutorial
        && canOpenCivilizationTab;

      let advanceLabel = this.t('civilization.advance.insufficient', {});
      if (state.isCapitalCity === false) {
        advanceLabel = this.t('civilization.advance.subcity', {});
      } else if (progress.canAdvance && !canAdvanceByTutorial) {
        advanceLabel = this.t('civilization.advance.guideLocked', {});
      } else if (progress.canAdvance) {
        advanceLabel = this.t('civilization.advance.ready', {});
      }

      return {
        text: {
          eraName,
          civOverviewEraName: eraName,
          civOverviewDay: this.t('civilization.day', { day: state.gameDay || 1 }),
          civOverviewPop: this.toDisplayPopulation(state.population?.total),
          civOverviewBuildings: this.toInteger(state.totalBuildings),
          civOverviewTechs: `${Object.keys(state.techs || {}).length}/0`,
          civOverviewHappiness: `${state.happiness || 100}%`,
          eraProgressText: this.t('civilization.progress', { percentage }),
          eraTargetName: progress.targetEraName || this.t('civilization.target.locked', {}),
          advanceLabel,
          featureDescription: state.currentEraDescription
            || this.t('civilization.feature.default', { era: eraName }),
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
