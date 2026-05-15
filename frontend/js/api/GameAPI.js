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
    build(buildingId) { return this.request('POST', '/game/action', { action: 'build', target: buildingId }); }
    upgrade(buildingId) { return this.request('POST', '/game/action', { action: 'upgrade', target: buildingId }); }
    advanceEra() { return this.request('POST', '/game/action', { action: 'advanceEra' }); }
    advanceTutorial(step) { return this.request('POST', '/game/action', { action: 'tutorialAdvance', step }); }
  }

  global.GameAPI = GameAPI;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameAPI;
})(typeof window !== 'undefined' ? window : globalThis);
