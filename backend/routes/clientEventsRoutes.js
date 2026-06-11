const ALLOWED_CLIENT_EVENT_TYPES = new Set([
  'frontend_load_failure',
  'frontend_asset_failure',
]);

function readHeader(req, name) {
  const lowerName = String(name || '').toLowerCase();
  return req?.get?.(name) || req?.headers?.[lowerName] || '';
}

function registerClientEventsRoutes(app, { observabilityService }) {
  if (!app) throw new Error('registerClientEventsRoutes requires app');
  if (!observabilityService) throw new Error('registerClientEventsRoutes requires observabilityService');

  app.post('/api/client-events', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const type = String(body.type || '').trim();
    if (!ALLOWED_CLIENT_EVENT_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        error: 'CLIENT_EVENT_TYPE_UNSUPPORTED',
        message: 'Unsupported client event type',
      });
    }

    const event = observabilityService.recordClientEvent({
      ...body,
      type,
      userAgent: body.userAgent || readHeader(req, 'user-agent'),
    });
    return res.status(202).json({
      success: true,
      accepted: true,
      event: {
        at: event.at,
        type: event.type,
      },
    });
  });
}

module.exports = registerClientEventsRoutes;
