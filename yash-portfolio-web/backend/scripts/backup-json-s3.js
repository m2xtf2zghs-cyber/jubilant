const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function must(name, value) {
  if (!value) throw new Error(`Missing required value: ${name}`);
  return value;
}

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function isMonthEnd(date = new Date()) {
  const d = new Date(date);
  const tomorrow = new Date(d);
  tomorrow.setUTCDate(d.getUTCDate() + 1);
  return tomorrow.getUTCDate() === 1;
}

function isYearEnd(date = new Date()) {
  return date.getUTCMonth() === 11 && date.getUTCDate() === 31;
}

function buildKeys({ prefix, orgCode, date, ext = 'json' }) {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const stamp = nowStamp(date);
  const keys = [];
  keys.push(`${prefix}/json/daily/${y}/${m}/${orgCode}-${stamp}.${ext}`);
  keys.push(`${prefix}/json/daily/${orgCode}-latest.${ext}`);
  if (isMonthEnd(date)) {
    const monthKey = `${prefix}/json/monthly/${y}/${orgCode}-${y}-${m}.${ext}`;
    keys.push(monthKey);
  }
  if (isYearEnd(date)) {
    keys.push(`${prefix}/json/yearly/${y}/${orgCode}-${y}.${ext}`);
  }
  return keys;
}

async function uploadAll() {
  const orgCode = String(getArg('orgCode', '') || '').trim().toLowerCase();
  const outArg = String(getArg('out', '') || '').trim();
  if (!orgCode) throw new Error('Missing required arg: --orgCode');

  const bucket = must('S3_BACKUP_BUCKET', process.env.S3_BACKUP_BUCKET);
  const region = must('AWS_REGION', process.env.AWS_REGION);
  const prefix = String(process.env.S3_BACKUP_PREFIX || 'yash-portfolio').replace(/\/+$/, '');

  const cliArgs = ['scripts/backup-json.js', `--orgCode=${orgCode}`];
  if (outArg) cliArgs.push(`--out=${outArg}`);

  const child = spawnSync(process.execPath, cliArgs, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });

  if (child.status !== 0) {
    process.stderr.write(child.stderr || '');
    process.stdout.write(child.stdout || '');
    throw new Error(`backup-json failed with exit code ${child.status}`);
  }

  let backupMeta;
  try {
    backupMeta = JSON.parse((child.stdout || '').trim());
  } catch (e) {
    throw new Error(`Unable to parse backup-json output: ${e.message}`);
  }

  const outPath = String(backupMeta.outPath || '');
  if (!outPath || !fs.existsSync(outPath)) throw new Error('backup-json did not produce a readable output file');

  const fileBuf = fs.readFileSync(outPath);
  const now = new Date();
  const keys = buildKeys({ prefix, orgCode, date: now, ext: 'json' });

  const s3 = new S3Client({ region });
  for (const key of keys) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuf,
      ContentType: 'application/json',
      Metadata: {
        orgcode: orgCode,
        generatedat: String(backupMeta?.meta?.generatedAt || '').slice(0, 32),
        totalrows: String(backupMeta?.totalRows || ''),
      },
    }));
  }

  console.log(JSON.stringify({
    ok: true,
    bucket,
    region,
    localFile: outPath,
    uploadedKeys: keys,
    orgCode,
  }, null, 2));
}

uploadAll().catch((err) => {
  console.error('[backup:json:s3] failed', err);
  process.exit(1);
});
