const TaskDefinitionService = require('../services/TaskDefinitionService');
const ConfigReleaseService = require('../services/config/ConfigReleaseService');
const ConfigRuntimeLoader = require('../services/config/ConfigRuntimeLoader');

function registerAdminRoutes(app, deps) {
  const { authMiddleware, adminMiddleware } = deps;
  const configReleaseService = deps.configReleaseService || ConfigReleaseService;
  const configRuntimeLoader = deps.configRuntimeLoader || ConfigRuntimeLoader;
  const requireAdmin = adminMiddleware || ((req, res, next) => next());
  const adminHandlers = [authMiddleware, requireAdmin];
  const getOperator = (req) => req.adminUser || req.username || req.playerId;

  app.get('/api/admin/task-definitions', ...adminHandlers, (req, res) => {
    const definitions = TaskDefinitionService.loadDefinitions();
    return res.json({ success: true, definitions });
  });

  app.get('/api/admin/task-definitions/history', ...adminHandlers, (req, res) => {
    const history = TaskDefinitionService.getImportHistory({ limit: req.query?.limit });
    return res.json({ success: true, history });
  });

  app.post('/api/admin/task-definitions/preview', ...adminHandlers, (req, res) => {
    const result = TaskDefinitionService.previewImport(req.body || {}, { importedBy: getOperator(req) });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/task-definitions/import', ...adminHandlers, (req, res) => {
    const result = TaskDefinitionService.importDefinitions(req.body || {}, { importedBy: getOperator(req) });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/task-definitions/rollback', ...adminHandlers, (req, res) => {
    const result = TaskDefinitionService.rollbackImport(req.body?.importId, { importedBy: getOperator(req) });
    return res.status(result.success ? 200 : 404).json(result);
  });

  app.get('/api/admin/task-definitions/template.xlsx', ...adminHandlers, (req, res) => {
    const buffer = TaskDefinitionService.buildTemplateWorkbookBuffer();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="task-definitions-template.xlsx"');
    return res.send(buffer);
  });

  app.get('/api/admin/config-releases', ...adminHandlers, (req, res) => {
    const history = configReleaseService.loadReleaseHistory({
      limit: req.query?.limit,
      includeSnapshot: req.query?.includeSnapshot === 'true',
      includeReport: req.query?.includeReport === 'true',
    });
    return res.json({ success: true, history });
  });

  app.get('/api/admin/config-releases/active', ...adminHandlers, (req, res) => {
    const activeRelease = configReleaseService.getActiveRelease({
      includeSnapshot: req.query?.includeSnapshot === 'true',
      includeReport: req.query?.includeReport === 'true',
    });
    return res.json({ success: true, activeRelease });
  });

  app.get('/api/admin/config-releases/runtime-status', ...adminHandlers, (req, res) => {
    const runtimeStatus = configReleaseService.getRuntimeStatus();
    const loaderStatus = configRuntimeLoader.getRuntimeLoaderStatus();
    return res.json({
      success: runtimeStatus.success !== false && loaderStatus.success !== false,
      runtimeStatus,
      loaderStatus,
    });
  });

  app.post('/api/admin/config-releases/preview', ...adminHandlers, (req, res) => {
    const result = configReleaseService.previewRelease(req.body || {}, { operator: getOperator(req) });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/config-releases/publish', ...adminHandlers, (req, res) => {
    const result = configReleaseService.publishRelease(req.body || {}, { operator: getOperator(req) });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/config-releases/rollback', ...adminHandlers, (req, res) => {
    const result = configReleaseService.rollbackRelease(req.body?.releaseId, { operator: getOperator(req) });
    return res.status(result.success ? 200 : 404).json(result);
  });
}

module.exports = registerAdminRoutes;
