const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

router.get('/summary', asyncHandler(async (req, res) => {
  const orgId = req.orgId;

  const [openingRes, ledgerSumsRes, loanCountsRes, recvRes, interestRes] = await Promise.all([
    query(`select effective_date, amount from opening_balances where organization_id = $1 order by effective_date desc limit 1`, [orgId]),
    query(`
      select
        coalesce(sum(case when tx_type='CREDIT' and tag='CAPITAL' then amount else 0 end),0) as capital_added,
        coalesce(sum(case when tx_type='CREDIT' and tag='COLLECTION' then amount else 0 end),0) as collections,
        coalesce(sum(case when tx_type='DEBIT' and tag='EXPENSE' then amount else 0 end),0) as expenses,
        coalesce(sum(case when tx_type='DEBIT' and tag='BAD_DEBT' then amount else 0 end),0) as bad_debt,
        coalesce(sum(case when tx_type='CREDIT' then amount else 0 end),0) as total_credit,
        coalesce(sum(case when tx_type='DEBIT' then amount else 0 end),0) as total_debit
      from ledger_entries
      where organization_id = $1
    `, [orgId]),
    query(`
      select
        count(*) filter (where status='ACTIVE')::int as active_loans,
        count(*) filter (where status='CLOSED')::int as closed_loans,
        coalesce(sum(principal_amount),0) as total_principal_disbursed
      from loans
      where organization_id = $1
    `, [orgId]),
    query(`
      select coalesce(sum(i.scheduled_amount - i.paid_amount),0) as receivables
      from installments i
      join loans l on l.id = i.loan_id and l.organization_id = i.organization_id
      where i.organization_id = $1
        and l.status = 'ACTIVE'
        and i.status in ('PENDING','PARTIAL')
    `, [orgId]),
    query(`
      select
        coalesce(sum(
          case
            when c.is_writeoff then 0
            else coalesce(c.interest_component, case when l.total_amount > 0 then c.amount * (l.interest_amount / l.total_amount) else 0 end)
          end
        ),0) as interest_income
      from collections c
      left join loans l on l.id = c.loan_id and l.organization_id = c.organization_id
      where c.organization_id = $1
    `, [orgId]),
  ]);

  const opening = openingRes.rows[0] || { amount: 0, effective_date: null };
  const ledger = ledgerSumsRes.rows[0] || {};
  const loans = loanCountsRes.rows[0] || {};
  const recv = Number(recvRes.rows[0]?.receivables || 0);
  const interestIncome = Number(interestRes.rows[0]?.interest_income || 0);
  const totalCap = Number(opening.amount || 0) + Number(ledger.capital_added || 0);
  const totalExp = Number(ledger.expenses || 0) + Number(ledger.bad_debt || 0);
  const netProfit = interestIncome - totalExp;
  const cashBalance = Number(opening.amount || 0) + Number(ledger.total_credit || 0) - Number(ledger.total_debit || 0);

  res.json({
    openingBalance: Number(opening.amount || 0),
    openingBalanceDate: opening.effective_date,
    cashBalance,
    receivables: recv,
    collections: Number(ledger.collections || 0),
    expenses: Number(ledger.expenses || 0),
    badDebt: Number(ledger.bad_debt || 0),
    interestIncome,
    netProfit,
    totalCapital: totalCap,
    activeLoans: Number(loans.active_loans || 0),
    closedLoans: Number(loans.closed_loans || 0),
    totalPrincipalDisbursed: Number(loans.total_principal_disbursed || 0),
  });
}));

router.get('/risk', asyncHandler(async (req, res) => {
  const orgId = req.orgId;

  const riskAgg = await query(`
    with dues as (
      select
        c.name as client_name,
        i.due_date,
        (i.scheduled_amount - i.paid_amount) as due_amount,
        case
          when i.due_date < current_date then (current_date - i.due_date)
          else 0
        end as days_late
      from installments i
      join loans l on l.id = i.loan_id and l.organization_id = i.organization_id
      join clients c on c.id = l.client_id and c.organization_id = i.organization_id
      where i.organization_id = $1
        and l.status = 'ACTIVE'
        and i.status in ('PENDING','PARTIAL')
    )
    select
      coalesce(sum(due_amount),0) as receivables,
      coalesce(sum(case when days_late > 0 then due_amount else 0 end),0) as overdue_amount,
      coalesce(sum(case when days_late between 1 and 30 then due_amount else 0 end),0) as aging_0_30,
      coalesce(sum(case when days_late between 31 and 60 then due_amount else 0 end),0) as aging_31_60,
      coalesce(sum(case when days_late between 61 and 90 then due_amount else 0 end),0) as aging_61_90,
      coalesce(sum(case when days_late > 90 then due_amount else 0 end),0) as aging_90_plus,
      coalesce(sum(case when due_date between current_date and (current_date + interval '6 days')::date then due_amount else 0 end),0) as next_7_due,
      count(*) filter (where due_date = current_date)::int as due_today_count,
      count(*) filter (where days_late > 0)::int as overdue_installment_count
    from dues
  `, [orgId]);

  const topOverdue = await query(`
    select
      c.id as client_id,
      c.name as client_name,
      coalesce(sum(i.scheduled_amount - i.paid_amount),0) as overdue_amount
    from installments i
    join loans l on l.id = i.loan_id and l.organization_id = i.organization_id
    join clients c on c.id = l.client_id and c.organization_id = i.organization_id
    where i.organization_id = $1
      and l.status = 'ACTIVE'
      and i.status in ('PENDING','PARTIAL')
      and i.due_date < current_date
    group by c.id, c.name
    order by overdue_amount desc, c.name asc
    limit 10
  `, [orgId]);

  const r = riskAgg.rows[0] || {};
  const receivables = Number(r.receivables || 0);
  const overdueAmount = Number(r.overdue_amount || 0);
  const par30Amount = Number(r.aging_31_60 || 0) + Number(r.aging_61_90 || 0) + Number(r.aging_90_plus || 0);

  res.json({
    receivables,
    overdueAmount,
    overdueRatio: receivables ? (overdueAmount / receivables) * 100 : 0,
    par30Amount,
    par30Ratio: receivables ? (par30Amount / receivables) * 100 : 0,
    next7Due: Number(r.next_7_due || 0),
    dueTodayCount: Number(r.due_today_count || 0),
    overdueInstallmentCount: Number(r.overdue_installment_count || 0),
    aging: {
      '0-30': Number(r.aging_0_30 || 0),
      '31-60': Number(r.aging_31_60 || 0),
      '61-90': Number(r.aging_61_90 || 0),
      '90+': Number(r.aging_90_plus || 0),
    },
    topOverdueClients: topOverdue.rows,
  });
}));

module.exports = router;
