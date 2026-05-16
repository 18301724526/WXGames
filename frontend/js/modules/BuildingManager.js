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
    const buildings = this.state.buildings || {};

    return Object.values(this.config.buildings || this.config)
      .filter(config => config && config.id && config.name)
      .map(config => {
        const currentCount = buildings[config.id] || 0;
        const cost = this.state.buildingCosts?.[config.id];
        const isUnlocked = (this.state.era || 0) >= config.unlockEra;

        return {
          id: config.id,
          name: config.name,
          description: config.ui?.description || config.description || '',
          icon: config.ui?.icon || '',
          color: config.ui?.color || '',
          category: config.category,
          currentCount,
          cost,
          isUnlocked,
          unlockEra: config.unlockEra,
          effects: config.effects?.perBuilding || {}
        };
      });
  }
getTooltipInfo(buildingId) {
    if (!this.state) return null;
    const buildings = this.state.buildings || {};

    const config = this.config.buildings[buildingId];
    if (!config) return null;

    const currentCount = buildings[buildingId] || 0;
    const cost = this.state.buildingCosts?.[config.id];
    const isUnlocked = (this.state.era || 0) >= config.unlockEra;

    return {
      title: config.name,
      description: config.ui?.description || config.description || '',
      icon: config.ui?.icon || '',
      currentCount,
      nextCost: cost,
      isUnlocked,
      unlockRequirement: config.unlockEra > 0
        ? `需要时代: ${this.getEraName(config.unlockEra)}`
        : null,
      effects: config.effects?.perBuilding || {}
    };
  }

  // ===== 私有辅助方法 =====

  getEraName(eraIndex) {
    const names = ['原始', '农耕', '聚落', '城邦', '古典', '中世纪', '帝国'];
    return names[eraIndex] || `时代${eraIndex}`;
  }
}

// 兼容浏览器全局挂载
if (typeof window !== 'undefined') {
    window.BuildingManager = BuildingManager;
}
