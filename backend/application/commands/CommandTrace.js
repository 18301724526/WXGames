const { summarizeCommand } = require('./CommandEnvelope');

class CommandTrace {
  constructor(command = {}, options = {}) {
    this.command = command;
    this.retryAttempt = options.retryAttempt || 0;
    this.phase = 'received';
    this.committed = false;
    this.revisionBefore = null;
    this.revisionAfter = null;
    this.phases = [];
    this.mark('received');
  }

  mark(phase, detail = {}) {
    this.phase = phase;
    this.phases.push({
      phase,
      at: new Date().toISOString(),
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

  toPayload(extra = {}) {
    return {
      schema: 'game-command-trace-v1',
      ...summarizeCommand(this.command),
      retryAttempt: this.retryAttempt,
      phase: this.phase,
      committed: this.committed,
      revisionBefore: this.revisionBefore,
      revisionAfter: this.revisionAfter,
      phases: this.phases.map((item) => ({ ...item })),
      ...extra,
    };
  }
}

module.exports = CommandTrace;
