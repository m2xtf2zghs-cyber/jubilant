const express = require('express');
const { query } = require('../db');
const { asyncHandler, parsePagination, parseBool } = require('../utils/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['i.organization_id = $1'];

  if (req.query.loanId) { params.push(String(req.query.loanId)); where.push(`i.loan_id = $${params.length}`); }
  if (req.query.clientId) { params.push(String(req.query.clientId)); where.push(`l.client_id = $${params.length}`); }
  if (req.query.status) { params.push(String(req.query.status).toUpperCase()); where.push(`i.status = $${params.length}`); }
  if (req.query.date) { params.push(String(req.query.date)); where.push(`i.due_date = $${params.length}`); }
  if (req.query.fromDate) { params.push(String(req.query.fromDate)); where.push(`i.due_date >= $${params.length}`); }
  if (req.query.toDate) { params.push(String(req.query.toDate)); where.push(`i.due_date <= $${params.length}`); }
  if (parseBool(req.query.overdue) === true) where.push(`i.status in ('PENDING','PARTIAL') and i.due_date < current_date`);
  if (parseBool(req.query.dueToday) === true) where.push(`i.status in ('PENDING','PARTIAL') and i.due_date = current_date`);

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    select
      i.*,
      l.loan_number,
      l.status as loan_status,
      c.id as client_id,
      c.name as client_name,
      c.phone as client_phone,
      count(*) over()::int as total_count
    from installments i
    join loans l on l.id = i.loan_id and l.organization_id = i.organization_id
    join clients c on c.id = l.client_id and c.organization_id = i.organization_id
    where ${where.join(' and ')}
    order by i.due_date asc, i.installment_no asc
    limit $${limitIdx} offset $${offsetIdx}
  `;

  const result = await query(sql, params);
  res.json({
    items: result.rows.map(({ total_count, ...row }) => row),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0,
  });
}));

module.exports = router;
