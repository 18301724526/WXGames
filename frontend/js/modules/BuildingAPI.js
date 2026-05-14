/**
 * 建筑 API 封装 - 统一调用后端建筑接口
 * 基于标准浏览器 fetch API
 */
class BuildingAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  _request(method, url, data = {}) {
    return fetch(`${this.baseUrl}${url}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined
    }).then(res => {
      if (!res.ok) {
        return res.json().then(err => {
          throw new Error(err.error || `HTTP ${res.status}`);
        }).catch(() => {
          throw new Error(`HTTP ${res.status}`);
        });
      }
      return res.json();
    });
  }

  /**
   * 获取所有建筑信息（从 /api/game/state 提取）
   * @returns {Promise<{buildings: object}>}
   */
  getAllBuildings() {
    return this._request('GET', '/game/state').then(data => ({
      buildings: data.gameState?.buildings || {}
    }));
  }

  /**
   * 建造建筑
   * @param {string} buildingType 
   * @returns {Promise<{success: boolean, message: string, cost?}>}
   */
  build(buildingType) {
    return this._request('POST', '/game/action', {
      action: 'build',
      target: buildingType
    });
  }

  /**
   * 获取当前建筑效果汇总（从 /api/game/state 提取）
   * @returns {Promise<{effects: object}>}
   */
  getEffects() {
    return this._request('GET', '/game/state').then(data => {
      const gs = data.gameState;
      const buildings = gs?.buildings || {};
      const templeCount = buildings.temple || 0;
      return {
        effects: {
          farmBonus: 1 + (buildings.farm || 0) * 0.5,
          academyBonus: 1 + (buildings.academy || 0) * 0.5,
          offlineEfficiencyBonus: templeCount * 0.05,
          defenseLevel: buildings.barracks || 0
        }
      };
    });
  }
}

// 兼容浏览器全局挂载
if (typeof window !== 'undefined') {
    window.BuildingAPI = BuildingAPI;
}
