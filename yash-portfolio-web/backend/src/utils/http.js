class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || undefined;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const payload = {
    error: {
      code,
      message: err.message || 'Unexpected error',
    },
  };
  if (err.details) payload.error.details = err.details;
  if (status >= 500 && process.env.NODE_ENV !== 'production') {
    payload.error.stack = err.stack;
  }
  res.status(status).json(payload);
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset, limit: pageSize };
}

function parseBool(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(v)) return true;
  if (['0', 'false', 'no', 'n'].includes(v)) return false;
  return undefined;
}

function pick(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

module.exports = {
  ApiError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
  parsePagination,
  parseBool,
  pick,
};
