'use strict';

const {
  COMMAND_SCHEMA,
  buildCommandEnvelopeErrorPayload,
  isCommandEnvelopeError,
  normalizeCommandEnvelope,
} = require('./CommandEnvelope');
const {
  CommandIdempotencyError,
  terminalStatusFor,
} = require('./CommandIdempotencyStore');
const {
  CommandOwnerResolutionError,
  resolveCommandOwners,
} = require('./CommandOwnerResolver');
const { runWithOwnerContext } = require('./CommandOwnerContext');
const CommandCommitter = require('./CommandCommitter');
const CommandTrace = require('./CommandTrace');

function normalizeResponse(value, fallbackStatus = 200) {
  if (value && Number.isFinite(Number(value.statusCode)) && value.payload !== undefined) {
    return { statusCode: Number(value.statusCode), payload: value.payload };
  }
  return { statusCode: fallbackStatus, payload: value == null ? {} : value };
}

function errorResponse(error, fallbackCode = 'COMMAND_PIPELINE_FAILED', fallbackStatus = 500) {
  return {
    statusCode: Number(error?.status) || fallbackStatus,
    payload: {
      success: false,
      error: error?.code || fallbackCode,
      message: error?.message || 'Command pipeline failed',
      retryable: Boolean(error?.retryable),
    },
  };
}

class CommandExecutionPipeline {
  constructor(options = {}) {
    if (!options.repository?.withOwnerLocks) {
      throw new Error('CommandExecutionPipeline requires repository.withOwnerLocks');
    }
    if (!options.idempotencyStore) {
      throw new Error('CommandExecutionPipeline requires idempotencyStore');
    }
    this.repository = options.repository;
    this.idempotencyStore = options.idempotencyStore;
    this.ownerResolver = options.ownerResolver || resolveCommandOwners;
    this.committer = options.committer || new CommandCommitter({
      repository: this.repository,
      idempotencyStore: this.idempotencyStore,
    });
    this.traceFactory = options.traceFactory || ((command, traceOptions) => new CommandTrace(command, traceOptions));
    this.monotonicNow = options.monotonicNow || (() => Date.now());
  }

  _attachTrace(response, trace) {
    const normalized = normalizeResponse(response);
    const payload = normalized.payload && typeof normalized.payload === 'object'
      ? { ...normalized.payload }
      : { result: normalized.payload };
    const commandTrace = trace.toPayload();
    return {
      statusCode: normalized.statusCode,
      payload: {
        ...payload,
        command: commandTrace,
        commandId: commandTrace.commandId,
        requestId: commandTrace.requestId,
      },
    };
  }

  _recordTerminal(idempotencyRecord, response, trace) {
    const terminalStatus = terminalStatusFor(response.statusCode);
    trace.setIdempotencyStatus(terminalStatus);
    trace.setResponseStatus(response.statusCode);
    trace.mark('responding');
    const tracedResponse = this._attachTrace(response, trace);
    this.committer.recordResult(idempotencyRecord, tracedResponse, { status: terminalStatus });
    return tracedResponse;
  }

  _normalizeInput(input, options = {}) {
    if (input?.schema === COMMAND_SCHEMA) return input;
    return normalizeCommandEnvelope(input, {
      ...(options.envelope || {}),
      requireClientIds: options.requireClientIds !== false,
    });
  }

