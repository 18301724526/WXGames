(function (global) {
  'use strict';

  const OWNED_UI_RUNTIME_FIELDS = Object.freeze([
    'TUTORIAL_ENABLED',
    'tutorialIntro',
    'tutorialAdvisorDialogue',
    'tutorialHighlight',
  ]);

  const api = Object.freeze({
    OWNED_UI_RUNTIME_FIELDS,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.TutorialRuntimeStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
