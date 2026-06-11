function registerVersionRoutes(app, { versionService }) {
  if (!app) throw new Error('registerVersionRoutes requires app');
  if (!versionService) throw new Error('registerVersionRoutes requires versionService');

  app.get('/api/version', (req, res) => {
    const versionInfo = versionService.getVersionInfo();
    res.set('Cache-Control', 'private, max-age=5, must-revalidate');
    res.set('ETag', versionInfo.etag);
    if (versionService.matchesEtag(req.headers?.['if-none-match'], versionInfo)) {
      return res.status(304).send();
    }
    return res.json(versionInfo);
  });
}

module.exports = registerVersionRoutes;
