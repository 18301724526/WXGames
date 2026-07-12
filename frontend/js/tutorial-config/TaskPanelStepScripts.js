(function (global) {
  const TASK_PANEL_STEP_SCRIPTS = Object.freeze({
    eraAdvancedTo1: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'first-era-open-task-center',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: false }),
          target: 'openTaskCenter',
          messageKey: 'tutorial.highlight.openTaskCenter',
          eventName: 'modal.changed',
        }),
        Object.freeze({
          ruleId: 'first-era-claim-supplies',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: true }),
          target: 'claimTaskReward:main_first_supplies',
          messageKey: 'tutorial.highlight.claimFirstSupplies',
          eventName: 'taskRewardClaimed',
        }),
      ]),
    }),
    era2AdvanceReady: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'era2-open-civilization',
          when: Object.freeze({
            query: 'isCommandPanelOpen',
            args: Object.freeze(['civilization']),
            equals: false,
          }),
          panel: 'civilization',
          target: 'openCommandPanel',
          messageKey: 'tutorial.guide.openCivilizationForEra2',
          eventName: 'commandPanelOpened',
        }),
        Object.freeze({
          ruleId: 'era2-advance',
          when: Object.freeze({
            query: 'isCommandPanelOpen',
            args: Object.freeze(['civilization']),
            equals: true,
          }),
          target: 'advanceEra',
          messageKey: 'tutorial.guide.advanceToEra2',
          eventName: 'eraAdvanced',
        }),
      ]),
    }),
    eraAdvancedTo2: Object.freeze({
      type: 'ensureSurfaceThenHighlight',
      ruleId: 'era2-open-events',
      when: Object.freeze({
        query: 'isCommandPanelOpen',
        args: Object.freeze(['events']),
        equals: false,
      }),
      panel: 'events',
      target: 'openCommandPanel',
      messageKey: 'tutorial.guide.openEventsForForest',
      eventName: 'commandPanelOpened',
    }),
    lumbermillBuilt: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'lumbermill-open-task-center',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: false }),
          target: 'openTaskCenter',
          messageKey: 'tutorial.guide.openLumbermillTask',
          eventName: 'modal.changed',
        }),
        Object.freeze({
          ruleId: 'lumbermill-claim-task',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: true }),
          target: 'claimTaskReward:main_lumbermill_supplies',
          messageKey: 'tutorial.guide.claimLumbermillReward',
          eventName: 'taskRewardClaimed',
        }),
      ]),
    }),
    era3AdvanceReady: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'era3-open-civilization',
          when: Object.freeze({
            query: 'isCommandPanelOpen',
            args: Object.freeze(['civilization']),
            equals: false,
          }),
          panel: 'civilization',
          target: 'openCommandPanel',
          messageKey: 'tutorial.guide.openCivilizationForEra3',
          eventName: 'commandPanelOpened',
        }),
        Object.freeze({
          ruleId: 'era3-advance',
          when: Object.freeze({
            query: 'isCommandPanelOpen',
            args: Object.freeze(['civilization']),
            equals: true,
          }),
          target: 'advanceEra',
          messageKey: 'tutorial.guide.advanceToEra3',
          eventName: 'eraAdvanced',
        }),
      ]),
    }),
    era3Advanced: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'barracks-open-task-center',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: false }),
          target: 'openTaskCenter',
          messageKey: 'tutorial.highlight.openBarracksTask',
          eventName: 'modal.changed',
        }),
        Object.freeze({
          ruleId: 'barracks-claim-supplies',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: true }),
          target: 'claimTaskReward:main_barracks_supplies',
          messageKey: 'tutorial.highlight.claimBarracksSupplies',
          eventName: 'taskRewardClaimed',
        }),
      ]),
    }),
    barracksBuilt: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'first-army-open-task-center',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: false }),
          target: 'openTaskCenter',
          messageKey: 'tutorial.highlight.openFirstArmyTask',
          eventName: 'modal.changed',
        }),
        Object.freeze({
          ruleId: 'first-army-claim',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: true }),
          target: 'claimTaskReward:main_first_army',
          messageKey: 'tutorial.highlight.claimFirstArmy',
          eventName: 'taskRewardClaimed',
        }),
      ]),
    }),
    firstArmyClaimed: Object.freeze({
      type: 'highlightActionWait',
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'scout-officer-open-task-center',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: false }),
          target: 'openTaskCenter',
          messageKey: 'tutorial.highlight.openScoutOfficerTask',
          eventName: 'modal.changed',
        }),
        Object.freeze({
          ruleId: 'scout-officer-claim',
          when: Object.freeze({ query: 'isTaskCenterOpen', equals: true }),
          target: 'claimTaskReward:main_scout_officer',
          messageKey: 'tutorial.highlight.claimScoutOfficer',
          eventName: 'taskRewardClaimed',
        }),
      ]),
    }),
    famousSeekCompleted: Object.freeze({
      type: 'ensureSurfaceThenHighlight',
      ruleId: 'final-tech-open',
      when: Object.freeze({
        query: 'isCommandPanelOpen',
        args: Object.freeze(['tech']),
        equals: false,
      }),
      panel: 'tech',
      target: 'openCommandPanel',
      messageKey: 'tutorial.guide.openTechFinal',
      eventName: 'commandPanelOpened',
    }),
    finalTechOpened: Object.freeze({
      type: 'ensureSurfaceThenHighlight',
      ruleId: 'final-tech-open',
      when: Object.freeze({
        query: 'isCommandPanelOpen',
        args: Object.freeze(['tech']),
        equals: false,
      }),
      panel: 'tech',
      target: 'openCommandPanel',
      messageKey: 'tutorial.guide.openTechFinal',
      eventName: 'commandPanelOpened',
    }),
  });

  global.TutorialTaskPanelStepScripts = TASK_PANEL_STEP_SCRIPTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TASK_PANEL_STEP_SCRIPTS;
})(typeof window !== 'undefined' ? window : globalThis);
