const test = require('node:test');
const assert = require('node:assert/strict');
const {
  xirr,
  xnpv,
  buildChitCostCashflows,
  buildChitYieldCashflows,
  buildAutoAttributedReturnsLoanLinked,
  buildTreasuryPoolAttributedReturns,
  summarizeChit,
  summarizePortfolio,
} = require('../src/services/chit-calculations');

test('xirr solves a simple annualized cashflow', () => {
  const flows = [
    { date: '2026-01-01', amount: -100000 },
    { date: '2027-01-01', amount: 110000 },
  ];
  const r = xirr(flows);
  assert.ok(r !== null);
  assert.ok(Math.abs(r - 0.10) < 0.002, `expected ~10%, got ${r}`);
  assert.ok(Math.abs(xnpv(r, flows)) < 1e-4);
});

test('xirr supports irregular dates', () => {
  const flows = [
    { date: '2026-01-01', amount: -100000 },
    { date: '2026-06-15', amount: 30000 },
    { date: '2027-03-10', amount: 80000 },
  ];
  const r = xirr(flows);
  assert.ok(r !== null);
  assert.ok(Number.isFinite(r));
  assert.ok(Math.abs(xnpv(r, flows)) < 1e-3);
});

test('xirr returns null when signs are not mixed', () => {
  assert.equal(xirr([{ date: '2026-01-01', amount: 1000 }, { date: '2026-02-01', amount: 2000 }]), null);
  assert.equal(xirr([{ date: '2026-01-01', amount: -1000 }, { date: '2026-02-01', amount: -500 }]), null);
});

test('buildChitCostCashflows treats separately paid fees as extra outflows', () => {
  const flows = buildChitCostCashflows({
    payments: [{ paymentDate: '2026-01-10', amountPaid: 1000 }],
    receipt: { drawDate: '2026-02-10', amountReceived: 5000, commissionAmount: 100, otherCharges: 50, feesPaidSeparately: true },
  });
  assert.equal(flows.length, 4);
  assert.equal(flows.filter((f) => f.amount < 0).length, 3);
});

test('buildChitYieldCashflows uses allocations negative and returns+income positive', () => {
  const flows = buildChitYieldCashflows({
    allocations: [{ allocationDate: '2026-02-01', amountAllocated: 10000 }],
    returns: [{ returnDate: '2026-06-01', amountReturned: 10000, interestIncomeAmount: 1200, otherIncomeAmount: 0 }],
  });
  assert.equal(flows.length, 2);
  assert.equal(flows[0].amount, -10000);
  assert.equal(flows[1].amount, 11200);
});

test('summarizeChit computes spread and profitability flag', () => {
  const summary = summarizeChit({
    chit: {
      id: 'c1', chit_code: 'CH1', chit_name: 'Chit 1', status: 'RUNNING', face_value: 100000, tenure_months: 10, installment_amount: 10000,
    },
    payments: [
      { payment_date: '2026-01-01', amount_paid: 10000 },
      { payment_date: '2026-02-01', amount_paid: 10000 },
      { payment_date: '2026-03-01', amount_paid: 10000 },
      { payment_date: '2026-04-01', amount_paid: 10000 },
      { payment_date: '2026-05-01', amount_paid: 10000 },
    ],
    receipt: { draw_date: '2026-03-15', amount_received: 60000, discount_amount: 10000 },
    allocations: [{ allocation_date: '2026-03-16', amount_allocated: 50000 }],
    returns: [{ return_date: '2026-09-16', amount_returned: 50000, interest_income_amount: 8000, other_income_amount: 0 }],
  });
  assert.equal(summary.chitId, 'c1');
  assert.ok(summary.cost);
  assert.ok(summary.yield);
  assert.ok(summary.spread);
  assert.ok(['STRONG_POSITIVE', 'MODERATE', 'WEAK', 'NEGATIVE', 'UNAVAILABLE'].includes(summary.spread.profitabilityFlag));
});

test('summarizePortfolio returns required structured JSON keys', () => {
  const c1 = summarizeChit({
    chit: { id: 'c1', chit_code: 'CH1', chit_name: 'C1', status: 'RUNNING', face_value: 100000, tenure_months: 10, installment_amount: 10000 },
    payments: [{ payment_date: '2026-01-01', amount_paid: 10000 }],
    receipt: { draw_date: '2026-01-15', amount_received: 80000, discount_amount: 5000 },
    allocations: [{ allocation_date: '2026-01-16', amount_allocated: 50000 }],
    returns: [{ return_date: '2026-06-16', amount_returned: 50000, interest_income_amount: 5000, other_income_amount: 0 }],
  });
  const out = summarizePortfolio({
    chitSummaries: [c1],
    monthlyInstallmentsDue: [{ month: '2026-01', totalChitInstallmentsDue: 10000 }],
    monthlyBusinessInflows: [{ month: '2026-01', businessCashInflows: 30000 }],
    otherFixedOutflowsMonthly: 5000,
    auditLog: [{ id: 'a1', entityType: 'CHIT_REGISTER', action: 'CREATE' }],
  });
  assert.ok(Array.isArray(out.chit_summary));
  assert.ok(out.portfolio_summary);
  assert.ok(Array.isArray(out.stress_table_monthly));
  assert.ok(Array.isArray(out.cashflow_series_per_chit));
  assert.ok(Array.isArray(out.audit_log));
});

