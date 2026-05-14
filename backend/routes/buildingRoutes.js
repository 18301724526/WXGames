const BuildingSystem = require('../modules/BuildingSystem');

const buildingSystem = new BuildingSystem();

/**
 * 建筑相关 API 路由
 * @param {object} app - Express app
 * @param {object} deps - 依赖注入 { authMiddleware, getGameState, saveGameState }
 */
function registerBuildingRoutes(app, deps) {
  const { authMiddleware, getGameState, saveGameState } = deps;

  /**
   * GET /api/buildings
   * 获取所有建筑信息（含当前状态、成本、解锁状态）
   */
  app.get('/api/buildings', authMiddleware, (req, res) => {
    const gameState = getGameState(req.playerId);
    if (!gameState) return res.status(404).json({ error: 'Game state not found' });

    const buildings = buildingSystem.getAllBuildingInfo(gameState);
    res.json({ success: true, buildings });
  });

  /**
   * POST /api/buildings/build
   * 建造建筑（替代 /api/game/action 中的 build action）
   */
  app.post('/api/buildings/build', authMiddleware, (req, res) => {
    const { buildingType } = req.body;
    const gameState = getGameState(req.playerId);
    if (!gameState) return res.status(404).json({ error: 'Game state not found' });

    const result = buildingSystem.build(buildingType, gameState);

    if (result.success) {
      saveGameState(gameState);
    }

    res.json(result);
  });

  /**
   * GET /api/buildings/effects
   * 获取当前建筑效果汇总
   */
  app.get('/api/buildings/effects', authMiddleware, (req, res) => {
    const gameState = getGameState(req.playerId);
    if (!gameState) return res.status(404).json({ error: 'Game state not found' });

    const effects = buildingSystem.calculateEffects(gameState);
    res.json({ success: true, effects });
  });
}

module.exports = registerBuildingRoutes;