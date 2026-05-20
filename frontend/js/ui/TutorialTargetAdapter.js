(function (global) {
  class TutorialTargetAdapter {
    constructor(targets = {}) {
      this.targets = targets;
    }

    static fromDocument(doc) {
      const byId = (id) => doc.getElementById(id);
      return new TutorialTargetAdapter({
        'tab-resources': byId('tabResources'),
        'tab-civilization': byId('tabCivilization'),
        'tab-buildings': byId('tabBuildings'),
        'tab-events': byId('tabEvents'),
        'tab-military': byId('tabMilitary'),
        'tab-territory': byId('tabMilitary'),
        'btn-advance-era': byId('btnAdvanceEra'),
      });
    }

    getTarget(key) {
      return this.targets[key] || null;
    }
  }

  global.TutorialTargetAdapter = TutorialTargetAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialTargetAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
