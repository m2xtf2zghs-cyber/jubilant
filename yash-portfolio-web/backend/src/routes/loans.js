const express = require('express');
const { query, withTransaction } = require('../db');
const { ApiError, asyncHandler, parsePagination, parseBool } = require('../utils/http');

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;
const FREQ_DAYS = { WEEKLY: 7, BI_WEEKLY: 14, BI_MONTHLY: 15 };
const ALLOWED_FREQ = new Set(['WEEKLY', 'BI_WEEKLY', 'BI_MONTHLY', 'MONTHLY']);

const toPaise = (v) => Math.round((Number(v) || 0) * 100);
const fromPaise = (p) => Number((p / 100).toFixed(2));

function calcEffectiveRatePercent(principalAmount, interestAmount, frequencyCode, installmentCount) {
  const p = Number(principalAmount || 0);
  const i = Number(interestAmount || 0);
  const d = Math.max(0, Number(installmentCount || 0));
  if (!p || !d) return 0;
  const r = i / p;
  if (frequencyCode === 'MONTHLY') return (r / ((d + 1) / 2)) * 100;
  const days = FREQ_DAYS[frequencyCode] || 30;
  return (r / ((d + 1) / 2) / days) * 3000;
}

function buildAmountPlan(totalPaise, count) {
  const n = Math.max(0, parseInt(count, 10) || 0);
  if (!n) return [];
  const base = Math.floor(totalPaise / n);
  let rem = totalPaise - (base * n);
  return Array.from({ length: n }, () => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return base + extra;
  });
}

function addFrequency(dateObj, frequencyCode) {
  const d = new Date(dateObj);
  if (frequencyCode === 'MONTHLY') {
    const day = d.getDate();
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    if (next.getDate() !== day) next.setDate(0);
    return next;
  }
  const days = FREQ_DAYS[frequencyCode] || 30;
  return new Date(d.getTime() + (days * DAY_MS));
}

