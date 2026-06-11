const DEFAULT_DEV_ADMIN_USERS = Object.freeze(['codexqa']);

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function parseUserList(value) {
  if (Array.isArray(value)) return value.map(normalizeUsername).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(normalizeUsername)
    .filter(Boolean);
}

function createAdminMiddleware(options = {}) {
  const env = options.env || process.env.NODE_ENV || 'development';
  const configuredUsers = parseUserList(options.adminUsers ?? process.env.ADMIN_USERS);
  const allowDevDefault = options.allowDevDefault !== undefined
    ? Boolean(options.allowDevDefault)
    : env !== 'production';
  const adminUsers = new Set(configuredUsers.length
    ? configuredUsers
    : (allowDevDefault ? DEFAULT_DEV_ADMIN_USERS : []));

  return (req, res, next) => {
    const username = normalizeUsername(req.username || req.playerId);
    if (!username || !adminUsers.has(username)) {
      return res.status(403).json({
        error: 'AdminForbidden',
        message: 'Admin role required',
      });
    }
    req.adminUser = username;
    return next();
  };
}

module.exports = createAdminMiddleware;
module.exports.parseUserList = parseUserList;
