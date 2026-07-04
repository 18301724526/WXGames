function registerPlayerRoutes(app, deps) {
  const {
    authMiddleware,
    authService,
    repository,
    gameStateService,
    logService,
    spawnLifecycleService,
  } = deps;

  function createInitialStateForPlayer(playerId) {
    return spawnLifecycleService?.createInitialStateForPlayer
      ? spawnLifecycleService.createInitialStateForPlayer(playerId)
      : gameStateService.createInitialGameState(playerId);
  }

  function createResetStateForPlayer(playerId) {
    return spawnLifecycleService?.resetInitialStateForPlayer
      ? spawnLifecycleService.resetInitialStateForPlayer(playerId)
      : createInitialStateForPlayer(playerId);
  }

  function loadProjection(playerId) {
    return repository.getClientProjectionForPlayer?.(playerId) || {};
  }

  function isGameStateRevisionConflict(error = {}) {
    return error?.code === 'GAME_STATE_REVISION_CONFLICT';
  }

  function buildRevisionConflictPayload(error = {}) {
    return {
      success: false,
      error: 'GAME_STATE_REVISION_CONFLICT',
      message: '游戏状态已更新，请重试',
      retryable: true,
      expectedRevision: error.expectedRevision ?? null,
      actualRevision: error.actualRevision ?? null,
    };
  }

  function loginPlayerWithRevisionRetry(username, password) {
    const loginOnce = () => authService.loginPlayer(
      username,
      password,
      (playerId) => repository.findByPlayerId(playerId),
      (gameState, offlineSeconds) => gameStateService.calculateOfflineIncome(gameState, offlineSeconds),
      (gameState) => repository.save(gameState),
      createInitialStateForPlayer,
    );
    try {
      return { result: loginOnce(), retried: false };
    } catch (error) {
      if (!isGameStateRevisionConflict(error)) throw error;
      try {
        return { result: loginOnce(), retried: true };
      } catch (retryError) {
        if (!isGameStateRevisionConflict(retryError)) throw retryError;
        return { conflictPayload: buildRevisionConflictPayload(retryError) };
      }
    }
  }

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
    const loginAttempt = loginPlayerWithRevisionRetry(username, password);
    if (loginAttempt.conflictPayload) {
      return res.status(409).json(loginAttempt.conflictPayload);
    }
    const { result } = loginAttempt;
    if (result.error) {
      return res.status(403).json({ error: result.error, message: result.message || result.error });
    }
    const normalized = gameStateService.normalizeState
      ? gameStateService.normalizeState(result.gameState)
      : result.gameState;
    const projection = loadProjection(result.playerId);
    const gameState = gameStateService.getClientGameStateFromNormalized
      ? gameStateService.getClientGameStateFromNormalized(normalized, projection)
      : gameStateService.getClientGameState(normalized, projection);
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
      createResetStateForPlayer,
      (gameState) => repository.save(gameState),
      (playerId, gameState) => repository.resetPlayerState(playerId, gameState),
    );
    const gameState = result.gameState;
    const projection = loadProjection(req.playerId);
    const clientState = gameStateService.getClientGameStateFromNormalized
      ? gameStateService.getClientGameStateFromNormalized(gameState, projection)
      : gameStateService.getClientGameState(gameState, projection);
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