function buildSchedulePlan({ principalAmount, interestAmount, installmentCount, firstDueDate, frequencyCode }) {
  const count = Math.max(0, parseInt(installmentCount, 10) || 0);
  const principalPlan = buildAmountPlan(toPaise(principalAmount), count);
  const interestPlan = buildAmountPlan(toPaise(interestAmount), count);
  const rows = [];
  let due = new Date(firstDueDate);
  if (Number.isNaN(due.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid firstDueDate');
  for (let i = 0; i < count; i += 1) {
    const principalDuePaise = principalPlan[i] || 0;
    const interestDuePaise = interestPlan[i] || 0;
    rows.push({
      installmentNo: i + 1,
      dueDate: due.toISOString().slice(0, 10),
      scheduledAmount: fromPaise(principalDuePaise + interestDuePaise),
      metadata: {
        split_method: 'INTEREST_FIRST_EMI_SPLIT',
        principal_due: fromPaise(principalDuePaise),
        interest_due: fromPaise(interestDuePaise),
        principal_paid: 0,
        interest_paid: 0,
      },
    });
    due = addFrequency(due, frequencyCode);
  }
  return rows;
}

function generateLoanNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LN-${stamp}-${Date.now().toString().slice(-6)}-${rand}`;
}

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const params = [orgId];
  const where = ['l.organization_id = $1'];

  if (req.query.status) {
    params.push(String(req.query.status).toUpperCase());
    where.push(`l.status = $${params.length}`);
  }
  if (req.query.clientId) {
    params.push(String(req.query.clientId));
    where.push(`l.client_id = $${params.length}`);
  }
  if (req.query.agentUserId) {
    params.push(String(req.query.agentUserId));
    where.push(`l.agent_user_id = $${params.length}`);
  }
  if (req.query.fromDate) {
    params.push(String(req.query.fromDate));
    where.push(`l.disbursed_at::date >= $${params.length}`);
  }
  if (req.query.toDate) {
    params.push(String(req.query.toDate));
    where.push(`l.disbursed_at::date <= $${params.length}`);
  }
  if (parseBool(req.query.overdueOnly) === true) {
    where.push(`exists (
      select 1 from installments io
      where io.loan_id = l.id
        and io.organization_id = l.organization_id
        and io.status in ('PENDING','PARTIAL')
        and io.due_date < current_date
    )`);
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    select
      l.id,
      l.loan_number,
      l.status,
      l.client_id,
      c.name as client_name,
      l.principal_amount,
      l.interest_amount,
      l.total_amount,
      l.installment_amount,
      l.installment_count,
      l.frequency_code,
      l.disbursed_at,
      l.first_due_date,
      coalesce(sum(i.paid_amount),0) as collected_amount,
      coalesce(sum(case when i.status in ('PENDING','PARTIAL') then (i.scheduled_amount - i.paid_amount) else 0 end),0) as outstanding_amount,
      count(i.id) filter (where i.status in ('PENDING','PARTIAL') and i.due_date < current_date)::int as overdue_installment_count,
      count(*) over()::int as total_count
    from loans l
    join clients c on c.id = l.client_id and c.organization_id = l.organization_id
    left join installments i on i.loan_id = l.id and i.organization_id = l.organization_id
    where ${where.join(' and ')}
    group by l.id, c.name
    order by l.disbursed_at desc nulls last, l.created_at desc
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

router.post('/', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const body = req.body || {};

  const clientId = String(body.clientId || '').trim();
  const productId = body.productId || null;
  const principalAmount = Number(body.principalAmount || 0);
  const interestAmount = Number(body.interestAmount || 0);
  const installmentCount = parseInt(body.installmentCount, 10);
  const frequencyCode = String(body.frequencyCode || '').toUpperCase();
  const disbursedAt = body.disbursedAt ? new Date(body.disbursedAt) : new Date();
  const firstDueDate = body.firstDueDate ? new Date(body.firstDueDate) : null;
  const purpose = body.purpose == null ? null : String(body.purpose);
  const loanNotes = body.loanNotes == null ? null : String(body.loanNotes);
  const disbursementMode = body.disbursementMode == null ? 'CASH' : String(body.disbursementMode);
  const agentUserId = body.agentUserId || null;
  const loanNumber = String(body.loanNumber || generateLoanNumber()).trim();

  if (!clientId) throw new ApiError(422, 'VALIDATION_ERROR', 'clientId is required');
  if (!(principalAmount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'principalAmount must be > 0');
  if (!(interestAmount >= 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'interestAmount must be >= 0');
  if (!(installmentCount > 0)) throw new ApiError(422, 'VALIDATION_ERROR', 'installmentCount must be > 0');
  if (!ALLOWED_FREQ.has(frequencyCode)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid frequencyCode');
  if (!firstDueDate || Number.isNaN(firstDueDate.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid firstDueDate');
  if (Number.isNaN(disbursedAt.getTime())) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid disbursedAt');

  const totalAmount = Number((principalAmount + interestAmount).toFixed(2));
  const schedulePlan = buildSchedulePlan({ principalAmount, interestAmount, installmentCount, firstDueDate, frequencyCode });
  if (!schedulePlan.length) throw new ApiError(422, 'VALIDATION_ERROR', 'Failed to generate installment schedule');
  const installmentAmount = Number((totalAmount / installmentCount).toFixed(2));
  const effectiveRatePercent = Number(calcEffectiveRatePercent(principalAmount, interestAmount, frequencyCode, installmentCount).toFixed(4));

  const result = await withTransaction(async (client) => {
    const clientRes = await query(
      `select id, name from clients where organization_id = $1 and id = $2 and is_active = true`,
      [orgId, clientId],
      client
    );
    const clientRow = clientRes.rows[0];
    if (!clientRow) throw new ApiError(404, 'CLIENT_NOT_FOUND', 'Client not found or inactive');

    if (productId) {
      const productRes = await query(
        `select id from loan_products where organization_id = $1 and id = $2 and is_active = true`,
        [orgId, productId],
        client
      );
      if (!productRes.rows[0]) throw new ApiError(422, 'INVALID_PRODUCT', 'loan product not found or inactive');
    }

    const loanInsert = await query(
      `
      insert into loans (
        organization_id, client_id, loan_number, product_id, status,
        principal_amount, interest_amount, total_amount, effective_rate_percent,
        frequency_code, installment_count, installment_amount,
        disbursed_at, first_due_date, purpose, loan_notes, disbursement_mode,
        agent_user_id, created_by
      ) values (
        $1,$2,$3,$4,'ACTIVE',
        $5,$6,$7,$8,
        $9,$10,$11,
        $12,$13,$14,$15,$16,
        $17,$18
      )
      returning *
      `,
      [
        orgId,
        clientId,
        loanNumber,
        productId,
        principalAmount,
        interestAmount,
        totalAmount,
        effectiveRatePercent,
        frequencyCode,
        installmentCount,
        installmentAmount,
        disbursedAt.toISOString(),
        firstDueDate.toISOString().slice(0, 10),
        purpose,
        loanNotes,
        disbursementMode,
        agentUserId,
        userId,
      ],
      client
    );
    const loan = loanInsert.rows[0];

    const scheduleRows = [];
    for (const s of schedulePlan) {
      const instRes = await query(
        `
        insert into installments (
          organization_id, loan_id, installment_no, due_date,
          scheduled_amount, paid_amount, status, metadata, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,0,'PENDING',$6::jsonb,now(),now())
        returning *
        `,
        [
          orgId,
          loan.id,
          s.installmentNo,
          s.dueDate,
          s.scheduledAmount,
          JSON.stringify(s.metadata),
        ],
        client
      );
      scheduleRows.push(instRes.rows[0]);
    }

    const ledgerEntry = await query(
      `
      insert into ledger_entries (
        organization_id, entry_time, tx_type, tag, amount, description,
        client_id, loan_id, created_by
      ) values ($1,$2,'DEBIT','LENDING',$3,$4,$5,$6,$7)
      returning *
      `,
      [
        orgId,
        disbursedAt.toISOString(),
        principalAmount,
        `Loan Disbursed — ${clientRow.name}`,
        clientId,
        loan.id,
        userId,
      ],
      client
    );

    await query(
      `
      insert into audit_logs (
        organization_id, actor_user_id, entity_type, entity_id, action, after_data
      ) values (
        $1,$2,'loan',$3,'CREATE_LOAN',$4::jsonb
      )
      `,
      [
        orgId,
        userId,
        loan.id,
        JSON.stringify({
          loanNumber: loan.loan_number,
          clientId,
          principalAmount,
          interestAmount,
          installmentCount,
          frequencyCode,
        }),
      ],
      client
    );

    return {
      loan,
      schedule: scheduleRows,
      ledgerEntry: ledgerEntry.rows[0],
      summary: {
        scheduledTotal: scheduleRows.reduce((a, r) => a + Number(r.scheduled_amount || 0), 0),
        installmentCount: scheduleRows.length,
        firstDueDate: scheduleRows[0]?.due_date || null,
        lastDueDate: scheduleRows[scheduleRows.length - 1]?.due_date || null,
      },
    };
  });

  res.status(201).json(result);
}));

router.post('/:loanId/close', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const userId = req.auth.sub;
  const { loanId } = req.params;
  const closeReason = (req.body || {}).closeReason || 'Manual close';

  const result = await withTransaction(async (client) => {
    const loanQ = await query(
      `select * from loans where id = $1 and organization_id = $2 for update`,
      [loanId, orgId],
      client
    );
    const loan = loanQ.rows[0];
    if (!loan) throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan not found');
    if (loan.status === 'CLOSED') return { loan };

    await query(
      `
      update installments
      set status = case when status in ('PENDING','PARTIAL') then 'CLOSED' else status end,
          updated_at = now()
      where organization_id = $1 and loan_id = $2
      `,
      [orgId, loanId],
      client
    );

    const upd = await query(
      `
      update loans
      set status = 'CLOSED', closed_at = now(), closed_reason = $3, updated_at = now(), version = version + 1
      where organization_id = $1 and id = $2
      returning *
      `,
      [orgId, loanId, String(closeReason).slice(0, 250)],
      client
    );

    await query(
      `
      insert into audit_logs (organization_id, actor_user_id, entity_type, entity_id, action, after_data)
      values ($1, $2, 'loan', $3, 'CLOSE_LOAN', jsonb_build_object('status','CLOSED','closeReason',$4))
      `,
      [orgId, userId, loanId, String(closeReason).slice(0, 250)],
      client
    );

    return { loan: upd.rows[0] };
  });

  res.json({ item: result.loan });
}));

router.get('/:loanId', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { loanId } = req.params;

  const loanRes = await query(
    `
    select l.*, c.name as client_name, c.phone as client_phone, c.risk_grade as client_risk_grade
    from loans l
    join clients c on c.id = l.client_id and c.organization_id = l.organization_id
    where l.organization_id = $1 and l.id = $2
    `,
    [orgId, loanId]
  );
  const loan = loanRes.rows[0];
  if (!loan) throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan not found');

  const schedule = await query(
    `select * from installments where organization_id = $1 and loan_id = $2 order by installment_no asc`,
    [orgId, loanId]
  );

  const summary = await query(
    `
    select
      coalesce(sum(i.scheduled_amount),0) as scheduled_total,
      coalesce(sum(i.paid_amount),0) as paid_total,
      coalesce(sum(case when i.status in ('PENDING','PARTIAL') then (i.scheduled_amount - i.paid_amount) else 0 end),0) as outstanding_total,
      count(*) filter (where i.status in ('PENDING','PARTIAL') and i.due_date < current_date)::int as overdue_installment_count,
      count(*) filter (where i.status in ('PENDING','PARTIAL'))::int as pending_installment_count
    from installments i
    where i.organization_id = $1 and i.loan_id = $2
    `,
    [orgId, loanId]
  );

  res.json({ loan, schedule: schedule.rows, summary: summary.rows[0] || {} });
}));

module.exports = router;
