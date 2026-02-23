const express = require('express');
const { query } = require('../db');
const { ApiError, asyncHandler, parsePagination, parseBool } = require('../utils/http');
const { ilikeTerm } = require('../utils/sql');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const q = (req.query.q || '').trim();
  const riskGrade = req.query.riskGrade ? String(req.query.riskGrade).toUpperCase() : null;
  const active = parseBool(req.query.active);
  const hasOverdue = parseBool(req.query.hasOverdue);

  const params = [orgId];
  const filters = ['c.organization_id = $1'];

  if (q) {
    params.push(ilikeTerm(q));
    const idx = params.length;
    filters.push(`(c.name ilike $${idx} or coalesce(c.phone,'') ilike $${idx} or coalesce(c.client_code,'') ilike $${idx})`);
  }
  if (riskGrade) {
    params.push(riskGrade);
    filters.push(`c.risk_grade = $${params.length}`);
  }
  if (active !== undefined) {
    params.push(active);
    filters.push(`c.is_active = $${params.length}`);
  }

  const outerFilters = [];
  if (hasOverdue === true) outerFilters.push('coalesce(base.overdue_amount,0) > 0');
  if (hasOverdue === false) outerFilters.push('coalesce(base.overdue_amount,0) = 0');

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    with base as (
      select
        c.id,
        c.client_code,
        c.name,
        c.phone,
        c.kyc_ref,
        c.address_line,
        c.risk_grade,
        c.notes,
        c.is_active,
        c.created_at,
        c.updated_at,
        count(distinct l.id) as loan_count,
        count(distinct l.id) filter (where l.status = 'ACTIVE') as active_loan_count,
        coalesce(sum(case when l.status = 'ACTIVE' and i.status in ('PENDING','PARTIAL') then (i.scheduled_amount - i.paid_amount) else 0 end),0) as outstanding,
        coalesce(sum(case when l.status = 'ACTIVE' and i.status in ('PENDING','PARTIAL') and i.due_date < current_date then (i.scheduled_amount - i.paid_amount) else 0 end),0) as overdue_amount,
        coalesce(sum(case when i.status in ('PAID','PARTIAL') then i.paid_amount else 0 end),0) as total_collected
      from clients c
      left join loans l on l.client_id = c.id and l.organization_id = c.organization_id
      left join installments i on i.loan_id = l.id and i.organization_id = c.organization_id
      where ${filters.join(' and ')}
      group by c.id
    )
    select *, count(*) over()::int as total_count
    from base
    ${outerFilters.length ? `where ${outerFilters.join(' and ')}` : ''}
    order by outstanding desc, name asc
    limit $${limitIdx} offset $${offsetIdx}
  `;

  const result = await query(sql, params);
  const total = result.rows[0]?.total_count || 0;

  res.json({
    items: result.rows.map(({ total_count, ...row }) => row),
    page,
    pageSize,
    total,
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) throw new ApiError(422, 'VALIDATION_ERROR', 'Client name is required', { field: 'name' });

  const clientCode = String(body.clientCode || `CL${Date.now()}`).trim().slice(0, 40);
  const result = await query(
    `
    insert into clients (
      organization_id, client_code, name, phone, alt_phone, kyc_ref, kyc_type,
      address_line, locality, city, state, postal_code, risk_grade, notes, is_active, created_by
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,coalesce($15,true),$16
    )
    returning *
    `,
    [
      orgId,
      clientCode,
      name,
      body.phone || null,
      body.altPhone || null,
      body.kycRef || null,
      body.kycType || null,
      body.addressLine || null,
      body.locality || null,
      body.city || null,
      body.state || null,
      body.postalCode || null,
      body.riskGrade ? String(body.riskGrade).toUpperCase() : 'STANDARD',
      body.notes || null,
      body.isActive,
      userId,
    ]
  );

  res.status(201).json({ item: result.rows[0] });
}));

router.get('/:clientId', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { clientId } = req.params;

  const profile = await query(
    `select * from clients where organization_id = $1 and id = $2`,
    [orgId, clientId]
  );
  if (!profile.rows.length) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');

  const summary = await query(
    `
    select
      count(distinct l.id)::int as loan_count,
      coalesce(sum(l.principal_amount),0) as total_borrowed,
      coalesce(sum(case when i.status in ('PAID','PARTIAL') then i.paid_amount else 0 end),0) as total_collected,
      coalesce(sum(case when l.status='ACTIVE' and i.status in ('PENDING','PARTIAL') then (i.scheduled_amount - i.paid_amount) else 0 end),0) as outstanding,
      coalesce(sum(case when l.status='ACTIVE' and i.status in ('PENDING','PARTIAL') and i.due_date < current_date then (i.scheduled_amount - i.paid_amount) else 0 end),0) as overdue_amount
    from loans l
    left join installments i on i.loan_id = l.id and i.organization_id = l.organization_id
    where l.organization_id = $1 and l.client_id = $2
    `,
    [orgId, clientId]
  );

  res.json({
    item: profile.rows[0],
    portfolioSummary: summary.rows[0] || {
      loan_count: 0,
      total_borrowed: 0,
      total_collected: 0,
      outstanding: 0,
      overdue_amount: 0,
    },
  });
}));

router.patch('/:clientId', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { clientId } = req.params;
  const body = req.body || {};

  const fieldMap = {
    name: 'name',
    phone: 'phone',
    altPhone: 'alt_phone',
    kycRef: 'kyc_ref',
    kycType: 'kyc_type',
    addressLine: 'address_line',
    locality: 'locality',
    city: 'city',
    state: 'state',
    postalCode: 'postal_code',
    riskGrade: 'risk_grade',
    notes: 'notes',
    isActive: 'is_active',
  };

  const sets = [];
  const values = [orgId, clientId];
  for (const [bodyKey, column] of Object.entries(fieldMap)) {
    if (!Object.prototype.hasOwnProperty.call(body, bodyKey)) continue;
    let val = body[bodyKey];
    if (bodyKey === 'riskGrade' && val != null) val = String(val).toUpperCase();
    values.push(val);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) throw new ApiError(422, 'VALIDATION_ERROR', 'No updatable fields provided');
  sets.push('updated_at = now()');

  const result = await query(
    `update clients set ${sets.join(', ')} where organization_id = $1 and id = $2 returning *`,
    values
  );
  if (!result.rows.length) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');

  res.json({ item: result.rows[0] });
}));

router.delete('/:clientId', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { clientId } = req.params;

  const result = await query(
    `
    update clients
    set is_active = false, updated_at = now()
    where organization_id = $1 and id = $2
    returning *
    `,
    [orgId, clientId]
  );
  if (!result.rows.length) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');

  res.json({ item: result.rows[0], softDeleted: true });
}));

router.get('/:clientId/loans', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { clientId } = req.params;

  const result = await query(
    `
    select
      l.*,
      coalesce(sum(i.paid_amount),0) as collected_amount,
      coalesce(sum(case when i.status in ('PENDING','PARTIAL') then (i.scheduled_amount - i.paid_amount) else 0 end),0) as outstanding_amount,
      count(i.id)::int as installment_count_actual,
      count(i.id) filter (where i.status in ('PENDING','PARTIAL'))::int as pending_installment_count,
      count(i.id) filter (where i.status in ('PENDING','PARTIAL') and i.due_date < current_date)::int as overdue_installment_count
    from loans l
    left join installments i on i.loan_id = l.id and i.organization_id = l.organization_id
    where l.organization_id = $1 and l.client_id = $2
    group by l.id
    order by l.disbursed_at desc nulls last, l.created_at desc
    `,
    [orgId, clientId]
  );

  res.json({ items: result.rows });
}));

module.exports = router;
