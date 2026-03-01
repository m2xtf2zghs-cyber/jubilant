const express = require('express');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler, parsePagination } = require('../utils/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['e.organization_id = $1'];

  if (req.query.category) { params.push(String(req.query.category)); where.push(`e.category = $${params.length}`); }
  if (req.query.q) {
    params.push(`%${String(req.query.q).trim()}%`);
    where.push(`(e.description ilike $${params.length} or coalesce(e.vendor_name,'') ilike $${params.length})`);
  }
  if (req.query.fromDate) { params.push(String(req.query.fromDate)); where.push(`e.expense_date::date >= $${params.length}`); }
  if (req.query.toDate) { params.push(String(req.query.toDate)); where.push(`e.expense_date::date <= $${params.length}`); }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    select e.*, count(*) over()::int as total_count
    from expenses e
    where ${where.join(' and ')}
    order by e.expense_date desc, e.created_at desc
    limit $${limitIdx} offset $${offsetIdx}
  `;
  const result = await query(sql, params);

  res.json({ items: result.rows.map(({ total_count, ...row }) => row), page, pageSize, total: result.rows[0]?.total_count || 0 });
}));

router.post('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};
  const amount = Number(body.amount || 0);
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim();
  const expenseDate = body.expenseDate ? new Date(body.expenseDate) : new Date();
  if (!description || !category || !(amount > 0)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'description, category, amount are required');
  }
  if (Number.isNaN(expenseDate.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid expenseDate');

  const idempotencyKey = (req.headers['idempotency-key'] || body.idempotencyKey || null);
  const rawClientId = body.clientId ? String(body.clientId).trim() : null;
  const rawLoanId = body.loanId ? String(body.loanId).trim() : null;

  const result = await withTransaction(async (client) => {
    if (idempotencyKey) {
      const existing = await query(
        'select * from expenses where organization_id = $1 and idempotency_key = $2',
        [orgId, String(idempotencyKey)],
        client
      );
      if (existing.rows[0]) return { expense: existing.rows[0], reused: true };
    }

    const expenseInsert = await query(
      `
      insert into expenses (
        organization_id, expense_date, category, description, amount, payment_mode,
        vendor_name, idempotency_key, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      returning *
      `,
      [
        orgId,
        expenseDate.toISOString(),
        category,
        description,
        amount,
        body.paymentMode ? String(body.paymentMode) : 'CASH',
        body.vendorName ? String(body.vendorName) : null,
        idempotencyKey ? String(idempotencyKey) : null,
        userId,
      ],
      client
    );

    let resolvedClientId = rawClientId || null;
    let resolvedLoanId = rawLoanId || null;

    if (resolvedClientId) {
      const cRes = await query(
        `select id from clients where organization_id = $1 and id = $2`,
        [orgId, resolvedClientId],
        client
      );
      if (!cRes.rows[0]) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid clientId');
    }

    if (resolvedLoanId) {
      const lRes = await query(
        `select id, client_id from loans where organization_id = $1 and id = $2`,
        [orgId, resolvedLoanId],
        client
      );
      const loan = lRes.rows[0];
      if (!loan) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid loanId');
      if (resolvedClientId && loan.client_id !== resolvedClientId) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'loanId does not belong to clientId');
      }
      if (!resolvedClientId) resolvedClientId = loan.client_id;
    }

    await query(
      `
      insert into ledger_entries (
        organization_id, entry_time, tx_type, tag, amount, description, category, client_id, loan_id, expense_id, created_by
      ) values ($1,$2,'DEBIT','EXPENSE',$3,$4,$5,$6,$7,$8,$9)
      `,
      [orgId, expenseDate.toISOString(), amount, description, category, resolvedClientId, resolvedLoanId, expenseInsert.rows[0].id, userId],
      client
    );

    return { expense: expenseInsert.rows[0], reused: false };
  });

  res.status(result.reused ? 200 : 201).json({ item: result.expense, reused: result.reused });
}));

module.exports = router;
