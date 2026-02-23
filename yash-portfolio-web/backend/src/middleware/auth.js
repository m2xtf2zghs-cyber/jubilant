const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { ApiError } = require('../utils/http');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      orgId: user.organization_id,
      role: user.role,
      email: user.email,
      type: 'access',
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      orgId: user.organization_id,
      role: user.role,
      email: user.email,
      type: 'refresh',
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret);
  if (!payload || payload.type !== 'refresh') {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }
  return payload;
}

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header'));
  }
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    if (!payload || payload.type !== 'access') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid access token');
    }
    const headerOrgId = req.headers['x-org-id'];
    if (headerOrgId && headerOrgId !== payload.orgId) {
      throw new ApiError(403, 'ORG_MISMATCH', 'X-Org-Id does not match access token organization');
    }
    req.auth = payload;
    req.orgId = payload.orgId;
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Access token expired or invalid'));
  }
}

function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.auth) return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
    if (!roles.includes(req.auth.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'Insufficient role permissions'));
    }
    return next();
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  requireRoles,
};
