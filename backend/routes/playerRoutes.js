function registerPlayerRoutes(app, deps) {
  const { authMiddleware, authService, repository, gameStateService, logService } = deps;

  app.post('/api/player/register', (req, res) => {
    const { deviceId } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ error: 'DEVICE_ID_REQUIRED', message: 'deviceId 必填' });
    }
    const player = authService.registerPlayer(
      deviceId,
      (playerId) => gameStateService.createInitialGameState(playerId),
      (gameState) => repository.save(gameState),
    );
    return res.json(player);
  });

  app.post('/api/player/login', (req, res) => {
    const { deviceId } = req.body || {};
    if (!deviceId) {
      return res.status(400).json({ error: 'DEVICE_ID_REQUIRED', message: 'deviceId 必填' });
    }
    const result = authService.loginPlayer(
      deviceId,
      (playerId) => repository.findByPlayerId(playerId),
      (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
      (gameState) => repository.save(gameState),
    );
    if (result.error) {
      return res.status(404).json({ error: result.error, message: result.error });
    }
    const gameState = gameStateService.getClientGameState(result.gameState);
    return res.json({
      playerId: result.playerId,
      token: result.token,
      gameState,
      tutorial: result.gameState.tutorial,
      offlineIncome: result.offlineIncome,
    });
  });

  app.post('/api/player/reset', authMiddleware, (req, res) => {
    res.json(authService.resetPlayer(req.playerId));
  });

  app.get('/api/player/logs', authMiddleware, (req, res) => {
    try {
      const rows = logService.getPlayerLogs(req.playerId, 20);
      res.json({ success: true, logs: rows });
    } catch (error) {
      res.status(500).json({ error: 'QUERY_FAILED', message: error.message });
    }
  });
}

module.exports = registerPlayerRoutes;
