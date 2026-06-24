(function (global) {
  const DEFAULT_TIMEOUT_MS = 10000;
  const DEFAULT_MAX_RETRIES = 1;
  const DEFAULT_RETRY_BASE_DELAY_MS = 250;
  const DEFAULT_RETRY_MAX_DELAY_MS = 2000;
  const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

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

  class GameAPI {
    constructor(baseUrl, token, options = {}) {
      this.baseUrl = baseUrl;
      this.token = token || null;
      this.transport = options.transport || null;
      this.timeoutMs = Math.max(0, toNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS));
      this.maxRetries = Math.max(0, Math.floor(toNumber(options.maxRetries, DEFAULT_MAX_RETRIES)));
      this.retryBaseDelayMs = Math.max(0, toNumber(options.retryBaseDelayMs, DEFAULT_RETRY_BASE_DELAY_MS));
      this.retryMaxDelayMs = Math.max(this.retryBaseDelayMs, toNumber(options.retryMaxDelayMs, DEFAULT_RETRY_MAX_DELAY_MS));
      this.requestSeq = 0;
      this.versionEtag = '';
      this.cachedVersionInfo = null;
      this.scheduler = {
        setTimeout: options.scheduler?.setTimeout || global.setTimeout?.bind?.(global) || setTimeout,
        clearTimeout: options.scheduler?.clearTimeout || global.clearTimeout?.bind?.(global) || clearTimeout,
        now: options.scheduler?.now || (() => Date.now()),
      };
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

    async request(method, path, body) {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const trace = global.WorldMarchTrace;
      if (trace?.enabled?.()) headers['X-World-March-Trace'] = '1';
      const actionBody = body && typeof body === 'object' ? body : {};
      const requestId = `api-${++this.requestSeq}`;
      headers['X-Client-Request-ID'] = requestId;
      if (path === '/version' && this.versionEtag) {
        headers['If-None-Match'] = this.versionEtag;
      }
      const isWorldMarchAction = path === '/game/action'
        && ['startWorldMarch', 'returnWorldMarch', 'stopWorldMarch']
          .includes(actionBody.action);
      const isWorldMarchSync = trace?.enabled?.() && ['/game/state', '/game/heartbeat'].includes(path);
      const tracedBody = isWorldMarchAction && trace?.enabled?.()
        ? { ...actionBody, debugTrace: true, worldMarchTrace: true }
        : actionBody;
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
        action: actionBody.action || '',
        clientInput: summarizeClientInputIntent(actionBody.clientInputIntent),
        body: global.WorldMarchTrace?.summarizeActionBody?.(actionBody) || {
          action: actionBody.action || '',
        },
      });
      const loadTrace = global.H5LoadTrace;
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
          action: actionBody.action || '',
          clientInput: summarizeClientInputIntent(actionBody.clientInputIntent),
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
          action: actionBody.action || '',
          clientInput: summarizeClientInputIntent(actionBody.clientInputIntent),
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
        action: actionBody.action || '',
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
      const abortController = typeof global.AbortController === 'function'
        ? new global.AbortController()
        : null;
      let timeoutId = null;
      let didTimeout = false;
      const payload = {
        ...requestPayload,
        signal: abortController?.signal,
      };
      const requestPromise = this.transport && typeof this.transport.request === 'function'
        ? this.transport.request(payload)
        : fetch(payload.url, {
          method: payload.method,
          headers: payload.headers,
          body: payload.body,
          signal: payload.signal,
        });
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

    async reportClientEvent(event = {}) {
      const body = event && typeof event === 'object'
        ? { ...event }
        : { type: 'frontend_load_failure', message: String(event || '') };
      const requestId = `client-event-${++this.requestSeq}`;
      const headers = {
        'Content-Type': 'application/json',
        'X-Client-Request-ID': requestId,
      };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      try {
        const response = await this.performRequest({
          url: this.buildUrl('/client-events'),
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: body.type || 'frontend_load_failure',
            ...body,
            requestId,
          }),
          path: '/client-events',
          requestId,
          timeoutMs: this.timeoutMs,
          attempt: 1,
          maxRetries: 0,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            success: false,
            status: response.status,
            payload: data,
          };
        }
        return data;
      } catch (error) {
        global.console?.warn?.('[GameAPI] client event report failed', error);
        return {
          success: false,
          error: error?.message || String(error || ''),
        };
      }
    }

    async uploadClientOperationLog(snapshot = {}) {
      const body = snapshot && typeof snapshot === 'object' ? { ...snapshot } : {};
      const requestId = `client-oplog-${++this.requestSeq}`;
      const headers = {
        'Content-Type': 'application/json',
        'X-Client-Request-ID': requestId,
      };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      try {
        const response = await this.performRequest({
          url: this.buildUrl('/client-operation-logs'),
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...body,
            requestId,
          }),
          path: '/client-operation-logs',
          requestId,
          timeoutMs: this.timeoutMs,
          attempt: 1,
          maxRetries: 0,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            success: false,
            status: response.status,
            payload: data,
          };
        }
        return data;
      } catch (error) {
        global.console?.warn?.('[GameAPI] client operation log upload failed', error);
        return {
          success: false,
          error: error?.message || String(error || ''),
        };
      }
    }

    getState() { return this.request('GET', '/game/state'); }
    heartbeat(options = {}) {
      const report = options?.worldMarchClientReport || null;
      return report
        ? this.request('POST', '/game/heartbeat', { worldMarchClientReport: report })
        : this.request('GET', '/game/heartbeat');
    }
    getTasks() { return this.request('GET', '/game/tasks'); }
    getVersion() { return this.request('GET', '/version'); }
    build(buildingId) { return this.request('POST', '/game/action', { action: 'build', target: buildingId }); }
    upgrade(buildingId) { return this.request('POST', '/game/action', { action: 'upgrade', target: buildingId }); }
    assignJob(job, count) { return this.request('POST', '/game/action', { action: 'assign', target: job, count }); }
    applyTalentPolicy(policyId, policy = null) { return this.request('POST', '/game/action', { action: 'applyTalentPolicy', policyId, policy }); }
    saveTalentPolicy(policy) { return this.request('POST', '/game/action', { action: 'saveTalentPolicy', policy }); }
    deleteTalentPolicy(policyId) { return this.request('POST', '/game/action', { action: 'deleteTalentPolicy', policyId }); }
    research(techId) { return this.request('POST', '/game/action', { action: 'research', techId }); }
    seekFamousPerson(source = 'seek') { return this.request('POST', '/game/action', { action: 'seekFamousPerson', source }); }
    acceptFamousPerson(candidateId) { return this.request('POST', '/game/action', { action: 'acceptFamousPerson', candidateId }); }
    dismissFamousPersonCandidate(candidateId) { return this.request('POST', '/game/action', { action: 'dismissFamousPersonCandidate', candidateId }); }
    assignFamousAttributePoint(personId, attribute) { return this.request('POST', '/game/action', { action: 'assignFamousAttributePoint', personId, attribute }); }
    setArmyFormation(cityId, slot, memberIds = [], soldierAssignments = {}) {
      return this.request('POST', '/game/action', { action: 'setArmyFormation', cityId, slot, memberIds, soldierAssignments });
    }
    advanceEra() { return this.request('POST', '/game/action', { action: 'advanceEra' }); }
    claimTaskReward(taskId, category = 'main') { return this.request('POST', '/game/tasks/claim', { taskId, category }); }
    claimEvent(eventId, optionId) { return this.request('POST', '/game/action', { action: 'claimEvent', eventId, optionId }); }
    scoutTerritory(direction) { return this.request('POST', '/game/action', { action: 'scoutTerritory', direction }); }
    claimScout(missionId) { return this.request('POST', '/game/action', { action: 'claimScout', missionId }); }
    startWorldMarch(options = {}) {
      const clientInputIntent = summarizeClientInputIntent(options.clientInputIntent);
      return this.request('POST', '/game/action', {
        action: 'startWorldMarch',
        ...options,
        ...(clientInputIntent ? { clientInputIntent } : {}),
      });
    }
    returnWorldMarch(missionId, options = {}) {
      const clientInputIntent = summarizeClientInputIntent(options.clientInputIntent);
      return this.request('POST', '/game/action', {
        action: 'returnWorldMarch',
        missionId,
        ...(clientInputIntent ? { clientInputIntent } : {}),
      });
    }
    stopWorldMarch(missionId, options = {}) {
      const clientInputIntent = summarizeClientInputIntent(options.clientInputIntent);
      return this.request('POST', '/game/action', {
        action: 'stopWorldMarch',
        missionId,
        ...(clientInputIntent ? { clientInputIntent } : {}),
      });
    }
    startWorldCombat(options = {}) {
      return this.request('POST', '/game/action', {
        action: 'startWorldCombat',
        missionId: options.missionId || '',
        formationSlot: options.formationSlot ?? options.slot ?? 1,
        cityId: options.cityId || 'capital',
        targetQ: options.targetQ ?? options.q ?? options.x,
        targetR: options.targetR ?? options.r ?? options.y,
      });
    }
    resolveWorldCombat(battleId, inputStream = []) {
      return this.request('POST', '/game/action', {
        action: 'resolveWorldCombat',
        battleId,
        inputStream,
      });
    }
    startConquest(territoryId, expedition = {}) { return this.request('POST', '/game/action', { action: 'startConquest', territoryId, expedition }); }
    claimConquest(territoryId) { return this.request('POST', '/game/action', { action: 'claimConquest', territoryId }); }
    renameCity(territoryId, name) { return this.request('POST', '/game/action', { action: 'renameCity', territoryId, name }); }
    renamePolity(name) { return this.request('POST', '/game/action', { action: 'renamePolity', name }); }
    switchCity(cityId) { return this.request('POST', '/game/action', { action: 'switchCity', cityId }); }
    advanceTutorial(step) { return this.request('POST', '/game/action', { action: 'tutorialAdvance', step }); }
  }

  global.GameAPI = GameAPI;
  GameAPI.summarizeClientInputIntent = summarizeClientInputIntent;
  GameAPI.summarizeAuthority = summarizeAuthority;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameAPI;
})(typeof window !== 'undefined' ? window : globalThis);
