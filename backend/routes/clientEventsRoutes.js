const ALLOWED_CLIENT_EVENT_TYPES = new Set([
  'frontend_load_failure',
  'frontend_asset_failure',
]);

function readHeader(req, name) {
  const lowerName = String(name || '').toLowerCase();
  return req?.get?.(name) || req?.headers?.[lowerName] || '';
}

function parsePayload(row = {}) {
  try {
    return JSON.parse(row.payload || '{}');
  } catch (_) {
    return { schema: 'client-operation-log-v1', entries: [] };
  }
}

function parseLimit(value, fallback = 5) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(20, number));
}

function registerClientEventsRoutes(app, { authMiddleware = null, logService = null, observabilityService }) {
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

  if (authMiddleware && logService) {
    app.post('/api/client-operation-logs', authMiddleware, (req, res) => {
      try {
        const snapshot = req.body && typeof req.body === 'object' ? req.body : {};
        const saved = logService.logClientOperationSnapshot(
          req.playerId,
          req.deviceId,
          {
            ...snapshot,
            requestId: snapshot.requestId || readHeader(req, 'X-Client-Request-ID'),
          },
        );
        return res.status(202).json({
          success: true,
          accepted: true,
          logId: saved.id,
          entryCount: saved.entryCount,
          timestamp: saved.timestamp,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'CLIENT_OPERATION_LOG_SAVE_FAILED',
          message: error.message,
        });
      }
    });

    app.get('/api/client-operation-logs', authMiddleware, (req, res) => {
      try {
        const rows = logService.getPlayerClientOperationLogs(req.playerId, parseLimit(req.query?.limit));
        return res.json({
          success: true,
          logs: rows.map((row) => ({
            id: row.id,
            reason: row.reason,
            entryCount: row.entryCount,
            timestamp: row.timestamp,
            payload: parsePayload(row),
          })),
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'CLIENT_OPERATION_LOG_QUERY_FAILED',
          message: error.message,
        });
      }
    });
  }
}

module.exports = registerClientEventsRoutes;