test('auto attribution derives loan-linked principal and interest by chit funding share', () => {
  const out = buildAutoAttributedReturnsLoanLinked({
    chit: { id: 'ch1' },
    mode: 'AUTO',
    allocations: [
      { id: 'a1', purpose: 'LENDING', linked_loan_id: 'l1', amount_allocated: 50000 },
    ],
    manualReturns: [],
    loansById: {
      l1: { id: 'l1', principal_amount: 100000, interest_amount: 20000, total_amount: 120000 },
    },
    collections: [
      { id: 'c1', loan_id: 'l1', amount: 12000, principal_component: 10000, interest_component: 2000, collection_date: '2026-05-01' },
      { id: 'c2', loan_id: 'l1', amount: 12000, principal_component: 10000, interest_component: 2000, collection_date: '2026-06-01' },
    ],
  });

  assert.equal(out.returnsMode, 'AUTO');
  assert.equal(out.effectiveReturns.length, 2);
  assert.equal(out.attribution.linkedLendingAllocationAmount, 50000);
  assert.equal(out.attribution.autoDerivedCapitalReturned, 10000);
  assert.equal(out.attribution.autoDerivedInterestIncome, 2000);
  assert.equal(out.attribution.warnings.length, 0);
});

test('hybrid mode manual return with linked collection overrides auto row for same collection', () => {
  const out = buildAutoAttributedReturnsLoanLinked({
    chit: { id: 'ch1' },
    mode: 'HYBRID',
    allocations: [{ purpose: 'LENDING', linked_loan_id: 'l1', amount_allocated: 100000 }],
    loansById: { l1: { id: 'l1', principal_amount: 100000, interest_amount: 10000, total_amount: 110000 } },
    collections: [
      { id: 'c1', loan_id: 'l1', amount: 11000, principal_component: 10000, interest_component: 1000, collection_date: '2026-07-01' },
    ],
    manualReturns: [
      {
        id: 'mr1',
        return_date: '2026-07-01',
        amount_returned: 9000,
        interest_income_amount: 1500,
        other_income_amount: 0,
        linked_collection_id: 'c1',
      },
    ],
  });

  assert.equal(out.effectiveReturns.length, 1);
  assert.equal(out.effectiveReturns[0].id, 'mr1');
  assert.equal(out.autoDerivedReturns.length, 1);
  assert.equal(out.attribution.method, 'LOAN_LINKED_EXACT_WITH_MANUAL_OVERRIDE');
});

test('auto attribution warns when non-loan allocations exist', () => {
  const out = buildAutoAttributedReturnsLoanLinked({
    chit: { id: 'ch1' },
    mode: 'AUTO',
    allocations: [{ purpose: 'OTHER', amount_allocated: 25000 }],
    manualReturns: [],
    loansById: {},
    collections: [],
  });
  assert.ok(out.attribution.nonLoanAllocationAmount > 0);
  assert.ok(out.attribution.warnings.some((w) => /Non-loan/i.test(w)));
});

test('treasury pool PRO_RATA allocates residual collections across chits by open balance', () => {
  const out = buildTreasuryPoolAttributedReturns({
    policy: 'PRO_RATA',
    treasuryAllocations: [
      { id: 'a1', chitId: 'c1', allocation_date: '2026-01-01', amount_allocated: 100000 },
      { id: 'a2', chitId: 'c2', allocation_date: '2026-01-01', amount_allocated: 50000 },
    ],
    residualCollections: [
      { collectionId: 'col1', date: '2026-02-01', principalResidual: 15000, interestResidual: 3000 },
    ],
  });

  const c1 = out.autoReturnsByChit.get('c1') || [];
  const c2 = out.autoReturnsByChit.get('c2') || [];
  assert.equal(out.treasuryPolicy, 'PRO_RATA');
  assert.equal(c1.length, 1);
  assert.equal(c2.length, 1);
  const c1Amt = (c1[0].amount_returned + c1[0].interest_income_amount);
  const c2Amt = (c2[0].amount_returned + c2[0].interest_income_amount);
  assert.ok(c1Amt > c2Amt);
  assert.equal(
    Number((c1[0].amount_returned + c2[0].amount_returned).toFixed(2)),
    15000,
  );
});

test('treasury pool FIFO allocates principal to oldest chit allocation first', () => {
  const out = buildTreasuryPoolAttributedReturns({
    policy: 'FIFO',
    treasuryAllocations: [
      { id: 'a1', chitId: 'c1', allocation_date: '2026-01-01', amount_allocated: 10000 },
      { id: 'a2', chitId: 'c2', allocation_date: '2026-02-01', amount_allocated: 10000 },
    ],
    residualCollections: [
      { collectionId: 'col1', date: '2026-03-01', principalResidual: 6000, interestResidual: 0 },
      { collectionId: 'col2', date: '2026-04-01', principalResidual: 6000, interestResidual: 0 },
    ],
  });
  const c1 = (out.autoReturnsByChit.get('c1') || []).reduce((s, r) => s + r.amount_returned, 0);
  const c2 = (out.autoReturnsByChit.get('c2') || []).reduce((s, r) => s + r.amount_returned, 0);
  assert.equal(out.treasuryPolicy, 'FIFO');
  assert.equal(c1, 10000);
  assert.equal(c2, 2000);
});
