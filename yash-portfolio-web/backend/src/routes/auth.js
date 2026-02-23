const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ApiError, asyncHandler } = require('../utils/http');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const organizationCode = body.organizationCode ? String(body.organizationCode).trim().toLowerCase() : null;
  const device = body.device && typeof body.device === 'object' ? body.device : null;

  if (!email || !password) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Email and password are required', { fields: ['email', 'password'] });
  }

  const userRows = await query(
    `
    select
      u.id,
      u.organization_id,
      u.email,
      u.full_name,
      u.password_hash,
      u.role,
      u.is_active,
      o.code as organization_code,
      o.name as organization_name
    from users u
    join organizations o on o.id = u.organization_id
    where lower(u.email) = $1
      and ($2::text is null or lower(o.code) = $2)
    order by u.created_at asc
    `,
    [email, organizationCode]
  );

  if (!userRows.rows.length) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (userRows.rows.length > 1 && !organizationCode) {
    throw new ApiError(409, 'ORG_CODE_REQUIRED', 'Multiple organizations found for this email. Send organizationCode.');
  }

  const user = userRows.rows[0];
  if (!user.is_active) throw new ApiError(403, 'USER_DISABLED', 'User is inactive');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  await query('update users set last_login_at = now(), updated_at = now() where id = $1', [user.id]);

  let deviceId = null;
  if (device) {
    const inserted = await query(
      `
      insert into devices (organization_id, user_id, device_label, platform, app_version, last_sync_at)
      values ($1, $2, $3, $4, $5, null)
      returning id
      `,
      [
        user.organization_id,
        user.id,
        String(device.deviceLabel || 'Unknown Device').slice(0, 120),
        String(device.platform || 'WEB').toUpperCase() === 'ANDROID' ? 'ANDROID' : 'WEB',
        device.appVersion ? String(device.appVersion).slice(0, 40) : null,
      ]
    );
    deviceId = inserted.rows[0]?.id || null;
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      deviceId,
    },
    organization: {
      id: user.organization_id,
      code: user.organization_code,
      name: user.organization_name,
    },
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = String((req.body || {}).refreshToken || '');
  if (!token) throw new ApiError(422, 'VALIDATION_ERROR', 'refreshToken is required');

  const payload = verifyRefreshToken(token);
  const result = await query(
    `select id, organization_id, email, full_name, role, is_active from users where id = $1`,
    [payload.sub]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'User not found or inactive');

  res.json({
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  });
}));

router.post('/logout', asyncHandler(async (_req, res) => {
  res.status(204).send();
}));

module.exports = router;