  execute(input = {}, definition = {}, options = {}) {
    let envelope;
    try {
      envelope = this._normalizeInput(input, options);
    } catch (error) {
      if (!isCommandEnvelopeError(error)) throw error;
      return {
        statusCode: error.status || 400,
        payload: buildCommandEnvelopeErrorPayload(error),
        idempotencyStatus: 'not-started',
      };
    }

    const trace = this.traceFactory(envelope, {
      retryAttempt: options.retryAttempt || 0,
      now: options.now,
    });
    let idempotencyRecord = null;
    let ownerResolution = null;
    let executionContext = null;
    let executionStartedAt = null;

    try {
      trace.mark('idempotency_checking');
      const idempotency = this.idempotencyStore.begin(envelope);
      trace.setIdempotencyStatus(idempotency.status);
      if (idempotency.status === 'replay' || idempotency.status === 'in-progress') {
        trace.setResponseStatus(idempotency.response.statusCode);
        trace.mark(idempotency.status === 'replay' ? 'idempotency_replay' : 'idempotency_in_progress');
        return {
          ...idempotency.response,
          trace: trace.toPayload(),
          idempotencyStatus: idempotency.status,
        };
      }
      idempotencyRecord = idempotency.record;

      trace.mark('owner_resolving');
      ownerResolution = this.ownerResolver(envelope);
      trace.setOwner(ownerResolution);
      idempotencyRecord = this.idempotencyStore.bindOwner(
        idempotencyRecord,
        ownerResolution.ownerKey,
      );

      trace.mark('owner_lock_waiting');
      const lockStartedAt = Number(this.monotonicNow());
      const response = this.repository.withOwnerLocks(
        ownerResolution.ownerKeys,
        options.scope || `command:${envelope.type}`,
        (lockContext) => {
          trace.setOwnerQueueWaitMs(Math.max(0, Number(this.monotonicNow()) - lockStartedAt));
          trace.mark('owner_locked', { ownerKeys: ownerResolution.ownerKeys });
          return runWithOwnerContext({
            ownerKey: ownerResolution.ownerKey,
            ownerKeys: ownerResolution.ownerKeys,
            scope: lockContext.scope,
            commandId: envelope.commandId,
            lock: lockContext,
          }, () => {
            executionStartedAt = Number(this.monotonicNow());
            executionContext = {
              schema: 'command-execution-context-v1',
              envelope,
              ownerResolution,
              ownerLock: lockContext,
              trace,
              state: null,
              validation: null,
              execution: null,
              commit: null,
              projection: null,
            };

            trace.mark('state_loading');
            executionContext.state = typeof definition.load === 'function'
              ? definition.load(executionContext)
              : this.repository.findByPlayerId(envelope.playerId);
            if (!executionContext.state && definition.allowMissingState !== true) {
              trace.setValidatorResult({ success: false, error: 'GAME_STATE_NOT_FOUND' });
              trace.setExecutionDurationMs(Math.max(
                0,
                Number(this.monotonicNow()) - executionStartedAt,
              ));
              return this._recordTerminal(idempotencyRecord, {
                statusCode: 404,
                payload: {
                  success: false,
                  error: 'GAME_STATE_NOT_FOUND',
                  message: '游戏状态不存在',
                },
              }, trace);
            }
            trace.setRevisionBefore(executionContext.state?.revision);

            trace.mark('validating');
            executionContext.validation = typeof definition.validate === 'function'
              ? definition.validate(executionContext)
              : { success: true };
            trace.setValidatorResult(executionContext.validation);
            if (executionContext.validation?.success === false) {
              trace.setExecutionDurationMs(Math.max(
                0,
                Number(this.monotonicNow()) - executionStartedAt,
              ));
              const validationResponse = normalizeResponse(
                executionContext.validation.response || executionContext.validation.payload || {
                  success: false,
                  error: executionContext.validation.error || 'COMMAND_REJECTED',
                  message: executionContext.validation.message || 'Command rejected',
                },
                executionContext.validation.statusCode || 400,
              );
              return this._recordTerminal(idempotencyRecord, validationResponse, trace);
            }

            if (typeof definition.execute !== 'function') {
              const error = new Error('Command definition requires execute(context)');
              error.code = 'COMMAND_EXECUTOR_REQUIRED';
              throw error;
            }
            trace.mark('domain_executing');
            executionContext.execution = definition.execute(executionContext);
            if (executionContext.execution?.success === false
                && definition.commitRejected !== true) {
              trace.setExecutionDurationMs(Math.max(
                0,
                Number(this.monotonicNow()) - executionStartedAt,
              ));
              return this._recordTerminal(
                idempotencyRecord,
                normalizeResponse(
                  executionContext.execution,
                  executionContext.execution.statusCode || 400,
                ),
                trace,
              );
            }

            trace.mark('committing');
            executionContext.commit = this.committer.commit(executionContext, definition);
            executionContext.state = executionContext.commit.state || executionContext.state;
            trace.setCommitted(executionContext.commit.revisionAfter);
            trace.setCommitResult(executionContext.commit);

            try {
              trace.mark('projecting');
              executionContext.projection = typeof definition.project === 'function'
                ? definition.project(executionContext)
                : executionContext.execution;

              trace.mark('response_building');
              const builtResponse = typeof definition.respond === 'function'
                ? definition.respond(executionContext)
                : normalizeResponse(executionContext.projection, 200);
              trace.setExecutionDurationMs(Math.max(
                0,
                Number(this.monotonicNow()) - executionStartedAt,
              ));
              return this._recordTerminal(idempotencyRecord, normalizeResponse(builtResponse), trace);
            } catch (error) {
              trace.mark('projection_failed', { code: error?.code || '' });
              trace.setExecutionDurationMs(Math.max(
                0,
                Number(this.monotonicNow()) - executionStartedAt,
              ));
              return this._recordTerminal(idempotencyRecord, {
                statusCode: 202,
                payload: {
                  success: true,
                  error: 'PROJECTION_FAILED_AFTER_COMMIT',
                  message: '操作已生效，请重新同步游戏状态',
                  committed: true,
                  resyncRequired: true,
                },
              }, trace);
            }
          });
        },
        options.lockOptions || {},
      );
      return {
        ...response,
        trace: trace.toPayload(),
        idempotencyStatus: trace.idempotencyStatus,
      };
    } catch (error) {
      if (error instanceof CommandIdempotencyError) {
        const response = errorResponse(error, error.code, error.status || 409);
        trace.setIdempotencyStatus('conflict');
        trace.setResponseStatus(response.statusCode);
        trace.mark('idempotency_rejected', { code: error.code });
        return { ...response, trace: trace.toPayload(), idempotencyStatus: 'conflict' };
      }
      if (error instanceof CommandOwnerResolutionError) {
        const response = errorResponse(error, error.code, error.status || 400);
        trace.setValidatorResult({ success: false, error: error.code });
        return {
          ...this._recordTerminal(idempotencyRecord, response, trace),
          trace: trace.toPayload(),
          idempotencyStatus: trace.idempotencyStatus,
        };
      }
      if (error?.code === 'OWNER_LOCK_TIMEOUT') {
        if (idempotencyRecord) this.committer.abandon(idempotencyRecord);
        const response = errorResponse(error, 'OWNER_LOCK_TIMEOUT', 409);
        response.payload.retryable = true;
        response.payload.ownerKey = error.ownerKey || '';
        trace.setIdempotencyStatus('abandoned');
        trace.setResponseStatus(response.statusCode);
        trace.mark('owner_lock_timeout', { ownerKey: error.ownerKey || '' });
        return { ...response, trace: trace.toPayload(), idempotencyStatus: 'abandoned' };
      }
      if (trace.committed && idempotencyRecord) {
        const response = {
          statusCode: 202,
          payload: {
            success: true,
            error: 'PROJECTION_FAILED_AFTER_COMMIT',
            message: '操作已生效，请重新同步游戏状态',
            committed: true,
            resyncRequired: true,
          },
        };
        trace.setExecutionDurationMs(executionStartedAt == null
          ? null
          : Math.max(0, Number(this.monotonicNow()) - executionStartedAt));
        return {
          ...this._recordTerminal(idempotencyRecord, response, trace),
          trace: trace.toPayload(),
          idempotencyStatus: trace.idempotencyStatus,
        };
      }
      if (idempotencyRecord) this.committer.abandon(idempotencyRecord);
      const isRevisionConflict = error?.code === 'GAME_STATE_REVISION_CONFLICT';
      const response = errorResponse(
        error,
        isRevisionConflict ? 'GAME_STATE_REVISION_CONFLICT' : 'COMMAND_PIPELINE_FAILED',
        isRevisionConflict ? 409 : 500,
      );
      response.payload.retryable = isRevisionConflict;
      trace.setIdempotencyStatus('abandoned');
      trace.setResponseStatus(response.statusCode);
      trace.mark('failed', { code: error?.code || '' });
      return { ...response, trace: trace.toPayload(), idempotencyStatus: 'abandoned' };
    }
  }
}

module.exports = {
  CommandExecutionPipeline,
  errorResponse,
  normalizeResponse,
};
