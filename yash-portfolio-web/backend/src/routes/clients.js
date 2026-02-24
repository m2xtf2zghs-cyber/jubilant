const express = require('express');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler, parsePagination, parseBool } = require('../utils/http');
const { ilikeTerm } = require('../utils/sql');
const { requireRoles } = require('../middleware/auth');

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
        c.funding_channel,
        c.tie_up_partner_name,
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
  const fundingChannel = body.fundingChannel ? String(body.fundingChannel).toUpperCase() : 'DIRECT';
  if (!['DIRECT', 'TIE_UP'].includes(fundingChannel)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid fundingChannel');
  const tieUpPartnerName = body.tieUpPartnerName == null ? null : String(body.tieUpPartnerName).trim() || null;
  if (fundingChannel === 'DIRECT' && tieUpPartnerName) {
    // Allow storing historical text, but prefer empty for direct.
  }

  const clientCode = String(body.clientCode || `CL${Date.now()}`).trim().slice(0, 40);
  const result = await query(
    `
    insert into clients (
      organization_id, client_code, name, phone, alt_phone, kyc_ref, kyc_type,
      address_line, locality, city, state, postal_code, risk_grade, notes, is_active, created_by
      , funding_channel, tie_up_partner_name
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,coalesce($15,true),$16,$17,$18
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
      fundingChannel,
      tieUpPartnerName,
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
    fundingChannel: 'funding_channel',
    tieUpPartnerName: 'tie_up_partner_name',
    notes: 'notes',
    isActive: 'is_active',
  };

  const sets = [];
  const values = [orgId, clientId];
  for (const [bodyKey, column] of Object.entries(fieldMap)) {
    if (!Object.prototype.hasOwnProperty.call(body, bodyKey)) continue;
    let val = body[bodyKey];
    if (bodyKey === 'riskGrade' && val != null) val = String(val).toUpperCase();
    if (bodyKey === 'fundingChannel' && val != null) {
      val = String(val).toUpperCase();
      if (!['DIRECT', 'TIE_UP'].includes(val)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid fundingChannel');
    }
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

router.delete('/:clientId/force', requireRoles('OWNER'), asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { clientId } = req.params;

  const out = await withTransaction(async (dbClient) => {
    const hasClientTdsTable = !!(await query(`select to_regclass('public.client_tds_entries') as t`, [], dbClient)).rows[0]?.t;
    const hasChitReturnsTable = !!(await query(`select to_regclass('public.chit_capital_returns') as t`, [], dbClient)).rows[0]?.t;
    const hasFundAllocTable = !!(await query(`select to_regclass('public.fund_source_allocations') as t`, [], dbClient)).rows[0]?.t;

    const clientRes = await query(
      `select id, name from clients where organization_id = $1 and id = $2 for update`,
      [orgId, clientId],
      dbClient
    );
    const clientRow = clientRes.rows[0];
    if (!clientRow) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found');

    const loanRes = await query(
      `select id from loans where organization_id = $1 and client_id = $2`,
      [orgId, clientId],
      dbClient
    );
    const loanIds = loanRes.rows.map((r) => r.id);

    const instRes = loanIds.length
      ? await query(
        `select id from installments where organization_id = $1 and loan_id = any($2::uuid[])`,
        [orgId, loanIds],
        dbClient
      )
      : { rows: [] };
    const installmentIds = instRes.rows.map((r) => r.id);

    const colRes = loanIds.length
      ? await query(
        `select id from collections where organization_id = $1 and loan_id = any($2::uuid[])`,
        [orgId, loanIds],
        dbClient
      )
      : await query(
        `select id from collections where organization_id = $1 and client_id = $2`,
        [orgId, clientId],
        dbClient
      );
    const collectionIds = colRes.rows.map((r) => r.id);

    if (loanIds.length && hasChitReturnsTable) {
      // Chit module links may reference loans/collections. For trial force-delete, remove returns and unlink allocations.
      await query(
        `delete from chit_capital_returns
         where organization_id = $1
           and (
             (coalesce(array_length($2::uuid[],1),0) > 0 and linked_loan_id = any($2::uuid[]))
             or
             (coalesce(array_length($3::uuid[],1),0) > 0 and linked_collection_id = any($3::uuid[]))
           )`,
        [orgId, loanIds, collectionIds],
        dbClient
      );
    }
    if (loanIds.length && hasFundAllocTable) {
      await query(
        `update fund_source_allocations
         set linked_loan_id = null
         where organization_id = $1
           and coalesce(array_length($2::uuid[],1),0) > 0
           and linked_loan_id = any($2::uuid[])`,
        [orgId, loanIds],
        dbClient
      );
    }

    // Break circular ref before deleting collections/installments.
    if (loanIds.length) {
      await query(
        `update installments
         set last_collection_id = null, updated_at = now()
         where organization_id = $1 and loan_id = any($2::uuid[])`,
        [orgId, loanIds],
        dbClient
      );
    }

    if (hasClientTdsTable) {
      await query(
        `delete from client_tds_entries
         where organization_id = $1
           and (
             client_id = $2
             or (coalesce(array_length($3::uuid[],1),0) > 0 and loan_id = any($3::uuid[]))
             or (coalesce(array_length($4::uuid[],1),0) > 0 and collection_id = any($4::uuid[]))
           )`,
        [orgId, clientId, loanIds, collectionIds],
        dbClient
      );
    }

    await query(
      `delete from ledger_entries
       where organization_id = $1
         and (
           client_id = $2
           or (coalesce(array_length($3::uuid[],1),0) > 0 and loan_id = any($3::uuid[]))
           or (coalesce(array_length($4::uuid[],1),0) > 0 and collection_id = any($4::uuid[]))
         )`,
      [orgId, clientId, loanIds, collectionIds],
      dbClient
    );

    await query(
      `delete from reminder_logs
       where organization_id = $1
         and (
           client_id = $2
           or (coalesce(array_length($3::uuid[],1),0) > 0 and loan_id = any($3::uuid[]))
           or (coalesce(array_length($4::uuid[],1),0) > 0 and installment_id = any($4::uuid[]))
         )`,
      [orgId, clientId, loanIds, installmentIds],
      dbClient
    );

    await query(
      `delete from audit_logs
       where organization_id = $1 and (
         (entity_type = 'client' and entity_id = $2)
         or (coalesce(array_length($3::uuid[],1),0) > 0 and entity_type = 'loan' and entity_id = any($3::uuid[]))
         or (coalesce(array_length($4::uuid[],1),0) > 0 and entity_type = 'installment' and entity_id = any($4::uuid[]))
         or (coalesce(array_length($5::uuid[],1),0) > 0 and entity_type = 'collection' and entity_id = any($5::uuid[]))
       )`,
      [orgId, clientId, loanIds, installmentIds, collectionIds],
      dbClient
    );

    if (collectionIds.length) {
      await query(
        `delete from collections where organization_id = $1 and id = any($2::uuid[])`,
        [orgId, collectionIds],
        dbClient
      );
    }
    if (installmentIds.length) {
      await query(
        `delete from installments where organization_id = $1 and id = any($2::uuid[])`,
        [orgId, installmentIds],
        dbClient
      );
    }
    if (loanIds.length) {
      await query(
        `delete from loans where organization_id = $1 and id = any($2::uuid[])`,
        [orgId, loanIds],
        dbClient
      );
    }

    const delClient = await query(
      `delete from clients where organization_id = $1 and id = $2 returning id, name`,
      [orgId, clientId],
      dbClient
    );

    await query(
      `insert into audit_logs (organization_id, actor_user_id, entity_type, entity_id, action, metadata)
       values ($1,$2,'client',$3,'FORCE_DELETE_CLIENT',$4::jsonb)`,
      [
        orgId,
        userId,
        clientId,
        JSON.stringify({
          clientName: clientRow.name,
          purged: {
            loans: loanIds.length,
            installments: installmentIds.length,
            collections: collectionIds.length,
          },
        }),
      ],
      dbClient
    );

    return {
      item: delClient.rows[0],
      forceDeleted: true,
      purged: {
        loans: loanIds.length,
        installments: installmentIds.length,
        collections: collectionIds.length,
      },
    };
  });

  res.json(out);
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
