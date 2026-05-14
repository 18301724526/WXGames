/**
 * 建筑管理器 - 前端建筑状态管理与交互逻辑
 * 职责：准备建造请求、更新本地状态、协调渲染
 * 不碰计算逻辑，全部交给后端
 */
class BuildingManager {
  constructor(buildingAPI, buildingConfig) {
    this.api = buildingAPI;
    this.config = buildingConfig;
    this.state = null; // 当前游戏状态
  }

  /**
   * 初始化
   * @param {object} gameState - 当前游戏状态
   */
  init(gameState) {
    this.state = gameState;
  }

  /**
   * 更新本地状态
   * @param {object} gameState 
   */
  updateState(gameState) {
    this.state = gameState;
  }

  /**
   * 获取所有建筑的展示信息
   * @returns {BuildingDisplayInfo[]}
   */
  getAllBuildingDisplays() {
    if (!this.state) return [];

    return Object.values(this.config.buildings).map(config => {
      const currentCount = this.state.buildings[config.id] || 0;
      const cost = this.state.buildingCosts?.[config.id] || config.cost;
      const canAfford = this.checkCanAfford(cost);
      const isUnlocked = this.state.currentEra >= config.unlockEra;

      return {
        id: config.id,
        name: config.name,
        description: config.ui?.description || config.description || '',
        icon: config.ui?.icon || '',
        color: config.ui?.color || '',
        category: config.category,
        currentCount,
        cost,
        canAfford,
        isUnlocked,
        unlockEra: config.unlockEra,
        effects: config.effects?.perBuilding || {}
      };
    });
  }

  /**
   * 发起建造请求
   * @param {string} buildingId 
   * @returns {Promise<object>}
   */
  async build(buildingId) {
    // 前端只做预估显示，不执行真实校验；权威校验在后端
    const result = await this.api.build(buildingId);
    return result;
  }

  /**
   * 获取建筑提示信息
   * @param {string} buildingId 
   * @returns {object}
   */
  getTooltipInfo(buildingId) {
    if (!this.state) return null;

    const config = this.config.buildings[buildingId];
    if (!config) return null;

    const currentCount = this.state.buildings[buildingId] || 0;
    const cost = this.state.buildingCosts?.[config.id] || config.cost;
    const canAfford = this.checkCanAfford(cost);
    const isUnlocked = this.state.currentEra >= config.unlockEra;

    return {
      title: config.name,
      description: config.ui?.description || config.description || '',
      icon: config.ui?.icon || '',
      currentCount,
      nextCost: cost,
      canAfford,
      isUnlocked,
      unlockRequirement: config.unlockEra > 0
        ? `需要时代: ${this.getEraName(config.unlockEra)}`
        : null,
      effects: config.effects?.perBuilding || {}
    };
  }

  // ===== 私有辅助方法 =====

  checkCanAfford(cost) {
    if (!this.state || !this.state.resources) return false;
    for (const [resource, amount] of Object.entries(cost)) {
      if ((this.state.resources[resource] || 0) < amount) return false;
    }
    return true;
  }

  getEraName(eraIndex) {
    const names = ['原始', '农耕', '青铜', '古典', '中世纪', '文艺复兴', '工业'];
    return names[eraIndex] || `时代${eraIndex}`;
  }
}

// 兼容浏览器全局挂载
if (typeof window !== 'undefined') {
    window.BuildingManager = BuildingManager;
}
