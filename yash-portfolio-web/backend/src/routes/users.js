const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ApiError, asyncHandler } = require('../utils/http');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_ROLES = new Set(['OWNER', 'ACCOUNTS_OFFICER', 'COLLECTION_AGENT', 'AUDITOR', 'VIEWER']);

router.get('/', requireRoles('OWNER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const rows = await query(
    `
    select id, email, full_name, role, is_active, phone, last_login_at, created_at, updated_at
    from users
    where organization_id = $1
    order by created_at asc
    `,
    [orgId]
  );
  res.json({ items: rows.rows });
}));

router.post('/', requireRoles('OWNER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const actorUserId = req.auth.sub;
  const body = req.body || {};

  const email = String(body.email || '').trim().toLowerCase();
  const fullName = String(body.fullName || '').trim();
  const password = String(body.password || '');
  const role = String(body.role || 'COLLECTION_AGENT').trim().toUpperCase();
  const phone = body.phone == null ? null : String(body.phone).trim() || null;

  if (!email || !fullName || !password) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'email, fullName, password are required');
  }
  if (password.length < 4) throw new ApiError(422, 'VALIDATION_ERROR', 'Password must be at least 4 characters');
  if (!ALLOWED_ROLES.has(role)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid role');

  const exists = await query(
    `select id from users where organization_id = $1 and lower(email) = $2`,
    [orgId, email]
  );
  if (exists.rows[0]) throw new ApiError(409, 'EMAIL_EXISTS', 'User email already exists in this organization');

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await query(
    `
    insert into users (organization_id, email, full_name, password_hash, role, is_active, phone)
    values ($1,$2,$3,$4,$5,true,$6)
    returning id, email, full_name, role, is_active, phone, created_at, updated_at
    `,
    [orgId, email, fullName, passwordHash, role, phone]
  );

  const user = created.rows[0];
  await query(
    `
    insert into audit_logs (organization_id, actor_user_id, entity_type, entity_id, action, metadata)
    values ($1,$2,'user',$3,'CREATE_USER',$4::jsonb)
    `,
    [orgId, actorUserId, user.id, JSON.stringify({ email, role })]
  );

  res.status(201).json({ item: user });
}));

module.exports = router;
