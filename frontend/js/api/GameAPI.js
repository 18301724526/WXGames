(function (global) {
  class GameAPI {
    constructor(baseUrl, token) {
      this.baseUrl = baseUrl;
      this.token = token || null;
    }

    setToken(token) {
      this.token = token;
    }

    async request(method, path, body) {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        error.payload = data;
        throw error;
      }
      return data;
    }

    getState() { return this.request('GET', '/game/state'); }
    getVersion() { return this.request('GET', '/version'); }
    build(buildingId) { return this.request('POST', '/game/action', { action: 'build', target: buildingId }); }
    upgrade(buildingId) { return this.request('POST', '/game/action', { action: 'upgrade', target: buildingId }); }
    advanceEra() { return this.request('POST', '/game/action', { action: 'advanceEra' }); }
    claimEvent(eventId, optionId) { return this.request('POST', '/game/action', { action: 'claimEvent', eventId, optionId }); }
    scoutTerritory(territoryId) { return this.request('POST', '/game/action', { action: 'scoutTerritory', territoryId }); }
    startConquest(territoryId, soldiers) { return this.request('POST', '/game/action', { action: 'startConquest', territoryId, soldiers }); }
    claimConquest(territoryId) { return this.request('POST', '/game/action', { action: 'claimConquest', territoryId }); }
    renameCity(territoryId, name) { return this.request('POST', '/game/action', { action: 'renameCity', territoryId, name }); }
    renamePolity(name) { return this.request('POST', '/game/action', { action: 'renamePolity', name }); }
    advanceTutorial(step) { return this.request('POST', '/game/action', { action: 'tutorialAdvance', step }); }
  }

  global.GameAPI = GameAPI;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameAPI;
})(typeof window !== 'undefined' ? window : globalThis);
