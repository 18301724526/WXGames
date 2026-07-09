const TaskDefinitionService = require('../services/TaskDefinitionService');
const ConfigReleaseService = require('../services/config/ConfigReleaseService');
const ConfigRuntimeLoader = require('../services/config/ConfigRuntimeLoader');
const { prepareCommandEntry, sendCommandEntryError } = require('../application/commands/CommandEntryContext');

function registerAdminRoutes(app, deps) {
  const { authMiddleware, adminMiddleware } = deps;
  const configReleaseService = deps.configReleaseService || ConfigReleaseService;
  const configRuntimeLoader = deps.configRuntimeLoader || ConfigRuntimeLoader;
  const commandEntryReporter = deps.commandEntryReporter;
  const requireAdmin = adminMiddleware || ((req, res, next) => next());
  const adminHandlers = [authMiddleware, requireAdmin];
  const getOperator = (req) => req.adminUser || req.username || req.playerId;
  const taskDefinitionErrorStatus = (error) => (
    error?.code === 'TASK_DEFINITIONS_RUNTIME_NOT_READY' ? 503 : 500
  );
  const sendTaskDefinitionError = (res, error) => res.status(taskDefinitionErrorStatus(error)).json({
    success: false,
    error: error?.code || 'TASK_DEFINITIONS_RUNTIME_ERROR',
    message: error?.message || '任务定义运行时不可用',
  });

  app.get('/api/admin/task-definitions', ...adminHandlers, (req, res) => {
    try {
      const definitions = TaskDefinitionService.loadDefinitions();
      return res.json({ success: true, definitions });
    } catch (error) {
      return sendTaskDefinitionError(res, error);
    }
  });

  app.post('/api/admin/task-definitions/preview', ...adminHandlers, (req, res) => {
    const result = TaskDefinitionService.previewImport(req.body || {}, { importedBy: getOperator(req) });
    const statusCode = result.success
      ? 200
      : (result.error === 'TASK_DEFINITIONS_RUNTIME_NOT_READY' ? 503 : 400);
    return res.status(statusCode).json(result);
  });

  app.get('/api/admin/task-definitions/template.xlsx', ...adminHandlers, (req, res) => {
    try {
      const buffer = TaskDefinitionService.buildTemplateWorkbookBuffer();
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', 'attachment; filename="task-definitions-template.xlsx"');
      return res.send(buffer);
    } catch (error) {
      return sendTaskDefinitionError(res, error);
    }
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
    const commandEntry = prepareCommandEntry(req, {
      type: 'configReleasePublish',
      inventoryId: 'admin:config-release-publish',
      reporter: commandEntryReporter,
    });
    if (!commandEntry.ok) return sendCommandEntryError(res, commandEntry);
    const result = configReleaseService.publishRelease(req.body || {}, { operator: getOperator(req) });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/config-releases/rollback', ...adminHandlers, (req, res) => {
    const commandEntry = prepareCommandEntry(req, {
      type: 'configReleaseRollback',
      inventoryId: 'admin:config-release-rollback',
      reporter: commandEntryReporter,
    });
    if (!commandEntry.ok) return sendCommandEntryError(res, commandEntry);
    const result = configReleaseService.rollbackRelease(req.body?.releaseId, { operator: getOperator(req) });
    return res.status(result.success ? 200 : 404).json(result);
  });
}

module.exports = registerAdminRoutes;
