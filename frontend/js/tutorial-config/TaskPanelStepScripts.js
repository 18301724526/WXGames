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
    famousCardViewed: Object.freeze({
      type: 'ensureSurfaceThenHighlight',
      legacyFallbackWhenIdle: true,
      clauses: Object.freeze([
        Object.freeze({
          ruleId: 'scout-open-formation',
          target: 'hitTarget:openArmyFormation',
          targetArgs: Object.freeze({ cityAlias: 'capitalCity', slot: 1 }),
          action: Object.freeze({
            type: 'openArmyFormation',
            cityAlias: 'capitalCity',
            slot: 1,
          }),
          messageKey: 'tutorial.guide.openFirstFormation',
          eventName: 'armyFormationOpened',
        }),
        Object.freeze({
          ruleId: 'scout-switch-city-military-tab',
          target: 'hitTarget:switchCityManagementTab',
          targetArgs: Object.freeze({ tab: 'military' }),
          action: Object.freeze({ type: 'switchCityManagementTab', tab: 'military' }),
          messageKey: 'tutorial.guide.switchCityMilitaryTab',
          eventName: 'cityManagementOpened',
        }),
      ]),
    }),
    formationPanelOpened: Object.freeze({
      type: 'orderedTargetFlow',
      ruleId: 'scout-formation-member-or-save',
      clauses: Object.freeze([
        Object.freeze({
          target: 'hitTarget:toggleArmyFormationMember',
          targetArgs: Object.freeze({ personAlias: 'scoutFamousPerson' }),
          action: Object.freeze({
            type: 'toggleArmyFormationMember',
            personAlias: 'scoutFamousPerson',
          }),
          messageKey: 'tutorial.guide.pickScoutLeader',
        }),
        Object.freeze({
          target: 'hitTarget:autoReplenishArmyFormation',
          action: Object.freeze({ type: 'autoReplenishArmyFormation' }),
          messageKey: 'tutorial.highlight.replenishScoutFormation',
        }),
        Object.freeze({
          target: 'hitTarget:saveArmyFormation',
          action: Object.freeze({ type: 'saveArmyFormation' }),
          messageKey: 'tutorial.guide.saveScoutFormation',
          eventName: 'armyFormationSaved',
        }),
      ]),
    }),
    scoutFormationSaved: Object.freeze({
      type: 'effectSequence',
      ruleId: 'scout-select-world-target',
      beforeEffects: Object.freeze([
        Object.freeze({ effect: 'clearWorldMarchTarget' }),
      ]),
      target: 'hitTarget:selectWorldMarchTarget',
      targetArgs: Object.freeze({ targetAlias: 'firstExploreCityCoord' }),
      action: Object.freeze({
        type: 'selectWorldMarchTarget',
        targetAlias: 'firstExploreCityCoord',
      }),
      messageKey: 'tutorial.guide.selectScoutTarget',
      eventName: 'worldMarchTargetSelected',
    }),
    scoutWorldPanelOpened: Object.freeze({
      type: 'orderedTargetFlow',
      cursorKey: 'scoutWorldMarchFlow',
      initialCursor: 'targetSelected',
      clauses: Object.freeze([
        Object.freeze({
          cursor: 'targetSelected',
          ruleId: 'scout-open-world-formation-picker',
          target: 'hitTarget:openWorldMarchFormationPicker',
          action: Object.freeze({ type: 'openWorldMarchFormationPicker' }),
          messageKey: 'tutorial.guide.openMarchFormationPicker',
          eventName: 'modal.changed',
          eventFilter: Object.freeze({
            operation: 'open',
            subtype: 'modal:targetPicker',
            payload: Object.freeze({ pickerKind: 'worldMarchFormation' }),
          }),
          nextCursor: 'formationPickerOpen',
        }),
        Object.freeze({
          cursor: 'formationPickerOpen',
          ruleId: 'scout-start-world-march',
          target: 'hitTarget:startWorldMarch',
          targetArgs: Object.freeze({ formationSlot: 1 }),
          action: Object.freeze({ type: 'startWorldMarch', formationSlot: 1 }),
          messageKey: 'tutorial.guide.startScoutMarch',
          eventName: 'exploreStarted',
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
