const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

dotenv.config({ path: process.env.BACKEND_ENV_FILE || path.resolve(process.cwd(), '.env') });

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : (process.env[name.toUpperCase()] || fallback);
}

function must(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

function getSslConfig(connectionString) {
  if (!connectionString) return undefined;
  try {
    const u = new URL(connectionString);
    const host = String(u.hostname || '');
    const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
    if (sslmode === 'require' || host.endsWith('.render.com')) {
      return { rejectUnauthorized: false };
    }
  } catch (_) {
    // ignore URL parse errors and fall back to plain connection
  }
  return undefined;
}

(async () => {
  const databaseUrl = must('DATABASE_URL', process.env.DATABASE_URL);
  const orgCode = String(getArg('orgCode', 'yash-finance')).trim().toLowerCase();
  const orgName = String(getArg('orgName', 'Yash Finance')).trim();
  const adminEmail = String(getArg('adminEmail', 'admin@yashfinance.local')).trim().toLowerCase();
  const adminPassword = String(getArg('adminPassword', 'change-me-now')).trim();
  const adminName = String(getArg('adminName', 'Admin User')).trim();
  const adminRole = String(getArg('adminRole', 'OWNER')).trim().toUpperCase();
  const adminPhone = String(getArg('adminPhone', '')).trim() || null;

  if (!orgCode || !orgName || !adminEmail || !adminPassword || !adminName) {
    throw new Error('orgCode, orgName, adminEmail, adminPassword, adminName are required');
  }

  const ssl = getSslConfig(databaseUrl);
  const client = new Client({ connectionString: databaseUrl, ...(ssl ? { ssl } : {}) });
  await client.connect();

  try {
    await client.query('BEGIN');

    const orgRes = await client.query(
      `
      insert into organizations (code, name)
      values ($1, $2)
      on conflict (code)
      do update set name = excluded.name, updated_at = now()
      returning *
      `,
      [orgCode, orgName]
    );
    const org = orgRes.rows[0];

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userRes = await client.query(
      `
      insert into users (
        organization_id, email, full_name, password_hash, role, is_active, phone
      ) values ($1,$2,$3,$4,$5,true,$6)
      on conflict (organization_id, email)
      do update set
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        role = excluded.role,
        phone = excluded.phone,
        is_active = true,
        updated_at = now()
      returning id, organization_id, email, full_name, role, is_active, phone, created_at, updated_at
      `,
      [org.id, adminEmail, adminName, passwordHash, adminRole, adminPhone]
    );
    const user = userRes.rows[0];

    await client.query('COMMIT');

    console.log('Seed complete');
    console.log(JSON.stringify({
      organization: { id: org.id, code: org.code, name: org.name },
      adminUser: user,
      login: { email: adminEmail, password: adminPassword },
      note: 'Use organizationCode during login if the email exists in multiple organizations',
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
