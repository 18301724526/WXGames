(function (global) {
  const ClientCommandSender = global.ClientCommandSender
    || (typeof require === 'function' ? require('./ClientCommandSender') : null);
  const DEFAULT_TIMEOUT_MS = 10000;
  const DEFAULT_MAX_RETRIES = 1;
  const DEFAULT_RETRY_BASE_DELAY_MS = 250;
  const DEFAULT_RETRY_MAX_DELAY_MS = 2000;
  const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
  const COMMAND_SENDER_REQUEST = Symbol('command-sender-request');

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getNow(scheduler = {}) {
    const now = scheduler.now?.();
    return Number.isFinite(Number(now)) ? Number(now) : Date.now();
  }

  function delay(ms, scheduler = {}) {
    const waitMs = Math.max(0, Number(ms) || 0);
    if (waitMs <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      scheduler.setTimeout(resolve, waitMs);
    });
  }

  function createApiError(message, detail = {}) {
    const error = new Error(message || 'API request failed');
    Object.assign(error, detail);
    return error;
  }

  // Expected "can't march there" outcomes a player can trigger (e.g. clicking
  // water): the server authoritatively declines, but these are normal results,
  // not system failures, so they are surfaced as a hint rather than an error.
  const EXPECTED_WORLD_MARCH_DECLINES = new Set([
    'EXPLORE_ROUTE_BLOCKED',
    'EXPLORE_TARGET_TOO_FAR',
    'EXPLORE_TARGET_IS_ORIGIN',
    'EXPLORE_ROUTE_EMPTY',
  ]);

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round(toNumber(value, 0) * factor) / factor;
  }

  function summarizePoint(point = {}) {
    if (!point || typeof point !== 'object') return null;
    const summary = {
      x: round(point.x ?? point.clientX),
      y: round(point.y ?? point.clientY),
    };
    if (point.pointerId !== undefined) summary.pointerId = point.pointerId;
    return summary;
  }

  function summarizeAction(action = null) {
    if (!action || typeof action !== 'object') return null;
    const summary = { type: String(action.type || '').slice(0, 80) };
    ['siteId', 'territoryId', 'cityId', 'tileId', 'actorId', 'missionId', 'source'].forEach((key) => {
      if (action[key] !== undefined && action[key] !== '') summary[key] = String(action[key]).slice(0, 96);
    });
    if (action.targetQ !== undefined || action.q !== undefined) summary.targetQ = Math.floor(toNumber(action.targetQ ?? action.q));
    if (action.targetR !== undefined || action.r !== undefined) summary.targetR = Math.floor(toNumber(action.targetR ?? action.r));
    if (action.background !== undefined) summary.background = Boolean(action.background);
    if (action.known !== undefined) summary.known = Boolean(action.known);
    return summary;
  }

  function summarizeClientInputIntent(intent = null) {
    if (!intent || typeof intent !== 'object') return null;
    const points = intent.points && typeof intent.points === 'object' ? intent.points : {};
    const target = intent.target && typeof intent.target === 'object' ? intent.target : {};
    const picking = intent.picking && typeof intent.picking === 'object' ? intent.picking : {};
    const view = intent.view && typeof intent.view === 'object' ? intent.view : {};
    const camera = view.camera && typeof view.camera === 'object' ? view.camera : {};
    const viewport = view.viewport && typeof view.viewport === 'object' ? view.viewport : {};
    return {
      schema: String(intent.schema || '').slice(0, 80),
      kind: String(intent.kind || '').slice(0, 32),
      source: String(intent.source || '').slice(0, 80),
      inputId: String(intent.inputId || '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 64) || undefined,
      clientSequence: intent.clientSequence === undefined
        ? undefined
        : Math.max(0, Math.floor(toNumber(intent.clientSequence, 0))),
      points: {
        physical: summarizePoint(points.physical),
        layer: summarizePoint(points.layer),
      },
      action: summarizeAction(intent.action),
      target: {
        kind: String(target.kind || '').slice(0, 32),
        tileId: target.tileId ? String(target.tileId).slice(0, 96) : undefined,
        siteId: target.siteId ? String(target.siteId).slice(0, 96) : undefined,
        actorId: target.actorId ? String(target.actorId).slice(0, 96) : undefined,
        missionId: target.missionId ? String(target.missionId).slice(0, 96) : undefined,
        targetQ: target.targetQ !== undefined ? Math.floor(toNumber(target.targetQ)) : undefined,
        targetR: target.targetR !== undefined ? Math.floor(toNumber(target.targetR)) : undefined,
      },
      picking: {
        inputEpoch: Math.max(0, Math.floor(toNumber(picking.inputEpoch, 0))),
        signature: String(picking.signature || '').slice(0, 160),
        counts: picking.counts && typeof picking.counts === 'object' ? {
          sites: Math.max(0, Math.floor(toNumber(picking.counts.sites, 0))),
          actors: Math.max(0, Math.floor(toNumber(picking.counts.actors, 0))),
          targets: Math.max(0, Math.floor(toNumber(picking.counts.targets, 0))),
        } : undefined,
      },
      view: {
        camera: {
          x: round(camera.x),
          y: round(camera.y),
        },
        viewport: {
          scale: round(viewport.scale, 4),
        },
      },
    };
  }

  function summarizeAuthority(authority = null) {
    if (!authority || typeof authority !== 'object') return null;
    const command = authority.command && typeof authority.command === 'object' ? authority.command : {};
    const rejection = authority.rejection && typeof authority.rejection === 'object' ? authority.rejection : null;
    const summary = {
      schema: String(authority.schema || '').slice(0, 80),
      status: String(authority.status || '').slice(0, 32),
      commandId: String(authority.commandId || '').slice(0, 120),
      serverTime: String(authority.serverTime || '').slice(0, 80),
      command: {
        type: String(command.type || '').slice(0, 80),
        actorId: String(command.actorId || '').slice(0, 120),
        playerId: String(command.playerId || '').slice(0, 120),
        clientSequence: command.clientSequence ?? undefined,
        clientInput: summarizeClientInputIntent(command.clientInput || command.clientInputIntent || null),
      },
      rejection: rejection ? {
        error: String(rejection.error || '').slice(0, 120),
        message: String(rejection.message || '').slice(0, 240),
      } : null,
    };
    return JSON.parse(JSON.stringify(summary));
  }

  function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
  }

  function attachRequestMetadata(body = {}, requestId = '') {
    if (!body || typeof body !== 'object' || !body.clientCommand) return body;
    const clientCommand = body.clientCommand;
    return {
      ...body,
      requestId,
      commandId: body.commandId || clientCommand.commandId || '',
      idempotencyKey: body.idempotencyKey || clientCommand.idempotencyKey || '',
      clientCommand: {
        ...clientCommand,
        requestId,
        client: {
          ...(clientCommand.client || {}),
          requestId,
        },
      },
    };
  }

  class GameAPI {
    constructor(baseUrl, token, options = {}) {
      this.baseUrl = baseUrl;
      this.token = token || null;
      this.transport = options.transport || null;
      this.trace = options.trace || null;
      this.abortControllerFactory = typeof options.abortControllerFactory === 'function'
        ? options.abortControllerFactory
        : null;
      this.timeoutMs = Math.max(0, toNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS));
      this.maxRetries = Math.max(0, Math.floor(toNumber(options.maxRetries, DEFAULT_MAX_RETRIES)));
      this.retryBaseDelayMs = Math.max(0, toNumber(options.retryBaseDelayMs, DEFAULT_RETRY_BASE_DELAY_MS));
      this.retryMaxDelayMs = Math.max(this.retryBaseDelayMs, toNumber(options.retryMaxDelayMs, DEFAULT_RETRY_MAX_DELAY_MS));
      this.deployStatusPath = options.deployStatusPath || '/.wxgame-deploy-status.json';
      this.requestSeq = 0;
      this.versionEtag = '';
      this.cachedVersionInfo = null;
      // Measured heartbeat round-trip (ms). Written by heartbeat(); consumed
      // by CanvasGameApp.applyHeartbeat -> networkState.latencyMs -> the
      // map-home HUD latency readout. Real measurement, never fabricated.
      this.lastHeartbeatLatencyMs = null;
      this.scheduler = {
        setTimeout: options.scheduler?.setTimeout || global.setTimeout?.bind?.(global) || setTimeout,
        clearTimeout: options.scheduler?.clearTimeout || global.clearTimeout?.bind?.(global) || clearTimeout,
        now: options.scheduler?.now || (() => Date.now()),
      };
      if (!ClientCommandSender) {
        throw createApiError('ClientCommandSender is not loaded', {
          code: 'CLIENT_COMMAND_SENDER_MISSING',
        });
      }
      this.commandSender = new ClientCommandSender({
        createIdSeed: options.createCommandIdSeed,
        operationLog: options.operationLog,
        transport: (envelope, submitOptions) => this.sendCommandEnvelope(envelope, submitOptions),
      });
      global.WorldMarchTrace?.log?.('api:boot', {
        baseUrl,
        hasToken: Boolean(this.token),
        trace: global.WorldMarchTrace?.getBootState?.(),
      });
    }

    setToken(token) {
      this.token = token;
    }

    buildUrl(path) {
      return `${this.baseUrl}${path}`;
    }

    async request(method, path, body, options = {}) {
      if (!this.isRetryableMethod(method) && options.senderToken !== COMMAND_SENDER_REQUEST) {
        throw createApiError('Write requests must use ClientCommandSender', {
          code: 'CLIENT_COMMAND_SENDER_REQUIRED',
          status: 0,
          method,
          path,
        });
      }
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const trace = global.WorldMarchTrace;
      if (trace?.enabled?.()) headers['X-World-March-Trace'] = '1';
      const actionBody = body && typeof body === 'object' ? body : {};
      const requestId = `${options.requestIdPrefix || 'api'}-${++this.requestSeq}`;
      headers['X-Client-Request-ID'] = requestId;
      const commandBody = attachRequestMetadata(actionBody, requestId);
      if (path === '/version' && this.versionEtag) {
        headers['If-None-Match'] = this.versionEtag;
      }
      const isWorldMarchAction = path === '/game/action'
        && ['startWorldMarch', 'returnWorldMarch', 'stopWorldMarch']
          .includes(commandBody.action);
      const isWorldMarchSync = trace?.enabled?.() && ['/game/state', '/game/heartbeat'].includes(path);
      const tracedBody = isWorldMarchAction && trace?.enabled?.()
        ? { ...commandBody, debugTrace: true, worldMarchTrace: true }
        : commandBody;
      const requestPayload = {
        url: this.buildUrl(path),
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(tracedBody || {}),
        path,
        requestId,
        timeoutMs: this.timeoutMs,
      };
      global.ClientOperationLog?.record?.('api:request', {
        requestId,
        method,
        path,
        action: commandBody.action || '',
        clientInput: summarizeClientInputIntent(commandBody.clientInputIntent),
        body: global.WorldMarchTrace?.summarizeActionBody?.(commandBody) || {
          action: commandBody.action || '',
          commandId: commandBody.clientCommand?.commandId || '',
        },
      });
      const loadTrace = this.trace;
      const loadTraceSpan = loadTrace?.apiStart?.(method, path, requestPayload.url, {
        requestId,
        hasToken: Boolean(this.token),
        bodyBytes: requestPayload.body ? requestPayload.body.length : 0,
        timeoutMs: this.timeoutMs,
      });
      if (isWorldMarchAction) {
        trace?.log?.('api:request', {
          method,
          path,
          body: trace.summarizeActionBody?.(tracedBody),
        });
      } else if (isWorldMarchSync) {
        trace?.log?.('api:syncRequest', { method, path });
      }
      let response = null;
      let data = {};
      let attempts = 0;
      const startedAt = getNow(this.scheduler);
      try {
        while (true) {
          attempts += 1;
          try {
            response = await this.performRequest({
              ...requestPayload,
              attempt: attempts,
              maxRetries: this.maxRetries,
            });
            data = response.status === 304 ? {} : await response.json().catch(() => ({}));
            if (response.ok || !this.shouldRetry({ method, attempts, response })) break;
            await delay(this.getRetryDelayMs(attempts), this.scheduler);
          } catch (error) {
            if (!this.shouldRetry({ method, attempts, error })) throw error;
            await delay(this.getRetryDelayMs(attempts), this.scheduler);
          }
        }
      } catch (error) {
        const requestError = this.normalizeRequestError(error, {
          method,
          path,
          requestId,
          attempts,
          response,
          startedAt,
          retryable: this.isRetryableError(error),
        });
        global.ClientOperationLog?.record?.('api:error', {
          requestId,
          method,
          path,
          action: commandBody.action || '',
          commandId: commandBody.clientCommand?.commandId || '',
          clientInput: summarizeClientInputIntent(commandBody.clientInputIntent),
          message: requestError.message,
          status: requestError.status || 0,
          attempts,
          durationMs: requestError.durationMs || 0,
        }, { flush: true });
        loadTrace?.apiFail?.(loadTraceSpan, requestError, {
          status: response?.status || 0,
          ok: false,
          requestId,
          attempts,
          code: requestError.code || '',
          retryable: Boolean(requestError.retryable),
        });
        throw requestError;
      }
      if (!response.ok) {
        if (response.status === 304 && path === '/version' && this.cachedVersionInfo) {
          data = {
            ...this.cachedVersionInfo,
            notModified: true,
          };
        } else {
        const worldMarchDecline =
          isWorldMarchAction && data && EXPECTED_WORLD_MARCH_DECLINES.has(data.error)
            ? data.error
            : '';
        if (isWorldMarchAction) {
          trace?.error?.('api:error', {
            status: response.status,
            body: trace.summarizeActionBody?.(tracedBody),
            payload: trace.summarizeApiPayload?.(data) || data,
          });
          // Keep the diagnostic trace, but do not raise an alarming console error
          // for an expected decline (clicking water etc.) — only for real failures.
          if (!worldMarchDecline && !trace?.enabled?.() && global.console?.error) {
            global.console.error('[GameAPI] world march action failed', {
              status: response.status,
              body: trace?.summarizeActionBody?.(tracedBody) || tracedBody,
              payload: trace?.summarizeApiPayload?.(data) || data,
            });
          }
        } else if (isWorldMarchSync) {
          trace?.error?.('api:syncError', {
            status: response.status,
            path,
            payload: trace.summarizeApiPayload?.(data) || data,
          });
        }
        const error = createApiError(data.message || data.error || `HTTP ${response.status}`, {
          code: 'GAME_API_HTTP_ERROR',
          worldMarchDecline,
          payload: data,
          status: response.status,
          method,
          path,
          requestId,
          attempts,
          durationMs: Math.max(0, Math.round(getNow(this.scheduler) - startedAt)),
          retryable: this.isRetryableStatus(response.status) && this.isRetryableMethod(method),
        });
        global.ClientOperationLog?.record?.('api:error', {
          requestId,
          method,
          path,
          action: commandBody.action || '',
          commandId: commandBody.clientCommand?.commandId || '',
          clientInput: summarizeClientInputIntent(commandBody.clientInputIntent),
          status: response.status,
          error: data.error || '',
          message: data.message || '',
          attempts,
          durationMs: Math.max(0, Math.round(getNow(this.scheduler) - startedAt)),
        }, { flush: true });
        loadTrace?.apiFail?.(loadTraceSpan, error, {
          status: response.status,
          ok: false,
          requestId,
          attempts,
          code: error.code,
          retryable: Boolean(error.retryable),
          payload: loadTrace.summarizePayload?.(data) || null,
        });
        throw error;
        }
      }
      if (path === '/version') {
        this.captureVersionCache(response, data);
      }
      if (path === '/game/state' || path === '/game/heartbeat') {
        const payloadWorldMap = global.CodexWorldMapDiag?.summarizeWorldMap?.(data) || null;
        global.CodexWorldMapDiag?.logChanged?.('api:response', {
          method,
          path,
          status: response.status,
          hasGameState: Boolean(data?.gameState),
          hasWorldMap: Boolean(payloadWorldMap?.hasWorldMap),
          tileCount: payloadWorldMap?.tileCount || 0,
          version: payloadWorldMap?.version || 0,
        }, {
          method,
          path,
          status: response.status,
          hasGameState: Boolean(data?.gameState),
          payloadWorldMap,
        });
      }
      loadTrace?.apiEnd?.(loadTraceSpan, {
        status: response.status,
        ok: true,
        requestId,
        attempts,
        payload: loadTrace.summarizePayload?.(data) || null,
      });
      if (isWorldMarchAction) {
        trace?.log?.('api:response', {
          status: response.status,
          body: trace.summarizeActionBody?.(tracedBody),
          payload: trace.summarizeApiPayload?.(data) || data,
        });
      } else if (isWorldMarchSync) {
        trace?.log?.('api:syncResponse', {
          status: response.status,
          path,
          payload: path === '/game/heartbeat'
            ? { type: data.type, serverTime: data.serverTime, hasGameState: Boolean(data.gameState) }
            : (trace.summarizeApiPayload?.(data) || data),
        });
      }
      global.ClientOperationLog?.record?.('api:response', {
        requestId,
        method,
        path,
        action: commandBody.action || '',
        commandId: commandBody.clientCommand?.commandId || data?.commandId || data?.command?.commandId || '',
        status: response.status,
        attempts,
        durationMs: Math.max(0, Math.round(getNow(this.scheduler) - startedAt)),
        payload: global.WorldMarchTrace?.summarizeApiPayload?.(data) || {
          success: data?.success,
          error: data?.error || '',
          authority: summarizeAuthority(data?.authority),
        },
      }, { flush: true });
      return data;
    }

    captureVersionCache(response, data) {
      const getHeader = response?.headers?.get?.bind?.(response.headers);
      const etag = getHeader ? getHeader('etag') || getHeader('ETag') : '';
      if (etag) this.versionEtag = etag;
      if (data && data.deploymentId && !data.notModified) this.cachedVersionInfo = { ...data };
    }

    async performRequest(requestPayload) {
      const abortController = this.abortControllerFactory?.() || null;
      let timeoutId = null;
      let didTimeout = false;
      const payload = {
        ...requestPayload,
        signal: abortController?.signal,
      };
      if (!this.transport || typeof this.transport.request !== 'function') {
        throw createApiError('GameAPI transport is not configured', {
          code: 'GAME_API_TRANSPORT_MISSING',
          status: 0,
          path: payload.path,
          requestId: payload.requestId,
        });
      }
      const requestPromise = this.transport.request(payload);
      const timeoutPromise = this.timeoutMs > 0
        ? new Promise((_, reject) => {
          timeoutId = this.scheduler.setTimeout(() => {
            didTimeout = true;
            abortController?.abort?.();
            reject(createApiError(`API request timed out after ${this.timeoutMs}ms`, {
              name: 'AbortError',
              code: 'GAME_API_TIMEOUT',
              status: 0,
              timeoutMs: this.timeoutMs,
            }));
          }, this.timeoutMs);
        })
        : null;
      try {
        return timeoutPromise
          ? await Promise.race([requestPromise, timeoutPromise])
          : await requestPromise;
      } catch (error) {
        if (didTimeout || isAbortError(error)) {
          throw createApiError(`API request timed out after ${this.timeoutMs}ms`, {
            name: 'AbortError',
            code: 'GAME_API_TIMEOUT',
            status: 0,
            timeoutMs: this.timeoutMs,
            cause: error,
          });
        }
        throw error;
      } finally {
        if (timeoutId !== null) this.scheduler.clearTimeout(timeoutId);
      }
    }

    isRetryableMethod(method) {
      return method === 'GET' || method === 'HEAD';
    }

    isRetryableStatus(status) {
      return RETRYABLE_STATUS_CODES.has(Number(status));
    }

    isRetryableError(error) {
      if (!error) return false;
      return error.code === 'GAME_API_TIMEOUT'
        || isAbortError(error)
        || error.name === 'TypeError'
        || error.status === 0;
    }

    shouldRetry({ method, attempts, response, error }) {
      if (!this.isRetryableMethod(method)) return false;
      if (attempts > this.maxRetries) return false;
      if (response) return this.isRetryableStatus(response.status);
      return this.isRetryableError(error);
    }

    getRetryDelayMs(attempt) {
      const delayMs = this.retryBaseDelayMs * (2 ** Math.max(0, attempt - 1));
      return Math.min(this.retryMaxDelayMs, delayMs);
    }

    normalizeRequestError(error, detail = {}) {
      if (error?.method && error?.path && error?.requestId) return error;
      return createApiError(error?.message || 'API request failed', {
        ...error,
        code: error?.code || (isAbortError(error) ? 'GAME_API_ABORTED' : 'GAME_API_NETWORK_ERROR'),
        status: Number(error?.status || detail.response?.status || 0),
        method: detail.method,
        path: detail.path,
        requestId: detail.requestId,
        attempts: detail.attempts,
        durationMs: Math.max(0, Math.round(getNow(this.scheduler) - detail.startedAt)),
        timeoutMs: error?.timeoutMs || this.timeoutMs,
        retryable: Boolean(detail.retryable && this.isRetryableMethod(detail.method)),
        cause: error,
      });
    }

    submitCommand(type, payload = {}, options = {}) {
      const requestBody = options.requestBody && typeof options.requestBody === 'object'
        ? options.requestBody
        : payload;
      return this.commandSender.submit(type, payload, { ...options, requestBody });
    }

    sendCommandEnvelope(envelope = {}, options = {}) {
      const path = String(options.path || '').trim();
      if (!path.startsWith('/')) {
        throw createApiError('Client command path is required', {
          code: 'CLIENT_COMMAND_PATH_REQUIRED',
          status: 0,
          commandId: envelope.commandId || '',
        });
      }
      const requestBody = options.requestBody && typeof options.requestBody === 'object'
        ? options.requestBody
        : envelope.payload || {};
      return this.request('POST', path, {
        ...requestBody,
        commandId: envelope.commandId,
        idempotencyKey: envelope.idempotencyKey,
        clientCommand: envelope,
      }, {
        senderToken: COMMAND_SENDER_REQUEST,
        requestIdPrefix: options.requestIdPrefix || 'api',
      });
    }

    async submitDiagnosticCommand(type, payload, options = {}) {
      try {
        return await this.submitCommand(type, payload, options);
      } catch (error) {
        if (!error?.status) {
          global.console?.warn?.(options.warning || '[GameAPI] diagnostic write failed', error);
        }
        const result = {
          success: false,
          error: error?.message || String(error || ''),
        };
        if (error?.status) result.status = error.status;
        if (error?.payload) result.payload = error.payload;
        return result;
      }
    }

    reportClientEvent(event = {}) {
      const body = event && typeof event === 'object'
        ? { ...event }
        : { type: 'frontend_load_failure', message: String(event || '') };
      body.type = body.type || 'frontend_load_failure';
      return this.submitDiagnosticCommand('clientEventIngest', body, {
        path: '/client-events',
        requestBody: body,
        requestIdPrefix: 'client-event',
        warning: '[GameAPI] client event report failed',
      });
    }

    uploadClientOperationLog(snapshot = {}) {
      const body = snapshot && typeof snapshot === 'object' ? { ...snapshot } : {};
      return this.submitDiagnosticCommand('clientOperationLogIngest', body, {
        path: '/client-operation-logs',
        requestBody: body,
        requestIdPrefix: 'client-oplog',
        warning: '[GameAPI] client operation log upload failed',
      });
    }

    getState() { return this.request('GET', '/game/state'); }
    async heartbeat(options = {}) {
      const report = options?.worldMarchClientReport || null;
      const startedAt = this.scheduler.now();
      try {
        const data = report
          ? await this.submitCommand('heartbeat', { worldMarchClientReport: report }, {
            ...(options.commandOptions || {}),
            path: '/game/heartbeat',
            requestBody: { worldMarchClientReport: report },
          })
          : await this.request('GET', '/game/heartbeat');
        const elapsed = Math.round(this.scheduler.now() - startedAt);
        this.lastHeartbeatLatencyMs = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
        return data;
      } catch (error) {
        this.lastHeartbeatLatencyMs = null;
        throw error;
      }
    }
    getTasks() { return this.request('GET', '/game/tasks'); }
    resetPlayer(commandOptions = {}) {
      return this.submitCommand('playerReset', {}, {
        ...commandOptions,
        path: '/player/reset',
        requestBody: {},
      });
    }
    getVersion() { return this.request('GET', '/version'); }
    async getDeployStatus() {
      if (!this.deployStatusPath) return null;
      const requestId = `deploy-status-${++this.requestSeq}`;
      const response = await this.performRequest({
        url: this.deployStatusPath,
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'X-Client-Request-ID': requestId,
        },
        path: this.deployStatusPath,
        requestId,
        timeoutMs: this.timeoutMs,
        attempt: 1,
        maxRetries: 0,
      });
      if (!response.ok) return null;
      return response.json().catch(() => null);
    }
    build(buildingId, commandOptions = {}) {
      return this.submitCommand('build', { buildingId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'build', target: buildingId },
      });
    }
    upgrade(buildingId, commandOptions = {}) {
      return this.submitCommand('upgrade', { buildingId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'upgrade', target: buildingId },
      });
    }
    assignJob(job, count, commandOptions = {}) {
      return this.submitCommand('assign', { job, count }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'assign', target: job, count },
      });
    }
    applyTalentPolicy(policyId, policy = null, commandOptions = {}) {
      return this.submitCommand('applyTalentPolicy', { policyId, policy }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'applyTalentPolicy', policyId, policy },
      });
    }
    saveTalentPolicy(policy, commandOptions = {}) {
      return this.submitCommand('saveTalentPolicy', { policy }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'saveTalentPolicy', policy },
      });
    }
    deleteTalentPolicy(policyId, commandOptions = {}) {
      return this.submitCommand('deleteTalentPolicy', { policyId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'deleteTalentPolicy', policyId },
      });
    }
    research(techId, commandOptions = {}) {
      return this.submitCommand('research', { techId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'research', techId },
      });
    }
    seekFamousPerson(source = 'seek', commandOptions = {}) {
      return this.submitCommand('seekFamousPerson', { source }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'seekFamousPerson', source },
      });
    }
    acceptFamousPerson(candidateId, commandOptions = {}) {
      return this.submitCommand('acceptFamousPerson', { candidateId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'acceptFamousPerson', candidateId },
      });
    }
    dismissFamousPersonCandidate(candidateId, commandOptions = {}) {
      return this.submitCommand('dismissFamousPersonCandidate', { candidateId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'dismissFamousPersonCandidate', candidateId },
      });
    }
    assignFamousAttributePoint(personId, attribute, commandOptions = {}) {
      return this.submitCommand('assignFamousAttributePoint', { personId, attribute }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'assignFamousAttributePoint', personId, attribute },
      });
    }
    setArmyFormation(cityId, slot, memberIds = [], soldierAssignments = {}, commandOptions = {}) {
      const payload = { cityId, slot, memberIds, soldierAssignments };
      return this.submitCommand('setArmyFormation', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'setArmyFormation', ...payload },
      });
    }
    veteranCampWithdraw(cityId, soldiers, commandOptions = {}) {
      const payload = { cityId, soldiers };
      return this.submitCommand('veteranCampWithdraw', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'veteranCampWithdraw', ...payload },
      });
    }
    veteranCampUpgrade(cityId, commandOptions = {}) {
      return this.submitCommand('veteranCampUpgrade', { cityId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'veteranCampUpgrade', cityId },
      });
    }
    advanceEra(commandOptions = {}) {
      return this.submitCommand('advanceEra', {}, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'advanceEra' },
      });
    }
    claimTaskReward(taskId, category = 'main', commandOptions = {}) {
      const payload = { taskId, category };
      return this.submitCommand('claimTaskReward', payload, {
        ...commandOptions,
        path: '/game/tasks/claim',
        requestBody: payload,
      });
    }
    claimEvent(eventId, optionId, commandOptions = {}) {
      const payload = { eventId, optionId };
      return this.submitCommand('claimEvent', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'claimEvent', ...payload },
      });
    }
    resolveCapture(decisionId, choice, commandOptions = {}) {
      const payload = { decisionId, choice };
      return this.submitCommand('resolveCapture', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'resolveCapture', ...payload },
      });
    }
    startWorldMarch(options = {}) {
      const { commandOptions = {}, clientInputIntent: rawClientInputIntent, ...marchOptions } = options;
      const clientInputIntent = summarizeClientInputIntent(rawClientInputIntent);
      const payload = { ...marchOptions, ...(clientInputIntent ? { clientInputIntent } : {}) };
      return this.submitCommand('startWorldMarch', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'startWorldMarch', ...payload },
      });
    }
    returnWorldMarch(missionId, options = {}) {
      const clientInputIntent = summarizeClientInputIntent(options.clientInputIntent);
      const payload = { missionId, ...(clientInputIntent ? { clientInputIntent } : {}) };
      return this.submitCommand('returnWorldMarch', payload, {
        ...(options.commandOptions || {}),
        path: '/game/action',
        requestBody: { action: 'returnWorldMarch', ...payload },
      });
    }
    stopWorldMarch(missionId, options = {}) {
      const clientInputIntent = summarizeClientInputIntent(options.clientInputIntent);
      const payload = { missionId, ...(clientInputIntent ? { clientInputIntent } : {}) };
      return this.submitCommand('stopWorldMarch', payload, {
        ...(options.commandOptions || {}),
        path: '/game/action',
        requestBody: { action: 'stopWorldMarch', ...payload },
      });
    }
    startWorldCombat(options = {}) {
      const payload = {
        encounterId: options.encounterId || options.combatEncounterId || '',
        missionId: options.missionId || '',
        formationSlot: options.formationSlot ?? options.slot ?? 1,
        cityId: options.cityId || 'capital',
        targetQ: options.targetQ ?? options.q ?? options.x,
        targetR: options.targetR ?? options.r ?? options.y,
      };
      return this.submitCommand('startWorldCombat', payload, {
        ...(options.commandOptions || {}),
        path: '/game/action',
        requestBody: { action: 'startWorldCombat', ...payload },
      });
    }
    resolveWorldCombat(battleId, inputStream = [], encounterId = '', commandOptions = {}) {
      const payload = { battleId, encounterId, inputStream };
      return this.submitCommand('resolveWorldCombat', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'resolveWorldCombat', ...payload },
      });
    }
    startConquest(territoryId, expedition = {}, commandOptions = {}) {
      const payload = { territoryId, expedition };
      return this.submitCommand('startConquest', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'startConquest', ...payload },
      });
    }
    claimConquest(territoryId, commandOptions = {}) {
      return this.submitCommand('claimConquest', { territoryId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'claimConquest', territoryId },
      });
    }
    renameCity(territoryId, name, commandOptions = {}) {
      const payload = { territoryId, name };
      return this.submitCommand('renameCity', payload, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'renameCity', ...payload },
      });
    }
    renamePolity(name, commandOptions = {}) {
      return this.submitCommand('renamePolity', { name }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'renamePolity', name },
      });
    }
    switchCity(cityId, commandOptions = {}) {
      return this.submitCommand('switchCity', { cityId }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'switchCity', cityId },
      });
    }
    advanceTutorial(step, commandOptions = {}) {
      return this.submitCommand('tutorialAdvance', { step }, {
        ...commandOptions,
        path: '/game/action',
        requestBody: { action: 'tutorialAdvance', step },
      });
    }
  }

  global.GameAPI = GameAPI;
  GameAPI.summarizeClientInputIntent = summarizeClientInputIntent;
  GameAPI.summarizeAuthority = summarizeAuthority;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameAPI;
})(typeof window !== 'undefined' ? window : globalThis);
