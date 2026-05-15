function createAuthMiddleware(authService) {
  return (req, res, next) => authService.authMiddleware(req, res, next);
}

module.exports = createAuthMiddleware;
