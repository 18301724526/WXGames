'use strict';

const RETIRED_DEBT_IDS = Object.freeze([
  'STEP4-DEBT-009',
  'STEP4-DEBT-011',
  'STEP4-DEBT-012',
  'STEP4-DEBT-013',
  'STEP4-DEBT-014',
  'STEP4-DEBT-015',
  'STEP4-DEBT-016',
]);

const CLASSIFIED_UI_LOCAL_DEBT_IDS = Object.freeze([
  'STEP4-DEBT-010',
]);

const REMAINING_DEBT_IDS = Object.freeze([
  'STEP4-DEBT-001',
  'STEP4-DEBT-002',
  'STEP4-DEBT-003',
  'STEP4-DEBT-004',
  'STEP4-DEBT-005',
  'STEP4-DEBT-006',
  'STEP4-DEBT-007',
  'STEP4-DEBT-008',
  'STEP4-DEBT-017',
  'STEP4-DEBT-018',
  'STEP4-DEBT-019',
  'STEP4-DEBT-020',
]);

const RETIREMENT_EVIDENCE = Object.freeze([
  {
    debtId: 'STEP4-DEBT-009',
    inventoryId: 'frontend:canvas-action-dispatcher-disabled-drop',
    retiredByTask: 'STEP4-T11',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'dispatcher-disabled-command-submit',
    tests: ['frontend/js/platform/CanvasActionDispatcher.test.js', 'scripts/check-frontend-command-semantics.test.js'],
  },
  {
    debtId: 'STEP4-DEBT-011',
    inventoryId: 'frontend:canvas-game-app-advance-era-local-block',
    retiredByTask: 'STEP4-T13',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'advance-era-canAdvanceEraNow-return',
    tests: ['frontend/js/platform/CanvasGameApp.test.js', 'scripts/check-frontend-command-semantics.test.js'],
  },
  {
    debtId: 'STEP4-DEBT-012',
    inventoryId: 'frontend:tech-research-local-canresearch',
    retiredByTask: 'STEP4-T14',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'command-click-target-domain-disabled',
    tests: ['scripts/check-frontend-command-semantics.test.js'],
  },
  {
    debtId: 'STEP4-DEBT-013',
    inventoryId: 'frontend:building-local-cost-disabled',
    retiredByTask: 'STEP4-T14',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'command-click-target-domain-disabled',
    tests: ['scripts/check-frontend-command-semantics.test.js'],
  },
  {
    debtId: 'STEP4-DEBT-014',
    inventoryId: 'frontend:famous-candidate-availability',
    retiredByTask: 'STEP4-T14',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'command-click-target-domain-disabled',
    tests: ['scripts/check-frontend-command-semantics.test.js'],
  },
  {
    debtId: 'STEP4-DEBT-015',
    inventoryId: 'frontend:territory-mission-ready',
    retiredByTask: 'STEP4-T14',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'command-click-target-domain-disabled',
    tests: ['scripts/check-frontend-command-semantics.test.js'],
  },
  {
    debtId: 'STEP4-DEBT-016',
    inventoryId: 'frontend:world-march-passability',
    retiredByTask: 'STEP4-T14',
    blockingGate: 'scripts/check-frontend-command-semantics.js',
    fireProbe: 'command-click-target-domain-disabled',
    tests: ['scripts/check-frontend-command-semantics.test.js'],
  },
]);

module.exports = {
  CLASSIFIED_UI_LOCAL_DEBT_IDS,
  REMAINING_DEBT_IDS,
  RETIRED_DEBT_IDS,
  RETIREMENT_EVIDENCE,
};
