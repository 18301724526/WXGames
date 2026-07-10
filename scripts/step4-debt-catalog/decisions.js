'use strict';

const DECISIONS = Object.freeze([
  {
    id: 'D1',
    title: 'Player login pipeline entry vs permanent exception',
    decision: 'permanent-exception',
    selectedOption: 'b',
    evidence: [
      'backend/routes/playerRoutes.js keeps auth login lock/retry/save/projection visibly in route scope.',
      'Step4 is not a new feature phase and does not require auth flow migration.',
      'Growth gates prevent this route-owned pattern from spreading to gameplay pipeline-migrated writes.',
    ],
    affectedDebtIds: ['STEP4-DEBT-001'],
    completionEvidence: [
      'scripts/step4-debt-catalog/permanent-exceptions.js',
      'scripts/check-route-owned-persistence.js',
      'scripts/check-permanent-exceptions.js',
    ],
  },
  {
    id: 'D2',
    title: 'Frontend domain blockers removal vs structural isolation',
    decision: 'structural-isolation-for-display-state; command-submit blockers retired',
    selectedOption: 'b',
    evidence: [
      'CanvasActionDispatcher command actions are normalized before disabled checks.',
      'CanvasGameApp.advanceEra directly calls GameAPI.advanceEra.',
      'CanvasPanelActionRunner production descriptors are UI-local only.',
      'ClientCommandSender transport/payload local block reasons remain the only local command blocks.',
    ],
    affectedDebtIds: [
      'STEP4-DEBT-009',
      'STEP4-DEBT-010',
      'STEP4-DEBT-011',
      'STEP4-DEBT-012',
      'STEP4-DEBT-013',
      'STEP4-DEBT-014',
      'STEP4-DEBT-015',
      'STEP4-DEBT-016',
    ],
    completionEvidence: [
      'scripts/check-frontend-command-semantics.js',
      'frontend/js/platform/CanvasActionDispatcher.test.js',
      'frontend/js/platform/CanvasPanelActionRunner.test.js',
      'frontend/js/platform/CanvasGameApp.test.js',
    ],
  },
  {
    id: 'D3',
    title: 'report-domain-business-candidates command-owner overlap subset',
    decision: 'focused-overlap-gates-plus-backlog-grouping',
    selectedOption: 'grouped-subset',
    evidence: [
      'Current CLI supports --json, not the spec draft --format json.',
      'Current report has 544 findings: backend-route 3, frontend-ecs 57, frontend-platform 96, frontend-renderer 117, frontend-state 192, shared 36, unclassified 43.',
      'Mechanical overlap is extracted where source ranges intersect the Step4 catalog or where import/call closure can reach persistence/lock or command-submit blockers.',
      'Broad non-overlap findings remain report-only backlog and are not converted by document-only reclassification.',
    ],
    affectedDebtIds: ['STEP4-DEBT-019', 'STEP4-DEBT-020'],
    completionEvidence: [
      'scripts/check-frontend-command-semantics.js',
      'scripts/check-projection-write-boundary.js',
      'scripts/check-step4-final-audit.js',
    ],
  },
  {
    id: 'D4',
    title: 'frontend ECS report-only retirement standard',
    decision: 'retain-report-only-for-non-overlap; focused Step4 overlap covered by Step4 gates',
    evidence: [
      'frontend-ecs-mode-ownership: 242 findings; non-zero, broad panel/mode ownership backlog.',
      'frontend-ecs-renderer-authority: 174 findings; non-zero renderer cache/hit-target authority backlog.',
      'frontend-ecs-input-branch: 161 findings; Step4 command-submit overlap is covered by frontend-command-semantics gate, remainder stays report-only.',
      'frontend-ecs-literal-duplicate: 12552 findings; broad duplicate-literal backlog, not Step4 command-owner retirement scope.',
    ],
    affectedDebtIds: ['STEP4-DEBT-019'],
    completionEvidence: [
      'scripts/check-frontend-command-semantics.js',
      'scripts/check-step4-final-audit.js',
    ],
  },
  {
    id: 'D5',
    title: 'Permanent exception model',
    decision: 'adopt-spec-format',
    evidence: [
      'Every permanent exception records exceptionId, debtId, owner, reason, retirementCondition, growthPreventionTest, contracts, and lastReviewed.',
    ],
    affectedDebtIds: [
      'STEP4-DEBT-001',
      'STEP4-DEBT-002',
      'STEP4-DEBT-003',
      'STEP4-DEBT-004',
      'STEP4-DEBT-005',
      'STEP4-DEBT-006',
      'STEP4-DEBT-007',
      'STEP4-DEBT-008',
    ],
    completionEvidence: ['scripts/step4-debt-catalog/permanent-exceptions.js'],
  },
]);

module.exports = { DECISIONS };
