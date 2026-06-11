function registerPlayerRoutes(app, deps) {
  const { authMiddleware, authService, repository, gameStateService, logService } = deps;

  app.post('/api/player/register', (req, res) => {
    return res.status(403).json({
      error: 'REGISTER_DISABLED',
      message: '当前版本仅开放白名单账号登录，不开放注册',
    });
  });

  app.post('/api/player/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'CREDENTIALS_REQUIRED', message: '用户名和密码必填' });
    }
    const result = authService.loginPlayer(
      username,
      password,
      (playerId) => repository.findByPlayerId(playerId),
      (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
      (gameState) => repository.save(gameState),
      (playerId) => gameStateService.createInitialGameState(playerId),
    );
    if (result.error) {
      return res.status(403).json({ error: result.error, message: result.message || result.error });
    }
    const normalized = gameStateService.normalizeState
      ? gameStateService.normalizeState(result.gameState)
      : result.gameState;
    const gameState = gameStateService.getClientGameStateFromNormalized
      ? gameStateService.getClientGameStateFromNormalized(normalized)
      : gameStateService.getClientGameState(normalized);
    const eraProgress = gameStateService.calculateEraProgressFromNormalized
      ? gameStateService.calculateEraProgressFromNormalized(normalized)
      : gameStateService.calculateEraProgress(normalized);
    return res.json({
      playerId: result.playerId,
      username: result.username,
      token: result.token,
      gameState,
      tutorial: normalized.tutorial,
      eraProgress,
      offlineIncome: result.offlineIncome,
    });
  });

  app.post('/api/player/reset', authMiddleware, (req, res) => {
    const result = authService.resetPlayer(
      req.playerId,
      (playerId) => gameStateService.createInitialGameState(playerId),
      (gameState) => repository.save(gameState),
      (playerId, gameState) => repository.resetPlayerState(playerId, gameState),
    );
    const gameState = result.gameState;
    const clientState = gameStateService.getClientGameStateFromNormalized
      ? gameStateService.getClientGameStateFromNormalized(gameState)
      : gameStateService.getClientGameState(gameState);
    const eraProgress = gameStateService.calculateEraProgressFromNormalized
      ? gameStateService.calculateEraProgressFromNormalized(gameState)
      : gameStateService.calculateEraProgress(gameState);
    return res.json({
      ...result,
      gameState: clientState,
      tutorial: gameState.tutorial,
      eraProgress,
    });
  });

  app.get('/api/player/whitelist', (req, res) => {
    res.json({
      success: true,
      accounts: authService.getAllowedUsernames(),
      registerEnabled: false,
      message: '当前版本仅开放白名单账号登录',
    });
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
