function registerMetricsRoutes(app, { authMiddleware, adminMiddleware, observabilityService }) {
  if (!app) throw new Error('registerMetricsRoutes requires app');
  if (!observabilityService) throw new Error('registerMetricsRoutes requires observabilityService');
  const handlers = [authMiddleware, adminMiddleware].filter(Boolean);

  app.get('/api/metrics', ...handlers, (req, res) => {
    const pathLimit = Number(req.query?.pathLimit || 20);
    const eventLimit = Number(req.query?.eventLimit || 20);
    return res.json({
      success: true,
      metrics: observabilityService.getSnapshot({ pathLimit, eventLimit }),
    });
  });
}

module.exports = registerMetricsRoutes;
