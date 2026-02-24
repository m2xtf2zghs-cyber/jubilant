const DAY_MS = 24 * 60 * 60 * 1000;

function toAmount(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function toDate(value) {
  const d = value instanceof Date ? new Date(value) : new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

function isoDate(value) {
  return toDate(value).toISOString();
}

function sortCashflows(flows = []) {
  return [...flows].map((f) => ({ ...f, amount: toAmount(f.amount), date: isoDate(f.date) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function hasMixedSigns(flows) {
  let pos = false; let neg = false;
  for (const f of flows) {
    if (f.amount > 0) pos = true;
    if (f.amount < 0) neg = true;
    if (pos && neg) return true;
  }
  return false;
}

function yearFrac(baseDate, targetDate) {
  return (toDate(targetDate).getTime() - toDate(baseDate).getTime()) / DAY_MS / 365;
}

function xnpv(rate, cashflows) {
  const flows = sortCashflows(cashflows);
  if (!flows.length) return 0;
  if (rate <= -0.999999999) return Number.POSITIVE_INFINITY;
  const base = flows[0].date;
  return flows.reduce((sum, f) => {
    const t = yearFrac(base, f.date);
    return sum + (f.amount / ((1 + rate) ** t));
  }, 0);
}

function xnpvDerivative(rate, cashflows) {
  const flows = sortCashflows(cashflows);
  if (!flows.length) return 0;
  if (rate <= -0.999999999) return Number.POSITIVE_INFINITY;
  const base = flows[0].date;
  return flows.reduce((sum, f) => {
    const t = yearFrac(base, f.date);
    if (t === 0) return sum;
    return sum - ((t * f.amount) / ((1 + rate) ** (t + 1)));
  }, 0);
}

function findBracket(cashflows, guess = 0.2) {
  const probes = [-0.95, -0.8, -0.5, -0.2, -0.05, 0, guess, 0.1, 0.25, 0.5, 1, 2, 4, 8, 12];
  const uniq = Array.from(new Set(probes.filter((v) => v > -0.9999)));
  let prevRate = uniq[0];
  let prevVal = xnpv(prevRate, cashflows);
  for (let i = 1; i < uniq.length; i += 1) {
    const rate = uniq[i];
    const val = xnpv(rate, cashflows);
    if (Number.isFinite(prevVal) && Number.isFinite(val) && prevVal === 0) return [prevRate, prevRate];
    if (Number.isFinite(prevVal) && Number.isFinite(val) && (prevVal < 0) !== (val < 0)) return [prevRate, rate];
    prevRate = rate;
    prevVal = val;
  }
  return null;
}

function bisectionRoot(cashflows, low, high, tolerance = 1e-9, maxIter = 200) {
  let a = low;
  let b = high;
  let fa = xnpv(a, cashflows);
  let fb = xnpv(b, cashflows);
  if (Math.abs(fa) < tolerance) return a;
  if (Math.abs(fb) < tolerance) return b;
  if ((fa < 0) === (fb < 0)) return null;
  for (let i = 0; i < maxIter; i += 1) {
    const mid = (a + b) / 2;
    const fm = xnpv(mid, cashflows);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < tolerance) return mid;
    if ((fa < 0) !== (fm < 0)) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
    if (Math.abs(b - a) < tolerance) return (a + b) / 2;
  }
  return (a + b) / 2;
}

function xirr(cashflows, { guess = 0.2, tolerance = 1e-9, maxIter = 100 } = {}) {
  const flows = sortCashflows(cashflows).filter((f) => f.amount !== 0);
  if (flows.length < 2 || !hasMixedSigns(flows)) return null;

  let rate = guess;
  for (let i = 0; i < maxIter; i += 1) {
    const fx = xnpv(rate, flows);
    if (!Number.isFinite(fx)) break;
    if (Math.abs(fx) < tolerance) return rate;
    const dfx = xnpvDerivative(rate, flows);
    if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-12) break;
    const next = rate - (fx / dfx);
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < tolerance) return next;
    rate = next;
  }

  const bracket = findBracket(flows, guess);
  if (!bracket) return null;
  const root = bisectionRoot(flows, bracket[0], bracket[1], tolerance, 300);
  return Number.isFinite(root) ? root : null;
}

function irrPeriodic(amounts = [], { guess = 0.1 } = {}) {
  if (!Array.isArray(amounts) || amounts.length < 2) return null;
  const flows = amounts.map((a, i) => ({ date: new Date(Date.UTC(2000, 0, 1 + i)).toISOString(), amount: toAmount(a) }));
  return xirr(flows, { guess });
}

function groupByDate(flows) {
  const map = new Map();
  for (const f of flows) {
    const key = toDate(f.date).toISOString().slice(0, 10);
    const prev = map.get(key) || { date: key, amount: 0, items: [] };
    prev.amount += toAmount(f.amount);
    prev.items.push({ ...f, amount: toAmount(f.amount) });
    map.set(key, prev);
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildChitCostCashflows({ payments = [], receipt = null } = {}) {
  const flows = [];
  for (const p of payments) {
    flows.push({
      date: p.paymentDate || p.payment_date,
      amount: -Math.abs(toAmount(p.amountPaid ?? p.amount_paid)),
      type: 'INSTALLMENT_PAYMENT',
      refId: p.id,
    });
  }
  if (receipt && (receipt.drawDate || receipt.draw_date)) {
    const drawDate = receipt.drawDate || receipt.draw_date;
    const amountReceived = toAmount(receipt.amountReceived ?? receipt.amount_received);
    if (amountReceived > 0) {
      flows.push({ date: drawDate, amount: amountReceived, type: 'DRAW_RECEIPT', refId: receipt.id || null });
    }
    const feesPaidSeparately = Boolean(receipt.feesPaidSeparately ?? receipt.fees_paid_separately);
    if (feesPaidSeparately) {
      const commission = toAmount(receipt.commissionAmount ?? receipt.commission_amount);
      const other = toAmount(receipt.otherCharges ?? receipt.other_charges);
      if (commission > 0) flows.push({ date: drawDate, amount: -commission, type: 'COMMISSION', refId: receipt.id || null });
      if (other > 0) flows.push({ date: drawDate, amount: -other, type: 'OTHER_FEES', refId: receipt.id || null });
    }
  }
  return sortCashflows(flows);
}

function buildChitYieldCashflows({ allocations = [], returns = [] } = {}) {
  const flows = [];
  for (const a of allocations) {
    flows.push({
      date: a.allocationDate || a.allocation_date,
      amount: -Math.abs(toAmount(a.amountAllocated ?? a.amount_allocated)),
      type: 'ALLOCATION',
      refId: a.id,
    });
  }
  for (const r of returns) {
    const capital = toAmount(r.amountReturned ?? r.amount_returned);
    const interestIncome = toAmount(r.interestIncomeAmount ?? r.interest_income_amount);
    const otherIncome = toAmount(r.otherIncomeAmount ?? r.other_income_amount);
    const inflow = capital + interestIncome + otherIncome;
    if (inflow <= 0) continue;
    flows.push({
      date: r.returnDate || r.return_date,
      amount: inflow,
      type: 'RETURN_AND_INCOME',
      split: { capitalReturned: capital, interestIncome, otherIncome },
      refId: r.id,
    });
  }
  return sortCashflows(flows);
}

function estimateFundingCostRupees(costCashflows, chitMeta = {}) {
  const totalOut = costCashflows.filter((f) => f.amount < 0).reduce((s, f) => s + Math.abs(f.amount), 0);
  const totalIn = costCashflows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0);
  const explicitDiscount = toAmount(chitMeta.discountAmount ?? chitMeta.discount_amount);
  const separateFees = (chitMeta.feesPaidSeparately ?? chitMeta.fees_paid_separately)
    ? toAmount(chitMeta.commissionAmount ?? chitMeta.commission_amount) + toAmount(chitMeta.otherCharges ?? chitMeta.other_charges)
    : 0;
  const cashGap = Math.max(0, totalOut - totalIn);
  return Math.max(cashGap, explicitDiscount + separateFees);
}

function profitabilityFlag(spreadPct) {
  if (!Number.isFinite(spreadPct)) return 'UNAVAILABLE';
  if (spreadPct > 8) return 'STRONG_POSITIVE';
  if (spreadPct > 3) return 'MODERATE';
  if (spreadPct >= 0) return 'WEAK';
  return 'NEGATIVE';
}

function summarizeChit({ chit, payments = [], receipt = null, allocations = [], returns = [] }) {
  const costCashflows = buildChitCostCashflows({ payments, receipt });
  const yieldCashflows = buildChitYieldCashflows({ allocations, returns });
  const chitXirr = xirr(costCashflows);
  const yieldXirr = xirr(yieldCashflows);

  const totalPaid = payments.reduce((s, p) => s + toAmount(p.amountPaid ?? p.amount_paid), 0);
  const amountReceived = toAmount(receipt?.amountReceived ?? receipt?.amount_received ?? chit.amount_received);
  const discountAmount = toAmount(receipt?.discountAmount ?? receipt?.discount_amount ?? chit.discount_amount);
  const totalAllocated = allocations.reduce((s, a) => s + toAmount(a.amountAllocated ?? a.amount_allocated), 0);
  const totalReturnedCapital = returns.reduce((s, r) => s + toAmount(r.amountReturned ?? r.amount_returned), 0);
  const attributedIncome = returns.reduce((s, r) => s + toAmount(r.interestIncomeAmount ?? r.interest_income_amount) + toAmount(r.otherIncomeAmount ?? r.other_income_amount), 0);
  const currentDeployed = Math.max(0, totalAllocated - totalReturnedCapital);
  const availableChitBalance = Math.max(0, amountReceived - currentDeployed);
  const utilizationPct = amountReceived > 0 ? (currentDeployed / amountReceived) * 100 : 0;

  const chitXirrPct = chitXirr == null ? null : chitXirr * 100;
  const yieldXirrPct = yieldXirr == null ? null : yieldXirr * 100;
  const spread = (yieldXirr != null && chitXirr != null) ? (yieldXirr - chitXirr) : null;
  const spreadPct = spread == null ? null : spread * 100;
  const effectiveFundingCostRsEstimate = estimateFundingCostRupees(costCashflows, { ...chit, ...receipt });
  const netProfitRs = attributedIncome - effectiveFundingCostRsEstimate;

  return {
    chitId: chit.id,
    chitCode: chit.chit_code,
    chitName: chit.chit_name,
    groupName: chit.group_name,
    organizer: chit.organizer,
    status: chit.status,
    faceValue: toAmount(chit.face_value),
    tenureMonths: Number(chit.tenure_months || 0),
    installmentAmount: toAmount(chit.installment_amount),
    drawDate: receipt?.draw_date || receipt?.drawDate || chit.draw_date || null,
    cost: {
      chitXirrAnnual: chitXirr,
      chitXirrAnnualPct: chitXirrPct,
      totalPaid,
      netProceeds: amountReceived,
      discountCost: discountAmount,
      effectiveFundingCostRsEstimate,
    },
    yield: {
      yieldXirrAnnual: yieldXirr,
      yieldXirrAnnualPct: yieldXirrPct,
      totalAllocated,
      totalReturnedCapital,
      attributedIncome,
      utilizationPct,
      idleBalance: availableChitBalance,
      currentDeployed,
    },
    spread: {
      netSpread: spread,
      netSpreadPct: spreadPct,
      breakEvenYieldPct: chitXirrPct,
      netProfitRs,
      profitabilityFlag: profitabilityFlag(spreadPct),
    },
    cashflowSeries: {
      costCashflows,
      yieldCashflows,
    },
  };
}

function monthKey(dateValue) {
  const d = toDate(dateValue);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonthsToKey(key, months) {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(fromKey, toKey) {
  const out = [];
  if (!fromKey || !toKey) return out;
  let cur = fromKey;
  let guard = 0;
  while (cur <= toKey && guard < 240) {
    out.push(cur);
    cur = addMonthsToKey(cur, 1);
    guard += 1;
  }
  return out;
}

function buildStressTable({ monthlyInstallmentsDue = [], monthlyBusinessInflows = [], otherFixedOutflowsMonthly = 0, scenario = {} }) {
  const baseMap = new Map();
  for (const r of monthlyInstallmentsDue) {
    const key = r.month || monthKey(r.date);
    const row = baseMap.get(key) || { month: key, totalChitInstallmentsDue: 0, businessCashInflows: 0 };
    row.totalChitInstallmentsDue += toAmount(r.totalChitInstallmentsDue ?? r.amount ?? r.value);
    baseMap.set(key, row);
  }
  for (const r of monthlyBusinessInflows) {
    const key = r.month || monthKey(r.date);
    const row = baseMap.get(key) || { month: key, totalChitInstallmentsDue: 0, businessCashInflows: 0 };
    row.businessCashInflows += toAmount(r.businessCashInflows ?? r.amount ?? r.value);
    baseMap.set(key, row);
  }

  const rows = Array.from(baseMap.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const reduceInflowsPct = Number(scenario.reduceInflowsPct ?? 20);
  const delayCollectionsDays = Number(scenario.delayCollectionsDays ?? 60);
  const increaseDefaultsPct = Number(scenario.increaseDefaultsPct ?? 10);
  const delayMonths = Math.round(delayCollectionsDays / 30);

  const delayedInflowsMap = new Map();
  for (const r of rows) {
    const shiftedMonth = addMonthsToKey(r.month, Math.max(0, delayMonths));
    delayedInflowsMap.set(shiftedMonth, (delayedInflowsMap.get(shiftedMonth) || 0) + r.businessCashInflows);
  }

  const allMonths = rows.length
    ? monthRange(rows[0].month, addMonthsToKey(rows[rows.length - 1].month, Math.max(0, delayMonths)))
    : [];

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return allMonths.map((m) => {
    const base = byMonth.get(m) || { month: m, totalChitInstallmentsDue: 0, businessCashInflows: 0 };
    const installments = toAmount(base.totalChitInstallmentsDue);
    const inflows = toAmount(base.businessCashInflows);
    const baseNet = inflows - installments - toAmount(otherFixedOutflowsMonthly);
    const baseRatio = installments > 0 ? (baseNet / installments) : null;

    const delayedInflows = toAmount(delayedInflowsMap.get(m) || 0);
    let stressedInflows = delayedInflows * (1 - (reduceInflowsPct / 100));
    stressedInflows *= (1 - (increaseDefaultsPct / 100));
    stressedInflows = Math.max(0, stressedInflows);
    const stressedNet = stressedInflows - installments - toAmount(otherFixedOutflowsMonthly);
    const stressedRatio = installments > 0 ? (stressedNet / installments) : null;

    const flag = (ratio) => {
      if (ratio == null) return 'N/A';
      if (ratio >= 1.5) return 'SAFE';
      if (ratio >= 1.0) return 'WATCH';
      return 'DANGER';
    };

    return {
      month: m,
      totalChitInstallmentsDue: installments,
      businessCashInflows: inflows,
      otherFixedOutflows: toAmount(otherFixedOutflowsMonthly),
      netSurplus: baseNet,
      stressRatio: baseRatio,
      stressFlag: flag(baseRatio),
      scenario: {
        assumptions: {
          reduceInflowsPct,
          delayCollectionsDays,
          increaseDefaultsPct,
        },
        base: { stressRatio: baseRatio, stressFlag: flag(baseRatio) },
        worstCase: { stressRatio: stressedRatio, stressFlag: flag(stressedRatio), businessCashInflows: stressedInflows, netSurplus: stressedNet },
      },
    };
  });
}

function blendCashflowSeries(seriesList = []) {
  return sortCashflows(seriesList.flatMap((s) => s || []));
}

function summarizePortfolio({ chitSummaries = [], monthlyInstallmentsDue = [], monthlyBusinessInflows = [], otherFixedOutflowsMonthly = 0, scenario = {}, auditLog = [] }) {
  const costSeries = blendCashflowSeries(chitSummaries.map((c) => c.cashflowSeries.costCashflows));
  const yieldSeries = blendCashflowSeries(chitSummaries.map((c) => c.cashflowSeries.yieldCashflows));
  const blendedChitXirr = xirr(costSeries);
  const blendedYieldXirr = xirr(yieldSeries);
  const stressTable = buildStressTable({ monthlyInstallmentsDue, monthlyBusinessInflows, otherFixedOutflowsMonthly, scenario });

  const totalMonthlyObligation = stressTable.reduce((max, r) => Math.max(max, toAmount(r.totalChitInstallmentsDue)), 0);
  const netProfitRs = chitSummaries.reduce((s, c) => s + toAmount(c.spread.netProfitRs), 0);
  const blendedSpread = blendedYieldXirr != null && blendedChitXirr != null ? (blendedYieldXirr - blendedChitXirr) : null;

  return {
    chit_summary: chitSummaries.map((c) => {
      const { cashflowSeries, ...rest } = c;
      return rest;
    }),
    portfolio_summary: {
      runningChitsCount: chitSummaries.filter((c) => c.status === 'RUNNING').length,
      totalChitsCount: chitSummaries.length,
      totalMonthlyObligation,
      blendedChitXirrAnnual: blendedChitXirr,
      blendedChitXirrAnnualPct: blendedChitXirr == null ? null : blendedChitXirr * 100,
      blendedYieldXirrAnnual: blendedYieldXirr,
      blendedYieldXirrAnnualPct: blendedYieldXirr == null ? null : blendedYieldXirr * 100,
      portfolioSpread: blendedSpread,
      portfolioSpreadPct: blendedSpread == null ? null : blendedSpread * 100,
      netProfitRs,
      worstMonthStressRatio: stressTable.filter((r) => r.stressRatio != null).reduce((m, r) => Math.min(m, r.stressRatio), Number.POSITIVE_INFINITY),
    },
    stress_table_monthly: stressTable,
    cashflow_series_per_chit: chitSummaries.map((c) => ({
      chitId: c.chitId,
      chitCode: c.chitCode,
      chitName: c.chitName,
      costCashflows: c.cashflowSeries.costCashflows,
      yieldCashflows: c.cashflowSeries.yieldCashflows,
    })),
    audit_log: auditLog,
  };
}

module.exports = {
  toAmount,
  sortCashflows,
  xnpv,
  xirr,
  irrPeriodic,
  buildChitCostCashflows,
  buildChitYieldCashflows,
  summarizeChit,
  buildStressTable,
  summarizePortfolio,
  profitabilityFlag,
};
