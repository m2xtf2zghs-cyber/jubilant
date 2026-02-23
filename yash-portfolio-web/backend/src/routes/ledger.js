const express = require('express');
const { query } = require('../db');
const { ApiError, asyncHandler, parsePagination } = require('../utils/http');
const { requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['le.organization_id = $1'];

  if (req.query.tag) { params.push(String(req.query.tag).toUpperCase()); where.push(`le.tag = $${params.length}`); }
  if (req.query.txType) { params.push(String(req.query.txType).toUpperCase()); where.push(`le.tx_type = $${params.length}`); }
  if (req.query.loanId) { params.push(String(req.query.loanId)); where.push(`le.loan_id = $${params.length}`); }
  if (req.query.clientId) { params.push(String(req.query.clientId)); where.push(`le.client_id = $${params.length}`); }
  if (req.query.fromDate) { params.push(String(req.query.fromDate)); where.push(`le.entry_time::date >= $${params.length}`); }
  if (req.query.toDate) { params.push(String(req.query.toDate)); where.push(`le.entry_time::date <= $${params.length}`); }
  if (req.query.q) {
    params.push(`%${String(req.query.q).trim()}%`);
    where.push(`(le.description ilike $${params.length} or coalesce(le.category,'') ilike $${params.length})`);
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    select le.*, c.name as client_name, l.loan_number, count(*) over()::int as total_count
    from ledger_entries le
    left join clients c on c.id = le.client_id and c.organization_id = le.organization_id
    left join loans l on l.id = le.loan_id and l.organization_id = le.organization_id
    where ${where.join(' and ')}
    order by le.entry_time desc, le.created_at desc
    limit $${limitIdx} offset $${offsetIdx}
  `;
  const result = await query(sql, params);
  res.json({ items: result.rows.map(({ total_count, ...row }) => row), page, pageSize, total: result.rows[0]?.total_count || 0 });
}));

router.get('/day-book', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const date = String(req.query.date || '').trim();
  if (!date) throw new ApiError(422, 'VALIDATION_ERROR', 'date is required (YYYY-MM-DD)');

  const rows = await query(
    `
    select * from ledger_entries
    where organization_id = $1 and entry_time::date = $2
    order by entry_time asc, created_at asc
    `,
    [orgId, date]
  );

  const totals = rows.rows.reduce((acc, r) => {
    if (r.tx_type === 'DEBIT') acc.debit += Number(r.amount || 0);
    if (r.tx_type === 'CREDIT') acc.credit += Number(r.amount || 0);
    return acc;
  }, { debit: 0, credit: 0 });

  res.json({ date, totals, items: rows.rows });
}));

router.post('/manual', requireRoles('OWNER', 'ACCOUNTS_OFFICER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};
  const amount = Number(body.amount || 0);
  if (!(amount >= 0) || !body.txType || !body.tag || !body.description) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'txType, tag, description and amount are required');
  }
  const result = await query(
    `
    insert into ledger_entries (
      organization_id, entry_time, tx_type, tag, amount, description, category,
      client_id, loan_id, manual_reference, created_by
    ) values ($1, coalesce($2, now()), $3, $4, $5, $6, $7, $8, $9, $10, $11)
    returning *
    `,
    [
      orgId,
      body.entryTime || null,
      String(body.txType).toUpperCase(),
      String(body.tag).toUpperCase(),
      amount,
      String(body.description),
      body.category || null,
      body.clientId || null,
      body.loanId || null,
      body.manualReference || null,
      userId,
    ]
  );
  res.status(201).json({ item: result.rows[0] });
}));

module.exports = router;
