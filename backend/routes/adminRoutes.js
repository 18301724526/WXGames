const TaskDefinitionService = require('../services/TaskDefinitionService');

function registerAdminRoutes(app, deps) {
  const { authMiddleware } = deps;

  app.get('/api/admin/task-definitions', authMiddleware, (req, res) => {
    const definitions = TaskDefinitionService.loadDefinitions();
    return res.json({ success: true, definitions });
  });

  app.post('/api/admin/task-definitions/preview', authMiddleware, (req, res) => {
    const result = TaskDefinitionService.previewImport(req.body || {}, { importedBy: req.username || req.playerId });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/admin/task-definitions/import', authMiddleware, (req, res) => {
    const result = TaskDefinitionService.importDefinitions(req.body || {}, { importedBy: req.username || req.playerId });
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.get('/api/admin/task-definitions/template.xlsx', authMiddleware, (req, res) => {
    const buffer = TaskDefinitionService.buildTemplateWorkbookBuffer();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="task-definitions-template.xlsx"');
    return res.send(buffer);
  });
}

module.exports = registerAdminRoutes;
