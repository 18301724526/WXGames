/**
 * 建筑 API 封装 - 统一调用后端建筑接口
 * 基于微信小程序 wx.request
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
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.baseUrl}${url}`,
        method,
        header: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        data,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
          }
        },
        fail: reject
      });
    });
  }

  /**
   * 获取所有建筑信息
   * @returns {Promise<{buildings: BuildingInfo[]}>}
   */
  getAllBuildings() {
    return this._request('GET', '/api/buildings');
  }

  /**
   * 建造建筑
   * @param {string} buildingType 
   * @returns {Promise<{success: boolean, message: string, cost?}>}
   */
  build(buildingType) {
    return this._request('POST', '/api/buildings/build', { buildingType });
  }

  /**
   * 获取当前建筑效果汇总
   * @returns {Promise<{effects: object}>}
   */
  getEffects() {
    return this._request('GET', '/api/buildings/effects');
  }
}

// 兼容浏览器全局挂载
if (typeof window !== 'undefined') {
    window.BuildingAPI = BuildingAPI;
}
