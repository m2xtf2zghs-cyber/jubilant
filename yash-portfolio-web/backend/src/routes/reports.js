const express = require('express');
const { query } = require('../db');
const { ApiError, asyncHandler, parsePagination, parseBool } = require('../utils/http');

const router = express.Router();

function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'month must be in YYYY-MM format');
  }
  const [y, m] = String(month).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function parseLimit(value, fallback = 10, max = 50) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, n);
}

router.get('/client-arrears', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const { page, pageSize, limit, offset } = parsePagination(req.query);
  const hasOverdueOnly = parseBool(req.query.hasOverdueOnly);
  const q = String(req.query.q || '').trim();

  const params = [orgId];
  const outerWhere = [];
  if (q) {
    params.push(`%${q}%`);
    outerWhere.push(`r.client_name ilike $${params.length}`);
  }
  if (hasOverdueOnly === true) outerWhere.push('r.overdue_emi_count > 0');
  if (hasOverdueOnly === false) outerWhere.push('r.overdue_emi_count = 0');

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    with r as (
      select
        c.id as client_id,
        c.name as client_name,
        count(distinct l.id) filter (where l.status = 'ACTIVE')::int as active_loan_count,
        coalesce(sum(case when i.status in ('PENDING','PARTIAL') and l.status='ACTIVE' then (i.scheduled_amount - i.paid_amount) else 0 end),0) as total_receivable,
        count(i.id) filter (where i.status in ('PENDING','PARTIAL') and l.status='ACTIVE')::int as pending_emi_count,
        count(i.id) filter (where i.status in ('PENDING','PARTIAL') and l.status='ACTIVE' and i.due_date < current_date)::int as overdue_emi_count,
        coalesce(sum(case when i.status in ('PENDING','PARTIAL') and l.status='ACTIVE' and i.due_date < current_date then (i.scheduled_amount - i.paid_amount) else 0 end),0) as overdue_amount
      from clients c
      left join loans l on l.client_id = c.id and l.organization_id = c.organization_id
      left join installments i on i.loan_id = l.id and i.organization_id = c.organization_id
      where c.organization_id = $1
      group by c.id, c.name
      having coalesce(sum(case when i.status in ('PENDING','PARTIAL') and l.status='ACTIVE' then (i.scheduled_amount - i.paid_amount) else 0 end),0) > 0
    )
    select r.*, count(*) over()::int as total_count
    from r
    ${outerWhere.length ? `where ${outerWhere.join(' and ')}` : ''}
    order by r.total_receivable desc, r.overdue_emi_count desc, r.client_name asc
    limit $${limitIdx} offset $${offsetIdx}
  `;

  const result = await query(sql, params);
  res.json({
    items: result.rows.map(({ total_count, ...row }) => ({
      ...row,
      pendingCategory: row.overdue_emi_count >= 4 ? 'LONG_PENDING' : row.overdue_emi_count >= 1 ? 'CURRENT_PENDING' : 'NOT_OVERDUE',
    })),
    page,
    pageSize,
    total: result.rows[0]?.total_count || 0,
  });
}));

router.get('/pnl', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const month = req.query.month;
  if (!month) throw new ApiError(422, 'VALIDATION_ERROR', 'month is required (YYYY-MM)');
  const { start, end } = monthBounds(month);

  const [txRes, splitRes] = await Promise.all([
    query(`
      select
        coalesce(sum(case when tx_type='CREDIT' and tag='COLLECTION' then amount else 0 end),0) as collections,
        coalesce(sum(case when tx_type='DEBIT' and tag='EXPENSE' then amount else 0 end),0) as expenses,
        coalesce(sum(case when tx_type='DEBIT' and tag='BAD_DEBT' then amount else 0 end),0) as bad_debt
      from ledger_entries
      where organization_id = $1 and entry_time >= $2 and entry_time < $3
    `, [orgId, start, end]),
    query(`
      select
        coalesce(sum(case when c.is_writeoff then 0 else coalesce(c.interest_component, case when l.total_amount>0 then c.amount * (l.interest_amount / l.total_amount) else 0 end) end),0) as interest_earned,
        coalesce(sum(case when c.is_writeoff then 0 else coalesce(c.principal_component, c.amount - coalesce(c.interest_component, case when l.total_amount>0 then c.amount * (l.interest_amount / l.total_amount) else 0 end)) end),0) as principal_recovered
      from collections c
      left join loans l on l.id = c.loan_id and l.organization_id = c.organization_id
      where c.organization_id = $1 and c.collection_date >= $2 and c.collection_date < $3
    `, [orgId, start, end]),
  ]);

  const t = txRes.rows[0] || {};
  const s = splitRes.rows[0] || {};
  const interestEarned = Number(s.interest_earned || 0);
  const expenses = Number(t.expenses || 0);
  const badDebt = Number(t.bad_debt || 0);

  res.json({
    month,
    collections: Number(t.collections || 0),
    interestEarned,
    principalRecovered: Number(s.principal_recovered || 0),
    expenses,
    badDebt,
    netOperating: interestEarned - expenses - badDebt,
  });
}));

router.get('/collections-efficiency', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const month = req.query.month;
  if (!month) throw new ApiError(422, 'VALIDATION_ERROR', 'month is required (YYYY-MM)');
  const { start, end } = monthBounds(month);

  const result = await query(`
    select
      coalesce(sum(i.scheduled_amount),0) as month_demand,
      coalesce(sum(least(i.scheduled_amount, i.paid_amount)),0) as month_scheduled_collected,
      count(*)::int as due_installment_count,
      count(*) filter (where i.paid_amount >= i.scheduled_amount or i.status = 'PAID')::int as fully_paid_installment_count
    from installments i
    where i.organization_id = $1
      and i.due_date >= $2::date
      and i.due_date < $3::date
  `, [orgId, start, end]);

  const r = result.rows[0] || {};
  const demand = Number(r.month_demand || 0);
  const collected = Number(r.month_scheduled_collected || 0);
  res.json({
    month,
    monthDemand: demand,
    monthScheduledCollected: collected,
    collectionEfficiency: demand ? (collected / demand) * 100 : 0,
    dueInstallmentCount: Number(r.due_installment_count || 0),
    fullyPaidInstallmentCount: Number(r.fully_paid_installment_count || 0),
  });
}));

router.get('/top-collections', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const month = req.query.month;
  if (!month) throw new ApiError(422, 'VALIDATION_ERROR', 'month is required (YYYY-MM)');
  const limit = parseLimit(req.query.limit, 10, 100);
  const { start, end } = monthBounds(month);

  const result = await query(`
    select
      c.id as client_id,
      c.name as client_name,
      count(co.id)::int as collection_count,
      coalesce(sum(co.amount),0) as amount
    from collections co
    join clients c on c.id = co.client_id and c.organization_id = co.organization_id
    where co.organization_id = $1
      and co.collection_date >= $2
      and co.collection_date < $3
      and coalesce(co.is_writeoff,false) = false
    group by c.id, c.name
    order by amount desc, c.name asc
    limit $4
  `, [orgId, start, end, limit]);

  res.json({
    month,
    items: result.rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.client_name,
      collectionCount: Number(r.collection_count || 0),
      amount: Number(r.amount || 0),
    })),
  });
}));

router.get('/expense-mix', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const month = req.query.month;
  if (!month) throw new ApiError(422, 'VALIDATION_ERROR', 'month is required (YYYY-MM)');
  const limit = parseLimit(req.query.limit, 10, 100);
  const { start, end } = monthBounds(month);

  const [topMixRes, scheduleRes, totalsRes] = await Promise.all([
    query(`
      with base as (
        select
          case
            when le.tag = 'BAD_DEBT' then 'Bad Debt Write-off'
            else coalesce(nullif(le.category,''), 'Other Expenses')
          end as label,
          le.amount
        from ledger_entries le
        where le.organization_id = $1
          and le.entry_time >= $2
          and le.entry_time < $3
          and le.tx_type = 'DEBIT'
          and le.tag in ('EXPENSE','BAD_DEBT')
      )
      select label, coalesce(sum(amount),0) as value
      from base
      group by label
      order by value desc, label asc
      limit $4
    `, [orgId, start, end, limit]),
    query(`
      select
        coalesce(nullif(le.category,''), 'Other Expenses') as label,
        coalesce(sum(le.amount),0) as value
      from ledger_entries le
      where le.organization_id = $1
        and le.entry_time >= $2
        and le.entry_time < $3
        and le.tx_type = 'DEBIT'
        and le.tag = 'EXPENSE'
      group by label
      order by value desc, label asc
    `, [orgId, start, end]),
    query(`
      select
        coalesce(sum(case when le.tx_type='DEBIT' and le.tag='EXPENSE' then le.amount else 0 end),0) as expenses,
        coalesce(sum(case when le.tx_type='DEBIT' and le.tag='BAD_DEBT' then le.amount else 0 end),0) as bad_debt
      from ledger_entries le
      where le.organization_id = $1
        and le.entry_time >= $2
        and le.entry_time < $3
    `, [orgId, start, end]),
  ]);

  const totals = totalsRes.rows[0] || {};
  res.json({
    month,
    topMix: topMixRes.rows.map((r) => ({ label: r.label, value: Number(r.value || 0) })),
    expenseSchedule: scheduleRes.rows.map((r) => ({ label: r.label, value: Number(r.value || 0) })),
    totals: {
      expenses: Number(totals.expenses || 0),
      badDebt: Number(totals.bad_debt || 0),
    },
  });
}));

router.get('/monthly-ledger-summary', asyncHandler(async (req, res) => {
  const orgId = req.orgId;
  const month = req.query.month;
  if (!month) throw new ApiError(422, 'VALIDATION_ERROR', 'month is required (YYYY-MM)');
  const { start, end } = monthBounds(month);

  const [tagSummaryRes, dailyTrendRes, totalsRes, openingRes, priorMovementRes] = await Promise.all([
    query(`
      select
        le.tag,
        count(*)::int as count,
        coalesce(sum(case when le.tx_type='DEBIT' then le.amount else 0 end),0) as debit,
        coalesce(sum(case when le.tx_type='CREDIT' then le.amount else 0 end),0) as credit
      from ledger_entries le
      where le.organization_id = $1
        and le.entry_time >= $2
        and le.entry_time < $3
      group by le.tag
      order by le.tag asc
    `, [orgId, start, end]),
    query(`
      select
        le.entry_time::date as day,
        count(*)::int as entries,
        coalesce(sum(case when le.tx_type='CREDIT' then le.amount else 0 end),0) as inflow,
        coalesce(sum(case when le.tx_type='DEBIT' then le.amount else 0 end),0) as outflow,
        coalesce(sum(case when le.tx_type='CREDIT' and le.tag='COLLECTION' then le.amount else 0 end),0) as collections
      from ledger_entries le
      where le.organization_id = $1
        and le.entry_time >= $2
        and le.entry_time < $3
      group by le.entry_time::date
      order by le.entry_time::date asc
    `, [orgId, start, end]),
    query(`
      select
        count(*)::int as entry_count,
        count(*) filter (where le.tx_type='CREDIT')::int as credit_entry_count,
        count(*) filter (where le.tx_type='DEBIT')::int as debit_entry_count,
        count(*) filter (where le.tag='COLLECTION')::int as collection_entry_count,
        count(*) filter (where le.tag='EXPENSE')::int as expense_entry_count,
        count(*) filter (where le.tag='BAD_DEBT')::int as writeoff_entry_count,
        coalesce(sum(case when le.tx_type='CREDIT' then le.amount else 0 end),0) as total_credit,
        coalesce(sum(case when le.tx_type='DEBIT' then le.amount else 0 end),0) as total_debit,
        coalesce(sum(case when le.tx_type='DEBIT' and le.tag='LENDING' then le.amount else 0 end),0) as disbursed,
        coalesce(sum(case when le.tx_type='CREDIT' and le.tag='CAPITAL' then le.amount else 0 end),0) as capital_added
      from ledger_entries le
      where le.organization_id = $1
        and le.entry_time >= $2
        and le.entry_time < $3
    `, [orgId, start, end]),
    query(`
      select effective_date, amount
      from opening_balances
      where organization_id = $1
      order by effective_date desc
      limit 1
    `, [orgId]),
    query(`
      select
        coalesce(sum(case when le.tx_type='CREDIT' then le.amount else 0 end),0) as total_credit_before,
        coalesce(sum(case when le.tx_type='DEBIT' then le.amount else 0 end),0) as total_debit_before
      from ledger_entries le
      where le.organization_id = $1
        and le.entry_time < $2
    `, [orgId, start]),
  ]);

  const totals = totalsRes.rows[0] || {};
  const opening = openingRes.rows[0] || { amount: 0, effective_date: null };
  const prior = priorMovementRes.rows[0] || {};
  const openingCashBalance = Number(opening.amount || 0) + Number(prior.total_credit_before || 0) - Number(prior.total_debit_before || 0);
  const totalCredit = Number(totals.total_credit || 0);
  const totalDebit = Number(totals.total_debit || 0);

  res.json({
    month,
    totals: {
      entryCount: Number(totals.entry_count || 0),
      creditEntryCount: Number(totals.credit_entry_count || 0),
      debitEntryCount: Number(totals.debit_entry_count || 0),
      collectionEntryCount: Number(totals.collection_entry_count || 0),
      expenseEntryCount: Number(totals.expense_entry_count || 0),
      writeoffEntryCount: Number(totals.writeoff_entry_count || 0),
      totalCredit,
      totalDebit,
      cashMovement: totalCredit - totalDebit,
      disbursed: Number(totals.disbursed || 0),
      capitalAdded: Number(totals.capital_added || 0),
      openingCashBalance,
      closingCashBalance: openingCashBalance + (totalCredit - totalDebit),
      openingBalanceBase: Number(opening.amount || 0),
      openingBalanceDate: opening.effective_date || null,
    },
    tagSummary: tagSummaryRes.rows.map((r) => {
      const debit = Number(r.debit || 0);
      const credit = Number(r.credit || 0);
      return {
        tag: r.tag,
        count: Number(r.count || 0),
        debit,
        credit,
        net: credit - debit,
      };
    }),
    dailyTrend: dailyTrendRes.rows.map((r) => ({
      day: r.day,
      entries: Number(r.entries || 0),
      inflow: Number(r.inflow || 0),
      outflow: Number(r.outflow || 0),
      collections: Number(r.collections || 0),
      net: Number(r.inflow || 0) - Number(r.outflow || 0),
    })),
  });
}));

router.get('/balance-sheet', asyncHandler(async (_req, _res) => {
  throw new ApiError(501, 'NOT_IMPLEMENTED', 'Use /dashboard/summary for now; balance-sheet endpoint will be added next.');
}));

router.get('/client-profitability', asyncHandler(async (_req, _res) => {
  throw new ApiError(501, 'NOT_IMPLEMENTED', 'client-profitability report endpoint is not implemented yet.');
}));

module.exports = router;
