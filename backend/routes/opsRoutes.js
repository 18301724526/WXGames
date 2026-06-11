function parseBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function registerOpsRoutes(app, deps = {}) {
  if (!app) throw new Error('registerOpsRoutes requires app');
  const { authMiddleware, adminMiddleware, opsControlService } = deps;
  if (!opsControlService) throw new Error('registerOpsRoutes requires opsControlService');

  const handlers = [authMiddleware, adminMiddleware].filter(Boolean);
  const getOperator = (req) => req.adminUser || req.username || req.playerId || 'admin';

  app.get('/api/admin/ops/dashboard', ...handlers, (req, res) => {
    const dashboard = opsControlService.getDashboard({
      includeLogs: parseBoolean(req.query?.includeLogs),
      logLines: req.query?.logLines,
    });
    return res.json(dashboard);
  });

  app.get('/api/admin/ops/maintenance', ...handlers, (req, res) => res.json({
    success: true,
    maintenance: opsControlService.getMaintenanceState(),
  }));

  app.post('/api/admin/ops/maintenance', ...handlers, (req, res) => {
    const result = opsControlService.setMaintenanceState(req.body || {}, {
      operator: getOperator(req),
    });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/ops/restart', ...handlers, (req, res) => {
    const operator = getOperator(req);
    const delayMs = Math.max(250, Math.min(5000, Number(req.body?.delayMs) || 900));
    if (typeof opsControlService.appendAudit === 'function') {
      opsControlService.appendAudit({
        action: 'pm2:restart:accepted',
        operator,
        detail: { delayMs },
      });
    }
    setTimeout(() => {
      try {
        opsControlService.restartService({ operator });
      } catch (error) {
        try {
          opsControlService.appendAudit({
            action: 'pm2:restart:failed',
            operator,
            detail: { error: error.message },
          });
        } catch (_) {}
      }
    }, delayMs).unref?.();
    return res.status(202).json({
      success: true,
      accepted: true,
      action: 'pm2:restart',
      delayMs,
      message: 'Restart accepted. The API may be briefly unavailable.',
    });
  });
}

module.exports = registerOpsRoutes;
