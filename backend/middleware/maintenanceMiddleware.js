const DEFAULT_BLOCKED_PREFIXES = Object.freeze([
  '/api/game',
  '/api/buildings',
]);

const DEFAULT_BLOCKED_PATHS = Object.freeze([
  '/api/player/login',
  '/api/player/register',
  '/api/player/reset',
]);

function createMaintenanceMiddleware(options = {}) {
  const opsControlService = options.opsControlService;
  const blockedPrefixes = options.blockedPrefixes || DEFAULT_BLOCKED_PREFIXES;
  const blockedPaths = new Set(options.blockedPaths || DEFAULT_BLOCKED_PATHS);

  if (!opsControlService || typeof opsControlService.getMaintenanceState !== 'function') {
    throw new Error('createMaintenanceMiddleware requires opsControlService');
  }

  return (req, res, next) => {
    const path = req.path || req.url || '';
    const shouldCheck = blockedPaths.has(path)
      || blockedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (!shouldCheck) return next();

    const maintenance = opsControlService.getMaintenanceState();
    if (!maintenance.enabled) return next();

    res.set('Retry-After', '120');
    return res.status(503).json({
      error: 'MAINTENANCE_MODE',
      message: maintenance.message || '服务器正在维护，请稍后再试。',
      maintenance: {
        enabled: true,
        reason: maintenance.reason,
        message: maintenance.message,
        startedAt: maintenance.startedAt,
        updatedAt: maintenance.updatedAt,
      },
    });
  };
}

module.exports = createMaintenanceMiddleware;
