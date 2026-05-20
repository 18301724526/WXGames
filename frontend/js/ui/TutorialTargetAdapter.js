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
        'btn-claim-event': byId('btnClaimEvent'),
        'card-farm': byId('card-farm'),
        'card-house': byId('card-house'),
        'event-card-special': byId('event-card-special'),
        'card-lumbermill': byId('card-lumbermill'),
        'card-barracks': byId('card-barracks'),
      });
    }

    getTarget(key) {
      return this.targets[key] || null;
    }
  }

  global.TutorialTargetAdapter = TutorialTargetAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialTargetAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
