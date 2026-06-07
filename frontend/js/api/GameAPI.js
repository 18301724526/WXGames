(function (global) {
  class GameAPI {
    constructor(baseUrl, token, options = {}) {
      this.baseUrl = baseUrl;
      this.token = token || null;
      this.transport = options.transport || null;
    }

    setToken(token) {
      this.token = token;
    }

    buildUrl(path) {
      const baseUrl = `${this.baseUrl}${path}`;
      if (path !== '/version') return baseUrl;
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}_=${Date.now()}`;
    }

    async request(method, path, body) {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const trace = global.WorldMarchTrace;
      if (trace?.enabled?.()) headers['X-World-March-Trace'] = '1';
      const actionBody = body && typeof body === 'object' ? body : {};
      const isWorldMarchAction = path === '/game/action'
        && ['startWorldMarch', 'returnWorldMarch', 'stopWorldMarch', 'claimExplore', 'startExplore']
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
      };
      if (isWorldMarchAction) {
        trace?.log?.('api:request', {
          method,
          path,
          body: trace.summarizeActionBody?.(tracedBody),
        });
      } else if (isWorldMarchSync) {
        trace?.log?.('api:syncRequest', { method, path });
      }
      const response = this.transport && typeof this.transport.request === 'function'
        ? await this.transport.request(requestPayload)
        : await fetch(requestPayload.url, {
          method: requestPayload.method,
          headers: requestPayload.headers,
          body: requestPayload.body,
        });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isWorldMarchAction) {
          trace?.error?.('api:error', {
            status: response.status,
            body: trace.summarizeActionBody?.(tracedBody),
            payload: trace.summarizeApiPayload?.(data) || data,
          });
        } else if (isWorldMarchSync) {
          trace?.error?.('api:syncError', {
            status: response.status,
            path,
            payload: trace.summarizeApiPayload?.(data) || data,
          });
        }
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        error.payload = data;
        throw error;
      }
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
      return data;
    }

    getState() { return this.request('GET', '/game/state'); }
    heartbeat() { return this.request('GET', '/game/heartbeat'); }
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
    setArmyFormation(cityId, slot, memberIds = []) { return this.request('POST', '/game/action', { action: 'setArmyFormation', cityId, slot, memberIds }); }
    advanceEra() { return this.request('POST', '/game/action', { action: 'advanceEra' }); }
    claimTaskReward(taskId, category = 'main') { return this.request('POST', '/game/tasks/claim', { taskId, category }); }
    claimEvent(eventId, optionId) { return this.request('POST', '/game/action', { action: 'claimEvent', eventId, optionId }); }
    scoutTerritory(direction) { return this.request('POST', '/game/action', { action: 'scoutTerritory', direction }); }
    claimScout(missionId) { return this.request('POST', '/game/action', { action: 'claimScout', missionId }); }
    startExplore(options = {}) { return this.request('POST', '/game/action', { action: 'startExplore', ...options }); }
    startWorldMarch(options = {}) { return this.request('POST', '/game/action', { action: 'startWorldMarch', ...options }); }
    returnWorldMarch(missionId) { return this.request('POST', '/game/action', { action: 'returnWorldMarch', missionId }); }
    stopWorldMarch(missionId, options = {}) { return this.request('POST', '/game/action', { action: 'stopWorldMarch', missionId, ...options }); }
    claimExplore(missionId) { return this.request('POST', '/game/action', { action: 'claimExplore', missionId }); }
    startConquest(territoryId, expedition = {}) { return this.request('POST', '/game/action', { action: 'startConquest', territoryId, expedition }); }
    claimConquest(territoryId) { return this.request('POST', '/game/action', { action: 'claimConquest', territoryId }); }
    renameCity(territoryId, name) { return this.request('POST', '/game/action', { action: 'renameCity', territoryId, name }); }
    renamePolity(name) { return this.request('POST', '/game/action', { action: 'renamePolity', name }); }
    switchCity(cityId) { return this.request('POST', '/game/action', { action: 'switchCity', cityId }); }
    advanceTutorial(step) { return this.request('POST', '/game/action', { action: 'tutorialAdvance', step }); }
  }

  global.GameAPI = GameAPI;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameAPI;
})(typeof window !== 'undefined' ? window : globalThis);
