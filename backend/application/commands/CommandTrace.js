const { summarizeCommand } = require('./CommandEnvelope');

class CommandTrace {
  constructor(command = {}, options = {}) {
    this.command = command;
    this.retryAttempt = options.retryAttempt || 0;
    this.now = options.now || (() => new Date());
    this.phase = 'received';
    this.committed = false;
    this.revisionBefore = null;
    this.revisionAfter = null;
    this.ownerKey = '';
    this.ownerKeys = [];
    this.idempotencyStatus = 'not-checked';
    this.ownerQueueWaitMs = 0;
    this.executionDurationMs = 0;
    this.validatorResult = null;
    this.commitResult = null;
    this.responseStatus = null;
    this.phases = [];
    this.mark('received');
  }

  mark(phase, detail = {}) {
    const now = this.now();
    this.phase = phase;
    this.phases.push({
      phase,
      at: (now instanceof Date ? now : new Date(now)).toISOString(),
      ...detail,
    });
  }

  setRevisionBefore(revision) {
    this.revisionBefore = Number.isFinite(Number(revision)) ? Number(revision) : null;
  }

  setCommitted(revisionAfter) {
    this.committed = true;
    this.revisionAfter = Number.isFinite(Number(revisionAfter)) ? Number(revisionAfter) : null;
  }

  setOwner(ownerResolution = {}) {
    this.ownerKey = ownerResolution.ownerKey || '';
    this.ownerKeys = Array.isArray(ownerResolution.ownerKeys) ? [...ownerResolution.ownerKeys] : [];
  }

  setIdempotencyStatus(status) {
    this.idempotencyStatus = String(status || 'unknown');
  }

  setOwnerQueueWaitMs(value) {
    this.ownerQueueWaitMs = Math.max(0, Number(value) || 0);
  }

  setExecutionDurationMs(value) {
    this.executionDurationMs = value == null ? null : Math.max(0, Number(value) || 0);
  }

  setValidatorResult(result) {
    this.validatorResult = result == null ? null : {
      success: result.success !== false,
      error: result.error || result.code || '',
    };
  }

  setCommitResult(result) {
    this.commitResult = result == null ? null : {
      status: result.status || '',
      revisionBefore: result.revisionBefore ?? null,
      revisionAfter: result.revisionAfter ?? null,
    };
  }

  setResponseStatus(statusCode) {
    this.responseStatus = Number.isFinite(Number(statusCode)) ? Number(statusCode) : null;
  }

  toPayload(extra = {}) {
    return {
      schema: 'game-command-trace-v1',
      ...summarizeCommand(this.command),
      retryAttempt: this.retryAttempt,
      phase: this.phase,
      committed: this.committed,
      revisionBefore: this.revisionBefore,
      revisionAfter: this.revisionAfter,
      ownerKey: this.ownerKey,
      ownerKeys: [...this.ownerKeys],
      idempotencyStatus: this.idempotencyStatus,
      ownerQueueWaitMs: this.ownerQueueWaitMs,
      executionDurationMs: this.executionDurationMs,
      validatorResult: this.validatorResult ? { ...this.validatorResult } : null,
      commitResult: this.commitResult ? { ...this.commitResult } : null,
      responseStatus: this.responseStatus,
      phases: this.phases.map((item) => ({ ...item })),
      ...extra,
    };
  }
}

module.exports = CommandTrace;
