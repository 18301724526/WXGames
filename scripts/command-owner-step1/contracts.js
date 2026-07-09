'use strict';

const REPORT_NAME = 'command-owner-step1-prerequisite-staging';
const MODE = 'report-only';

const CONTRACT_IDS = Object.freeze([
  'COP-ENTRY-001',
  'COP-ENVELOPE-001',
  'COP-IDEMP-001',
  'COP-OWNER-001',
  'COP-OWNER-002',
  'COP-SHARED-001',
  'COP-LOCK-001',
  'COP-CONCURRENCY-001',
  'COP-HANDLER-001',
  'COP-ROUTE-001',
  'COP-CLIENT-001',
  'COP-CLIENT-002',
  'COP-TIME-001',
  'COP-AUTHORITY-001',
  'COP-PROJECTION-001',
  'COP-TRACE-001',
  'COP-ALLOWLIST-001',
]);

const STEP1_CHECKS = Object.freeze([
  {
    id: 'write-command-inventory',
    taskIds: ['STEP1-T02', 'STEP1-T03', 'STEP1-T04'],
    contracts: ['COP-ENTRY-001', 'COP-ROUTE-001', 'COP-TRACE-001'],
    fakePassPrevented: 'write routes, helpers, or client helpers disappearing by being moved or renamed',
  },
  {
    id: 'client-command-domain-blockers',
    taskIds: ['STEP1-T05', 'STEP1-T06'],
    contracts: ['COP-CLIENT-001', 'COP-AUTHORITY-001', 'COP-TIME-001'],
    fakePassPrevented: 'domain eligibility being treated as a transport or payload block',
  },
  {
    id: 'client-disabled-command-path',
    taskIds: ['STEP1-T04', 'STEP1-T05', 'STEP1-T06'],
    contracts: ['COP-CLIENT-001', 'COP-CLIENT-002', 'COP-ALLOWLIST-001'],
    fakePassPrevented: 'disabled UI state being accepted as proof that command dispatch is safe',
  },
  {
    id: 'frontend-write-submission-path',
    taskIds: ['STEP1-T04B'],
    contracts: ['COP-ENTRY-001', 'COP-CLIENT-002', 'COP-ENVELOPE-001', 'COP-IDEMP-001'],
    fakePassPrevented: 'direct submit paths bypassing a future universal command sender',
  },
  {
    id: 'route-write-orchestration',
    taskIds: ['STEP1-T07'],
    contracts: ['COP-ROUTE-001', 'COP-ENTRY-001', 'COP-PROJECTION-001', 'COP-ALLOWLIST-001'],
    fakePassPrevented: 'helper wrappers named service, adapter, runner, or pipeline hiding route-owned work',
  },
  {
    id: 'handler-lock-persistence',
    taskIds: ['STEP1-T08'],
    contracts: ['COP-HANDLER-001', 'COP-LOCK-001', 'COP-CONCURRENCY-001', 'COP-ALLOWLIST-001'],
    fakePassPrevented: 'feature handlers moving lock/save calls into helper functions',
  },
  {
    id: 'owner-key-coverage',
    taskIds: ['STEP1-T09'],
    contracts: ['COP-OWNER-001', 'COP-OWNER-002', 'COP-SHARED-001'],
    fakePassPrevented: 'fake player owner fallback for shared commands',
  },
  {
    id: 'shared-owner-lookup-coverage',
    taskIds: ['STEP1-T09B'],
    contracts: ['COP-OWNER-001', 'COP-OWNER-002', 'COP-SHARED-001'],
    fakePassPrevented: 'discovering shared owners only after domain execution',
  },
  {
    id: 'idempotency-coverage',
    taskIds: ['STEP1-T10'],
    contracts: ['COP-IDEMP-001', 'COP-ENVELOPE-001'],
    fakePassPrevented: 'fields named commandId/idempotencyKey counting without stable client semantics',
  },
  {
    id: 'shared-owner-write-coverage',
    taskIds: ['STEP1-T11'],
    contracts: ['COP-SHARED-001', 'COP-OWNER-001', 'COP-LOCK-001'],
    fakePassPrevented: 'territory or encounter writes remaining player-only by convenience',
  },
  {
    id: 'allowlist-debt-record',
    taskIds: ['STEP1-T12'],
    contracts: ['COP-ALLOWLIST-001'],
    fakePassPrevented: 'broad allowlists or exclusions hiding migration debt',
  },
  {
    id: 'server-fallback-id-classification',
    taskIds: ['STEP1-T10', 'STEP1-T13'],
    contracts: ['COP-IDEMP-001', 'COP-ENVELOPE-001'],
    fakePassPrevented: 'server-generated fallback ids being treated as real idempotency',
  },
]);

module.exports = {
  CONTRACT_IDS,
  MODE,
  REPORT_NAME,
  STEP1_CHECKS,
};
