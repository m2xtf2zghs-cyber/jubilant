const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.BACKEND_ENV_FILE || path.resolve(process.cwd(), '.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/yash_portfolio'),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  corsAllowNetlifyPreviews: String(process.env.CORS_ALLOW_NETLIFY_PREVIEWS || 'true').trim().toLowerCase() !== 'false',
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'change-me-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'change-me-refresh-secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
};

module.exports = { config };
