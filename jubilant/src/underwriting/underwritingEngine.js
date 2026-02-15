// Deterministic, explainable underwriting engine (web copy of KMP logic).
// Capital protection > borrower comfort.

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseIsoDate = (s) => {
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const daysBetweenInclusive = (start, end) => {
  const ms = end.getTime() - start.getTime();
  const days = Math.floor(ms / 86400000);
  return Math.max(1, days + 1);
};

const formatInr = (n) => {
  const x = Math.abs(Math.round(Number(n) || 0));
  const s = String(x);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts = [];
  while (rest.length > 2) {
    parts.push(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.push(rest);
  return `${parts.reverse().join(",")},${last3}`;
};

const pct1 = (ratio) => `${Math.round((Number(ratio) || 0) * 1000) / 10}%`;

const extractCounterparty = (narrationRaw) => {
  const narration = String(narrationRaw || "").trim().replace(/\s+/g, " ");
  if (!narration) return "-";
  const parts = narration
    .split(/[\/\-|]/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const best = [...parts].reverse().find((p) => {
    const up = p.toUpperCase();
    return p.length >= 3 && /[A-Z]/i.test(p) && !up.startsWith("UPI") && !up.startsWith("IMPS") && !up.startsWith("NEFT");
  });
  return String(best || parts[parts.length - 1] || narration).slice(0, 42);
};

const isPenaltyCharge = (narration) => {
  const t = String(narration || "").toUpperCase();
  return t.includes("CHARGE") || t.includes("PENAL") || t.includes("FEE") || t.includes("SMS");
};

const isBounceOrReturn = (narration) => {
  const t = String(narration || "").toUpperCase();
  return t.includes("BOUNCE") || t.includes("RETURN") || t.includes("REVERS") || t.includes("FAILED");
};

const isPrivateLenderKeyword = (narration) => {
  const t = String(narration || "").toUpperCase();
  const keywords = [
    "HAND LOAN",
    "H LOAN",
    "INTEREST",
    "INT ",
    "RETURN",
    "ROLL",
    "REPAY",
    "LOAN",
    "LENDER",
    "FINANCE",
    "DAILY",
    "WEEKLY",
    "COLLECT",
    "SETTLE",
  ];
  return keywords.some((k) => t.includes(k));
};

const isRoundFigure = (amount) => {
  const a = Math.abs(Number(amount) || 0);
  if (!a) return false;
  return a % 10000 === 0 || a % 5000 === 0 || a % 1000 === 0;
};

const classifyCreditNature = (counterparty) => {
  const t = String(counterparty || "").toUpperCase();
  if (t.includes("SALARY")) return "Salary";
  if (t.includes("UPI") || t.includes("IMPS") || t.includes("NEFT") || t.includes("RTGS")) return "Transfer";
  if (t.includes("CASH")) return "Cash deposit";
  return "Receipts";
};

const classifyDebitType = (counterparty) => {
  const t = String(counterparty || "").toUpperCase();
  if (t.includes("EMI") || t.includes("LOAN") || t.includes("INTEREST") || t.includes("FINANCE")) return ["Existing lender", "High", "No"];
  if (t.includes("RENT")) return ["Rent", "High", "No"];
  if (t.includes("SALARY") || t.includes("WAGE")) return ["Payroll", "High", "No"];
  if (t.includes("GST") || t.includes("TDS") || t.includes("PF")) return ["Statutory", "High", "No"];
  if (t.includes("CHARGE") || t.includes("PENAL") || t.includes("FEE")) return ["Bank charges", "Medium", "No"];
  return ["Supplier/ops", "Medium", "Maybe"];
};

const stdevSample = (arr) => {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

const monthIndex = (ym) => {
  const [y, m] = String(ym || "").trim().split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null;
  return yy * 12 + (mm - 1);
};

const monthIndexToYm = (index) => {
  const y = Math.floor(index / 12);
  const m0 = index % 12;
  const mm = Math.min(12, Math.max(1, m0 + 1));
  return `${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}`;
};

const computeGstUnderwriting = (monthsRaw) => {
  const months = (Array.isArray(monthsRaw) ? monthsRaw : [])
    .filter((m) => m && monthIndex(m.month) != null)
    .slice()
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));

  const values = months.map((m) => num(m.turnover)).filter((v) => v > 0);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const stdev = values.length < 2 ? 0 : stdevSample(values);
  const cv = mean > 0 ? stdev / mean : 0;

  const volatilityBucket = cv < 0.35 ? "Low" : cv < 0.75 ? "Medium" : "High";

  const totalTurnover = months.reduce((acc, m) => acc + Math.max(0, num(m.turnover)), 0);
  const top3 = months
    .map((m) => Math.max(0, num(m.turnover)))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((a, b) => a + b, 0);
  const top3Ratio = totalTurnover > 0 ? top3 / totalTurnover : 0;
  const seasonalityBucket = top3Ratio >= 0.5 ? "High" : top3Ratio >= 0.35 ? "Medium" : "Low";

  const idx = months.map((m) => monthIndex(m.month)).filter((v) => v != null);
  let gapCount = 0;
  if (idx.length >= 2) {
    const minI = Math.min(...idx);
    const maxI = Math.max(...idx);
    const expected = Math.max(0, maxI - minI + 1);
    gapCount = Math.max(0, expected - new Set(idx).size);
  }

  const missingMonths = (() => {
    if (idx.length < 2) return [];
    const minI = Math.min(...idx);
    const maxI = Math.max(...idx);
    const present = new Set(idx);
    const out = [];
    for (let i = minI; i <= maxI; i += 1) {
      if (!present.has(i)) out.push(monthIndexToYm(i));
      if (out.length >= 24) break;
    }
    return out;
  })();

  const lateMonths = months.filter((m) => num(m.daysLate) > 0).map((m) => String(m.month));
  const lateCount = lateMonths.length;
  const avgMonthlyTurnover = Math.max(0, Math.round(mean));

  const consecutiveDropMonths = (() => {
    const sorted = months.slice().sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const dropMonths = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = Math.max(0, num(sorted[i - 1].turnover));
      const cur = Math.max(0, num(sorted[i].turnover));
      if (!prev) continue;
      const dropPct = ((prev - cur) / prev) * 100;
      if (dropPct >= 30) dropMonths.push(String(sorted[i].month));
    }
    const consecutive = [];
    for (const m of dropMonths) {
      const mi = monthIndex(m);
      if (mi == null) continue;
      const prevM = monthIndexToYm(mi - 1);
      if (dropMonths.includes(prevM)) consecutive.push(m);
    }
    return Array.from(new Set(consecutive)).slice(0, 24);
  })();

  const flags = [];
  if (gapCount > 0) flags.push("GST_MISSED_FILINGS");
  if (lateCount >= 2) flags.push("GST_LATE_FILINGS");
  if (volatilityBucket === "High") flags.push("GST_VOLATILITY_HIGH");
  if (consecutiveDropMonths.length >= 2) flags.push("GST_CONSECUTIVE_DROP");

  const commentary = [
    `GST avg monthly turnover ₹${formatInr(avgMonthlyTurnover)}.`,
    gapCount > 0 ? `Missed filings: ${gapCount}.` : "",
    lateCount > 0 ? `Late filings: ${lateCount}.` : "",
    volatilityBucket === "High" ? `High turnover volatility (CV ${Math.round(cv * 100) / 100}).` : "",
    consecutiveDropMonths.length >= 2 ? "Consecutive turnover drop risk detected." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    months,
    avgMonthlyTurnover,
    volatilityScore: cv,
    volatilityBucket,
    seasonalityBucket,
    filingGapCount: gapCount,
    missingMonths,
    lateFilingCount: lateCount,
    lateMonths,
    consecutiveDropMonths,
    flags,
    commentary,
  };
};

const itrYearKey = (label) => {
  const m = String(label || "").match(/(20\d{2})/);
  return m ? Number(m[1]) : 0;
};

const computeItrUnderwriting = (yearsRaw) => {
  const years = (Array.isArray(yearsRaw) ? yearsRaw : [])
    .filter((y) => y && (y.turnover ?? 0) >= 0)
    .slice()
    .sort((a, b) => itrYearKey(a.year) - itrYearKey(b.year));

  const latest = years.slice().sort((a, b) => itrYearKey(b.year) - itrYearKey(a.year))[0] || years[years.length - 1];
  const latestTurnover = num(latest?.turnover);
  const latestProfit = Number(latest?.profit ?? 0);
  const latestMarginPct = latestTurnover > 0 ? (latestProfit / latestTurnover) * 100 : 0;
  const latestTaxPaid = num(latest?.taxPaid);

  const prev = years.slice().sort((a, b) => itrYearKey(b.year) - itrYearKey(a.year)).find((y) => itrYearKey(y.year) < itrYearKey(latest?.year));
  const yoyTurnoverPct = prev && num(prev.turnover) > 0 ? ((latestTurnover - num(prev.turnover)) / num(prev.turnover)) * 100 : null;
  const yoyProfitPct =
    prev && Number(prev.profit ?? 0) !== 0
      ? ((latestProfit - Number(prev.profit ?? 0)) / Math.abs(Number(prev.profit ?? 0))) * 100
      : null;

  const flags = [];
  if (latestMarginPct < 3) flags.push("ITR_MARGIN_THIN");
  if (latestProfit < 0) flags.push("ITR_LOSS");
  if ((yoyTurnoverPct ?? 0) <= -30) flags.push("ITR_INCOME_DECLINE_30");
  if ((yoyTurnoverPct ?? 0) <= -15) flags.push("ITR_TURNOVER_DROP");
  if ((yoyProfitPct ?? 0) <= -20) flags.push("ITR_PROFIT_DROP");
  if (latestProfit > 0 && latestTaxPaid === 0) flags.push("ITR_TAX_ANOMALY");

  const commentary = [
    `ITR latest turnover ₹${formatInr(latestTurnover)}, profit ₹${formatInr(latestProfit)} (margin ${Math.round(latestMarginPct * 10) / 10}%).`,
    yoyTurnoverPct == null ? "" : `YoY turnover ${Math.round(yoyTurnoverPct * 10) / 10}%.`,
    yoyProfitPct == null ? "" : `YoY profit ${Math.round(yoyProfitPct * 10) / 10}%.`,
    latestMarginPct < 3 ? "Margin is thin → higher default sensitivity to any inflow disruption." : "",
    latestProfit < 0 ? "Loss declared → collections must be control-first." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { years, latestTurnover, latestProfit, latestMarginPct, latestTaxPaid, yoyTurnoverPct, yoyProfitPct, flags, commentary };
};

const computeCrossVerification = ({ normalized, avgMonthlyCredits }, gstUw, itrUw) => {
  if (!gstUw && !itrUw) return null;

  const bankByMonth = new Map();
  for (const t of normalized) {
    if (t.credit <= 0) continue;
    const ym = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    bankByMonth.set(ym, (bankByMonth.get(ym) || 0) + t.credit);
  }

  const gstMonths = Array.isArray(gstUw?.months) ? gstUw.months : [];
  const idx = gstMonths.map((m) => monthIndex(m.month)).filter((v) => v != null);
  const byMonth = new Map(gstMonths.map((m) => [String(m.month), m]));

  const rows = [];
  if (idx.length) {
    const minI = Math.min(...idx);
    const maxI = Math.max(...idx);
    for (let i = minI; i <= maxI; i += 1) {
      const ym = monthIndexToYm(i);
      const m = byMonth.get(ym) || null;
      const bankCredits = bankByMonth.get(ym) || 0;
      const gstTurnover = m ? num(m.turnover) : null;
      const diffPct = gstTurnover && gstTurnover > 0 ? ((bankCredits - gstTurnover) / gstTurnover) * 100 : null;
      rows.push({
        month: ym,
        bankCredits,
        gstTurnover,
        gstTaxPaid: m ? num(m.taxPaid) : null,
        gstDaysLate: m ? num(m.daysLate) : null,
        gstFilingStatus: m ? (num(m.daysLate) > 0 ? "Late" : gstTurnover === 0 ? "Nil" : "Filed") : "Missing",
        diffPct,
      });
      if (rows.length >= 36) break;
    }
  }

  const nilReturnMonthsWithBankCredits = rows
    .filter((r) => r.gstTurnover === 0 && num(r.bankCredits) > 0)
    .map((r) => String(r.month));

  const diffs = rows.map((r) => (r.diffPct == null ? null : Math.abs(num(r.diffPct)))).filter((v) => v != null);
  const bankVsGstAvgDiffPct = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;

  const bankVsItrAvgDiffPct =
    itrUw && num(itrUw.latestTurnover) > 0
      ? (() => {
          const itrMonthly = num(itrUw.latestTurnover) / 12;
          if (!itrMonthly) return null;
          return (Math.abs(avgMonthlyCredits - itrMonthly) / itrMonthly) * 100;
        })()
      : null;

  const itrVsGstAnnualEstimated =
    gstUw && Array.isArray(gstUw.months) && gstUw.months.length
      ? (() => {
          const sum = gstUw.months.reduce((acc, m) => acc + Math.max(0, num(m.turnover)), 0);
          const count = Math.max(1, gstUw.months.length);
          return count >= 6 ? Math.round((sum / count) * 12) : Math.round(sum);
        })()
      : null;

  const itrVsGstAnnualDiffPct =
    itrUw && num(itrUw.latestTurnover) > 0 && itrVsGstAnnualEstimated && itrVsGstAnnualEstimated > 0
      ? (Math.abs(num(itrUw.latestTurnover) - itrVsGstAnnualEstimated) / itrVsGstAnnualEstimated) * 100
      : null;

  const mismatchFlags = [];
  if (bankVsGstAvgDiffPct != null && bankVsGstAvgDiffPct > 20) mismatchFlags.push("BANK_VS_GST_MISMATCH");
  if (bankVsItrAvgDiffPct != null && bankVsItrAvgDiffPct > 25) mismatchFlags.push("BANK_VS_ITR_MISMATCH");
  if (itrVsGstAnnualDiffPct != null && itrVsGstAnnualDiffPct > 25) mismatchFlags.push("ITR_VS_GST_MISMATCH");
  if (nilReturnMonthsWithBankCredits.length) mismatchFlags.push("GST_NIL_WITH_BANK_CREDITS");

  const commentary = [
    bankVsGstAvgDiffPct == null ? "" : `Bank vs GST avg mismatch ~${Math.round(bankVsGstAvgDiffPct * 10) / 10}%.`,
    bankVsItrAvgDiffPct == null ? "" : `Bank vs ITR avg mismatch ~${Math.round(bankVsItrAvgDiffPct * 10) / 10}%.`,
    itrVsGstAnnualDiffPct == null ? "" : `ITR vs GST (annualized) mismatch ~${Math.round(itrVsGstAnnualDiffPct * 10) / 10}%.`,
    mismatchFlags.length ? `Mismatch flags: ${mismatchFlags.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    bankVsGstAvgDiffPct,
    bankVsItrAvgDiffPct,
    itrVsGstAnnualDiffPct,
    itrVsGstAnnualEstimated,
    nilReturnMonthsWithBankCredits,
    rows,
    mismatchFlags,
    commentary,
  };
};

const computeCredibilityScore = (gstUw, itrUw, cross) => {
  if (!gstUw && !itrUw && !cross) return null;

  let gstPenalty = 0;
  const gstReasons = [];
  if (gstUw) {
    if (num(gstUw.filingGapCount) > 0) {
      gstPenalty += Math.min(40, num(gstUw.filingGapCount) * 10);
      gstReasons.push("GST missed filings");
    }
    if (num(gstUw.lateFilingCount) >= 2) {
      gstPenalty += Math.min(20, num(gstUw.lateFilingCount) * 5);
      gstReasons.push("Repeated GST late filings");
    }
    if (String(gstUw.volatilityBucket || "") === "High") {
      gstPenalty += 15;
      gstReasons.push("High GST volatility");
    }
    if (Array.isArray(gstUw.consecutiveDropMonths) && gstUw.consecutiveDropMonths.length >= 2) {
      gstPenalty += 20;
      gstReasons.push("GST consecutive turnover drop");
    }
  }

  let itrPenalty = 0;
  const itrReasons = [];
  if (itrUw) {
    const margin = num(itrUw.latestMarginPct);
    if (margin < 3) {
      itrPenalty += margin < 1 ? 20 : 10;
      itrReasons.push("Low ITR margin");
    }
    if (Number(itrUw.latestProfit ?? 0) < 0) {
      itrPenalty += 25;
      itrReasons.push("ITR loss");
    }
    if (num(itrUw.yoyTurnoverPct) <= -30) {
      itrPenalty += 15;
      itrReasons.push("Severe YoY turnover decline");
    }
    if (Number(itrUw.latestProfit ?? 0) > 0 && num(itrUw.latestTaxPaid) === 0) {
      itrPenalty += 10;
      itrReasons.push("Tax anomaly");
    }
  }

  let mismatchPenalty = 0;
  const mismatchReasons = [];

  if (cross) {
    const gstDiff = cross.bankVsGstAvgDiffPct;
    if (gstDiff != null) {
      const v = num(gstDiff);
      if (v > 10) mismatchPenalty += 10;
      if (v > 25) mismatchPenalty += 15;
      if (v > 40) mismatchPenalty += 15;
      if (v > 10) mismatchReasons.push("GST vs Bank mismatch");
    }

    const itrDiff = cross.bankVsItrAvgDiffPct;
    if (itrDiff != null) {
      const v = num(itrDiff);
      if (v > 25) mismatchPenalty += 10;
      if (v > 40) mismatchPenalty += 10;
      if (v > 25) mismatchReasons.push("ITR vs Bank mismatch");
    }

    const itrVsGst = cross.itrVsGstAnnualDiffPct;
    if (itrVsGst != null) {
      const v = num(itrVsGst);
      if (v > 25) mismatchPenalty += 10;
      if (v > 40) mismatchPenalty += 10;
      if (v > 25) mismatchReasons.push("ITR vs GST mismatch");
    }

    if (Array.isArray(cross.nilReturnMonthsWithBankCredits) && cross.nilReturnMonthsWithBankCredits.length) {
      mismatchPenalty += 25;
      mismatchReasons.push("NIL GST with bank credits");
    }
  }

  mismatchPenalty = clamp(mismatchPenalty, 0, 100);

  const gstScore = clamp(100 - gstPenalty, 0, 100);
  const itrScore = clamp(100 - itrPenalty, 0, 100);
  const overall = clamp(Math.round(gstScore * 0.4 + itrScore * 0.4 + (100 - mismatchPenalty) * 0.2), 0, 100);

  const band = overall >= 75 ? "Strong" : overall >= 55 ? "Moderate" : "Weak";

  const reasons = Array.from(new Set([...gstReasons, ...itrReasons, ...mismatchReasons])).slice(0, 5);

  return { score: overall, band, gstScore, itrScore, mismatchPenalty, reasons };
};

const estimateFixedObligationsMonthly = (normalized, statementDays, avgMonthlyCredits) => {
  if (!statementDays) return 0;
  const debits = normalized.filter((t) => t.debit > 0);
  if (!debits.length) return 0;
  const groups = new Map();
  for (const t of debits) {
    const cp = extractCounterparty(t.narration);
    const prev = groups.get(cp) || [];
    prev.push(t);
    groups.set(cp, prev);
  }
  let recurringSum = 0;
  for (const [_, list] of groups.entries()) {
    if (list.length < 2) continue;
    const amounts = list.map((t) => num(t.debit));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const maxDev = Math.max(...amounts.map((a) => Math.abs(a - mean))) / Math.max(1, mean);
    if (maxDev <= 0.12) {
      const sum = list.reduce((s, t) => s + num(t.debit), 0);
      recurringSum += (sum / statementDays) * 30;
    }
  }
  return Math.min(recurringSum, num(avgMonthlyCredits) * 0.8);
};

const riskGrade = (score) => (score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D");

const pricingApr = ({ grade, snapshot, lenders, velocity }) => {
  const baseApr = 30;
  const gradePremium = grade === "A" ? 0 : grade === "B" ? 6 : grade === "C" ? 12 : 18;
  const competitionPremium = lenders.estimatedLenders >= 3 || lenders.weeklyCollectionsDetected ? 6 : 0;
  const disciplinePremium = snapshot.bounceReturnCount >= 2 || snapshot.penaltyChargeCount >= 4 ? 6 : 0;
  const volatilityPremium = snapshot.creditVolatility === "High" ? 4 : 0;
  const velocityPremium = velocity.sameDaySpendRatio >= 0.9 ? 4 : 0;
  return clamp(baseApr + gradePremium + competitionPremium + disciplinePremium + volatilityPremium + velocityPremium, 18, 72);
};

const buildRule = ({ id, name, category, severity, passed, scoreDeltaFail, thresholds, evidence, reasonFail, reasonPass }) => ({
  id,
  name,
  category,
  severity,
  passed: Boolean(passed),
  scoreDelta: passed ? 0 : scoreDeltaFail,
  thresholds: thresholds || {},
  evidence: evidence || {},
  reason: passed ? reasonPass : reasonFail,
});

export function runUnderwriting(transactions, params = {}, docs = {}) {
  if (!Array.isArray(transactions) || transactions.length === 0) throw new Error("No transactions to underwrite.");

  const normalized = transactions
    .map((t) => {
      const date = parseIsoDate(t?.date);
      if (!date) return null;
      return {
        date,
        dateIso: t.date,
        narration: String(t?.narration || "-").trim() || "-",
        debit: Math.max(0, Number(t?.debit || 0)),
        credit: Math.max(0, Number(t?.credit || 0)),
        balance: t?.balance == null ? null : Number(t.balance),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (normalized.length === 0) throw new Error("No usable transactions after normalization.");

  const periodStart = normalized[0].date;
  const periodEnd = normalized[normalized.length - 1].date;
  const statementDays = daysBetweenInclusive(periodStart, periodEnd);

  const requestedExposure = clamp(Number(params.requestedExposure || 5000000), 5000000, 100000000);
  const maxTenureMonths = clamp(Number(params.maxTenureMonths || 12), 1, 12);

  const totalCredits = normalized.reduce((s, t) => s + t.credit, 0);
  const totalDebits = normalized.reduce((s, t) => s + t.debit, 0);
  const avgDailyCredits = totalCredits / statementDays;
  const avgDailyDebits = totalDebits / statementDays;
  const avgWeeklyCredits = avgDailyCredits * 7;
  const avgMonthlyCredits = avgDailyCredits * 30;
  const avgMonthlyDebits = avgDailyDebits * 30;

  const balances = normalized.map((t) => (t.balance == null ? null : Number(t.balance))).filter((v) => typeof v === "number");
  const avgUsableBalance = balances.length ? balances.reduce((a, b) => a + b, 0) / balances.length : 0;
  const minBalance = balances.length ? Math.min(...balances) : 0;

  const dailyCredits = new Map();
  const dailyMinBalance = new Map();
  for (const t of normalized) {
    const k = t.dateIso;
    dailyCredits.set(k, (dailyCredits.get(k) || 0) + t.credit);
    if (t.balance != null) {
      const prev = dailyMinBalance.get(k);
      dailyMinBalance.set(k, prev == null ? t.balance : Math.min(prev, t.balance));
    }
  }

  const dailyCreditValues = [...dailyCredits.values()].map(Number).filter((v) => v > 0);
  const mean = dailyCreditValues.length ? dailyCreditValues.reduce((a, b) => a + b, 0) / dailyCreditValues.length : 0;
  const cv = mean > 0 ? stdevSample(dailyCreditValues) / mean : 0;
  const creditVolatility = cv < 0.35 ? "Low" : cv < 0.75 ? "Medium" : "High";

  const lowBalanceThreshold = Math.max(25000, Math.round(avgMonthlyCredits * 0.05));
  const lowBalanceDays = [...dailyMinBalance.values()].filter((b) => Number(b) < lowBalanceThreshold).length;

  const penaltyChargeCount = normalized.filter((t) => isPenaltyCharge(t.narration)).length;
  const bounceReturnCount = normalized.filter((t) => isBounceOrReturn(t.narration)).length;
  const fixedObligationEstimateMonthly = estimateFixedObligationsMonthly(normalized, statementDays, avgMonthlyCredits);

  // Heat maps
  const buildHeat = (direction) => {
    const total = direction === "credit" ? totalCredits : totalDebits;
    if (!total) return [];
    const map = new Map();
    for (const t of normalized) {
      const amt = direction === "credit" ? t.credit : t.debit;
      if (amt <= 0) continue;
      const cp = extractCounterparty(t.narration);
      const prev = map.get(cp) || { sum: 0, freq: 0 };
      map.set(cp, { sum: prev.sum + amt, freq: prev.freq + 1 });
    }
    const rows = [...map.entries()]
      .sort((a, b) => b[1].sum - a[1].sum)
      .slice(0, 15)
      .map(([cp, v]) => {
        const avgAmt = v.freq ? Math.round(v.sum / v.freq) : 0;
        const pctOfTotal = (v.sum / total) * 100;
        const base = {
          counterparty: cp,
          nature: direction === "credit" ? classifyCreditNature(cp) : classifyDebitType(cp)[0],
          freq: v.freq,
          avgAmt,
          totalAmt: v.sum,
          pctOfTotal,
        };
        if (direction === "credit") {
          const dependency = pctOfTotal >= 40 ? "High" : pctOfTotal >= 20 ? "Medium" : "Low";
          return { ...base, dependency };
        }
        const [, priorityLevel, flexi] = classifyDebitType(cp);
        return { ...base, priorityLevel, flexi };
      });
    return rows;
  };

  const creditHeatMap = buildHeat("credit");
  const debitHeatMap = buildHeat("debit");

  // Private lender competition
  const suspicious = [];
  const byCp = new Map();
  let rolloverSignals = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const t = normalized[i];
    const amount = Math.max(t.debit, t.credit);
    const direction = t.debit > 0 ? "DEBIT" : t.credit > 0 ? "CREDIT" : "OTHER";
    const cp = extractCounterparty(t.narration);
    const score = (isPrivateLenderKeyword(t.narration) ? 2 : 0) + (isRoundFigure(amount) ? 1 : 0) + (amount >= 25000 && amount <= 500000 && amount % 5000 === 0 ? 1 : 0);
    if (score >= 2 && amount > 0) {
      byCp.set(cp, (byCp.get(cp) || 0) + 1);
      if (suspicious.length < 30) suspicious.push({ date: t.dateIso, narration: t.narration.slice(0, 140), direction, amount });
    }
    if (t.credit > 0 && i + 1 < normalized.length) {
      const n = normalized[i + 1];
      const gap = Math.round((n.date.getTime() - t.date.getTime()) / 86400000);
      if (gap >= 0 && gap <= 2 && n.debit > 0) {
        const delta = Math.abs(n.debit - t.credit) / Math.max(1, t.credit);
        if (delta <= 0.08 && (isPrivateLenderKeyword(n.narration) || isPrivateLenderKeyword(t.narration))) rolloverSignals += 1;
      }
    }
  }
  const lenderLike = [...byCp.entries()].filter(([, c]) => c >= 2).map(([cp]) => cp);
  const estimatedLenders = clamp(lenderLike.length, 0, 12);
  const suspiciousDebitSum = suspicious.filter((e) => e.direction === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const approxMonthlyDebtLoad = statementDays ? Math.round((suspiciousDebitSum / statementDays) * 30) : suspiciousDebitSum;

  // Weekly collections detected (cadence)
  const debitDates = normalized.filter((t) => t.debit > 0).map((t) => t.date.getTime()).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < debitDates.length; i += 1) gaps.push(Math.round((debitDates[i] - debitDates[i - 1]) / 86400000));
  const weeklyCollectionsDetected = gaps.filter((g) => g >= 5 && g <= 9).length >= 4;

  const privateLenderCompetition = {
    estimatedLenders,
    approxMonthlyDebtLoad,
    weeklyCollectionsDetected,
    rolloverRecyclingSignals: rolloverSignals,
    evidence: suspicious,
    summary: `Estimated private lenders: ${estimatedLenders}. Approx monthly debt load: ₹${formatInr(approxMonthlyDebtLoad)}.${weeklyCollectionsDetected ? " Weekly collections pattern detected." : ""}${rolloverSignals ? ` Rollover/recycling signals: ${rolloverSignals}.` : ""}`.trim(),
  };

  // Velocity & control
  const daily = new Map();
  for (const t of normalized) {
    const k = t.dateIso;
    const prev = daily.get(k) || { c: 0, d: 0 };
    daily.set(k, { c: prev.c + t.credit, d: prev.d + t.debit });
  }
  const days = [...daily.keys()].sort();
  let sameDaySpend = 0;
  let tPlusOneSpend = 0;
  let creditDays = 0;
  for (let i = 0; i < days.length; i += 1) {
    const { c, d } = daily.get(days[i]) || { c: 0, d: 0 };
    if (c <= 0) continue;
    creditDays += 1;
    sameDaySpend += Math.min(d / c, 1);
    if (i + 1 < days.length) {
      const n = daily.get(days[i + 1]) || { c: 0, d: 0 };
      tPlusOneSpend += Math.min(n.d / c, 1);
    }
  }
  const sameDaySpendRatio = creditDays ? sameDaySpend / creditDays : 0;
  const tPlusOneSpendRatio = creditDays ? tPlusOneSpend / creditDays : 0;
  const idleCashRetentionRatio = avgMonthlyCredits > 0 ? avgUsableBalance / avgMonthlyCredits : 0;

  const weekdayTotals = new Map();
  const monthDayTotals = new Map();
  for (const t of normalized) {
    if (t.credit <= 0) continue;
    const wd = t.date.getDay(); // 0 Sun - 6 Sat
    weekdayTotals.set(wd, (weekdayTotals.get(wd) || 0) + t.credit);
    const md = t.date.getDate();
    monthDayTotals.set(md, (monthDayTotals.get(md) || 0) + t.credit);
  }
  const topInflowWeekdayIdx = [...weekdayTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const topInflowWeekday = weekdayNames[topInflowWeekdayIdx] || "Mon";
  const topInflowMonthDays = [...monthDayTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);

  const borrowerType =
    sameDaySpendRatio >= 0.85 && idleCashRetentionRatio < 0.1
      ? "Pass-through operator (low control, thin margin)"
      : idleCashRetentionRatio >= 0.25
        ? "Cash-retainer (higher control/retention)"
        : creditVolatility === "Low"
          ? "Stable earner / salary-like"
          : "Trader / variable inflow operator";

  const cashVelocityControl = {
    sameDaySpendRatio,
    tPlusOneSpendRatio,
    idleCashRetentionRatio,
    topInflowWeekday,
    topInflowMonthDays,
    borrowerType,
    commentary: `Same-day spend ratio ${pct1(sameDaySpendRatio)}; T+1 spend ratio ${pct1(tPlusOneSpendRatio)}; idle retention ${pct1(idleCashRetentionRatio)}. Classified as: ${borrowerType}.`,
  };

  const topCreditPct = creditHeatMap[0]?.pctOfTotal || 0;
  const top3CreditPct = creditHeatMap.slice(0, 3).reduce((s, r) => s + (r.pctOfTotal || 0), 0);
  const lowBalanceRatio = statementDays ? lowBalanceDays / statementDays : 0;

  const gstUw = docs?.gstMonths?.length ? computeGstUnderwriting(docs.gstMonths) : null;
  const itrUw = docs?.itrYears?.length ? computeItrUnderwriting(docs.itrYears) : null;
  const crossVerification = computeCrossVerification({ normalized, avgMonthlyCredits }, gstUw, itrUw);
  const credibility = computeCredibilityScore(gstUw, itrUw, crossVerification);

  const ruleRunLog = [
    buildRule({
      id: "R001",
      name: "Statement period length",
      category: "Snapshot",
      severity: "Medium",
      passed: statementDays >= 90,
      scoreDeltaFail: -10,
      thresholds: { min_days: 90 },
      evidence: { statement_days: statementDays },
      reasonFail: "Short statement window reduces confidence. Demand tighter structure / staged disbursal.",
      reasonPass: "Sufficient statement window for stability checks.",
    }),
    buildRule({
      id: "R010",
      name: "Credit concentration (Top 1 source)",
      category: "Concentration",
      severity: "High",
      passed: topCreditPct < 40,
      scoreDeltaFail: -18,
      thresholds: { top1_credit_pct_max: 40 },
      evidence: { top1_credit_pct: topCreditPct },
      reasonFail: "Borrower survival depends on 1 inflow. Control collections + cap exposure.",
      reasonPass: "No single inflow dominates the account.",
    }),
    buildRule({
      id: "R011",
      name: "Credit concentration (Top 3 sources)",
      category: "Concentration",
      severity: "Medium",
      passed: top3CreditPct < 70,
      scoreDeltaFail: -10,
      thresholds: { top3_credit_pct_max: 70 },
      evidence: { top3_credit_pct: top3CreditPct },
      reasonFail: "Inflow is concentrated. Stress appears quickly if 1-2 sources pause.",
      reasonPass: "Inflow sources are reasonably distributed.",
    }),
    buildRule({
      id: "R020",
      name: "Liquidity stress (low-balance days)",
      category: "Liquidity",
      severity: "High",
      passed: lowBalanceRatio < 0.2,
      scoreDeltaFail: -18,
      thresholds: { low_balance_days_ratio_max: 0.2 },
      evidence: { low_balance_days: lowBalanceDays, statement_days: statementDays, ratio: lowBalanceRatio },
      reasonFail: "Account frequently hits near-zero. Weekly collections + high upfront deduction required.",
      reasonPass: "Liquidity buffer exists most days.",
    }),
    buildRule({
      id: "R030",
      name: "Banking discipline (penalties/bounces)",
      category: "Discipline",
      severity: "Medium",
      passed: penaltyChargeCount <= 2 && bounceReturnCount <= 1,
      scoreDeltaFail: -12,
      thresholds: { penalty_max: 2, bounce_max: 1 },
      evidence: { penalty_charges: penaltyChargeCount, bounce_returns: bounceReturnCount },
      reasonFail: "Discipline issues indicate payment instability. Price up + shorten tenure.",
      reasonPass: "No major penalty/bounce signal.",
    }),
    buildRule({
      id: "R040",
      name: "Private lender competition",
      category: "Competition",
      severity: "High",
      passed: estimatedLenders <= 2 && !weeklyCollectionsDetected,
      scoreDeltaFail: -22,
      thresholds: { estimated_lenders_max: 2, weekly_collections_allowed: false },
      evidence: { estimated_lenders: estimatedLenders, weekly_collections_detected: weeklyCollectionsDetected },
      reasonFail: "Borrower is likely already stacked with private lenders. Reduce exposure + enforce weekly control.",
      reasonPass: "No strong stacking/weekly-collection signal.",
    }),
    buildRule({
      id: "R050",
      name: "Cash velocity (same-day spend)",
      category: "Velocity",
      severity: "Medium",
      passed: sameDaySpendRatio < 0.85,
      scoreDeltaFail: -10,
      thresholds: { same_day_spend_ratio_max: 0.85 },
      evidence: { same_day_spend_ratio: sameDaySpendRatio },
      reasonFail: "Pass-through behavior: inflows get drained fast. Collections must hit the inflow window.",
      reasonPass: "Cash retention is acceptable.",
    }),
    buildRule({
      id: "R060",
      name: "Fixed obligations pressure",
      category: "Obligations",
      severity: "Medium",
      passed: fixedObligationEstimateMonthly <= avgMonthlyCredits * 0.55,
      scoreDeltaFail: -12,
      thresholds: { fixed_obligation_pct_max: 0.55 },
      evidence: {
        fixed_obligation_estimate_monthly: fixedObligationEstimateMonthly,
        avg_monthly_credits: avgMonthlyCredits,
        ratio: avgMonthlyCredits ? fixedObligationEstimateMonthly / avgMonthlyCredits : 0,
      },
      reasonFail: "High fixed outflows reduce survivability. Keep tenure short + collect weekly.",
      reasonPass: "Obligation load appears manageable.",
    }),
  ];

  // Doc rules (GST/ITR/cross-verification) — deterministic, no ML.
  if (gstUw) {
    ruleRunLog.push(
      buildRule({
        id: "GST-01",
        name: "Missed GST filings (gaps)",
        category: "Discipline",
        severity: "High",
        passed: num(gstUw.filingGapCount) === 0,
        scoreDeltaFail: -18,
        thresholds: { missed_months_max: 0 },
        evidence: { missed_months_count: num(gstUw.filingGapCount), missing_months: Array.isArray(gstUw.missingMonths) ? gstUw.missingMonths : [] },
        reasonFail: "Missed GST filings weaken enforceability and signal compliance risk. Structure tighter and demand proof before exposure.",
        reasonPass: "No obvious missed GST filing gaps in the provided months range.",
      }),
      buildRule({
        id: "GST-02",
        name: "Repeated late GST filings",
        category: "Discipline",
        severity: "Medium",
        passed: num(gstUw.lateFilingCount) <= 1,
        scoreDeltaFail: -10,
        thresholds: { late_months_max: 1 },
        evidence: { late_months_count: num(gstUw.lateFilingCount), late_months: Array.isArray(gstUw.lateMonths) ? gstUw.lateMonths : [] },
        reasonFail: "Repeated late filing indicates weak compliance discipline. Increase control (weekly collections) and reduce discretionary exposure.",
        reasonPass: "Late filing count is within tolerance.",
      }),
      buildRule({
        id: "GST-03",
        name: "GST turnover volatility (high)",
        category: "Snapshot",
        severity: "High",
        passed: String(gstUw.volatilityBucket || "") !== "High",
        scoreDeltaFail: -12,
        thresholds: { volatility_bucket_max: "Medium" },
        evidence: { volatility_score: num(gstUw.volatilityScore), volatility_bucket: String(gstUw.volatilityBucket || ""), seasonality_bucket: String(gstUw.seasonalityBucket || "") },
        reasonFail: "High turnover volatility increases collection miss probability. Prefer weekly collections and staged disbursement.",
        reasonPass: "GST turnover volatility is not flagged as high.",
      }),
      buildRule({
        id: "GST-04",
        name: "Consecutive turnover drop (>30%)",
        category: "Snapshot",
        severity: "Critical",
        passed: !Array.isArray(gstUw.consecutiveDropMonths) || gstUw.consecutiveDropMonths.length < 2,
        scoreDeltaFail: -22,
        thresholds: { drop_pct_min: 30, consecutive_months_min: 2 },
        evidence: { consecutive_drop_months: Array.isArray(gstUw.consecutiveDropMonths) ? gstUw.consecutiveDropMonths : [] },
        reasonFail: "Consecutive sharp turnover drop indicates active stress. Treat as immediate action: cut exposure, shorten tenure, and demand proof of recovery.",
        reasonPass: "No consecutive sharp turnover drop detected.",
      }),
    );
  }

  if (crossVerification?.bankVsGstAvgDiffPct != null) {
    const v = num(crossVerification.bankVsGstAvgDiffPct);
    ruleRunLog.push(
      buildRule({
        id: "GST-05",
        name: "GST vs Bank mismatch",
        category: "Discipline",
        severity: "Critical",
        passed: v <= 25,
        scoreDeltaFail: -18,
        thresholds: { avg_abs_diff_pct_max: 25 },
        evidence: { bank_vs_gst_avg_abs_diff_pct: v },
        reasonFail: "GST vs Bank mismatch is materially high. Treat as control risk (unreported/cash/recycling). Reduce exposure + increase upfront deduction.",
        reasonPass: "GST vs Bank mismatch is within tolerance.",
      }),
    );
  }

  if (crossVerification?.nilReturnMonthsWithBankCredits?.length) {
    ruleRunLog.push(
      buildRule({
        id: "GST-06",
        name: "NIL GST return with active bank credits",
        category: "Discipline",
        severity: "Critical",
        passed: false,
        scoreDeltaFail: -25,
        thresholds: { nil_return_months_with_bank_credits_max: 0 },
        evidence: { months: crossVerification.nilReturnMonthsWithBankCredits },
        reasonFail: "NIL GST returns conflict with active bank credits. This is a hard control red flag. Demand full breakup + compliance proof before any exposure.",
        reasonPass: "N/A",
      }),
    );
  }

  if (itrUw) {
    ruleRunLog.push(
      buildRule({
        id: "ITR-01",
        name: "ITR margin low",
        category: "Snapshot",
        severity: "Medium",
        passed: num(itrUw.latestMarginPct) >= 3,
        scoreDeltaFail: -10,
        thresholds: { margin_pct_min: 3 },
        evidence: { latest_margin_pct: num(itrUw.latestMarginPct), latest_turnover: num(itrUw.latestTurnover), latest_profit: num(itrUw.latestProfit) },
        reasonFail: "Declared margin is low. Any disruption will hit collections quickly. Prefer weekly collections and cap exposure.",
        reasonPass: "Margin is not critically low.",
      }),
      buildRule({
        id: "ITR-02",
        name: "ITR loss business",
        category: "Snapshot",
        severity: "High",
        passed: num(itrUw.latestProfit) >= 0,
        scoreDeltaFail: -20,
        thresholds: { latest_profit_min: 0 },
        evidence: { latest_profit: num(itrUw.latestProfit), latest_turnover: num(itrUw.latestTurnover) },
        reasonFail: "Declared loss in ITR. Collections must be control-first (tight tenure, high upfront, staged).",
        reasonPass: "No loss declared in latest ITR input.",
      }),
    );

    if (itrUw.yoyTurnoverPct != null) {
      const yoy = num(itrUw.yoyTurnoverPct);
      ruleRunLog.push(
        buildRule({
          id: "ITR-03",
          name: "YoY turnover decline >30%",
          category: "Snapshot",
          severity: "High",
          passed: yoy > -30,
          scoreDeltaFail: -16,
          thresholds: { yoy_turnover_pct_min: -30 },
          evidence: { yoy_turnover_pct: yoy },
          reasonFail: "YoY turnover decline is severe. Treat as stress; reduce exposure and shorten tenure aggressively.",
          reasonPass: "YoY turnover decline not flagged as severe.",
        }),
      );
    }

    if (num(itrUw.latestProfit) > 0 && num(itrUw.latestTaxPaid) === 0) {
      ruleRunLog.push(
        buildRule({
          id: "ITR-06",
          name: "Tax anomaly (profit but tax paid = 0)",
          category: "Discipline",
          severity: "High",
          passed: false,
          scoreDeltaFail: -12,
          thresholds: { tax_paid_min_if_profit: 1 },
          evidence: { latest_profit: num(itrUw.latestProfit), latest_tax_paid: num(itrUw.latestTaxPaid) },
          reasonFail: "Profit declared but tax paid is zero. Treat declared statements as weak evidence; demand computation and proof.",
          reasonPass: "N/A",
        }),
      );
    }
  }

  if (crossVerification?.itrVsGstAnnualDiffPct != null) {
    const v = num(crossVerification.itrVsGstAnnualDiffPct);
    ruleRunLog.push(
      buildRule({
        id: "ITR-04",
        name: "ITR vs GST mismatch (annualized)",
        category: "Discipline",
        severity: "Critical",
        passed: v <= 25,
        scoreDeltaFail: -18,
        thresholds: { annual_abs_diff_pct_max: 25 },
        evidence: { itr_vs_gst_annual_abs_diff_pct: v, gst_annual_estimated: num(crossVerification.itrVsGstAnnualEstimated) },
        reasonFail: "ITR vs GST mismatch is high. Treat reported numbers as unreliable; restructure with tighter control and documentary proof.",
        reasonPass: "ITR vs GST mismatch is within tolerance.",
      }),
    );
  }

  if (crossVerification?.bankVsItrAvgDiffPct != null) {
    const v = num(crossVerification.bankVsItrAvgDiffPct);
    ruleRunLog.push(
      buildRule({
        id: "ITR-05",
        name: "ITR vs Bank mismatch",
        category: "Discipline",
        severity: "High",
        passed: v <= 25,
        scoreDeltaFail: -12,
        thresholds: { avg_abs_diff_pct_max: 25 },
        evidence: { bank_vs_itr_avg_abs_diff_pct: v },
        reasonFail: "ITR does not match bank cash power. Treat declared financials as unreliable. Tighten tenure + collections.",
        reasonPass: "ITR vs Bank mismatch is within tolerance.",
      }),
    );
  }

  const score = clamp(100 + ruleRunLog.reduce((s, r) => s + (Number(r.scoreDelta) || 0), 0), 0, 100);
  const grade = riskGrade(score);
  const apr = pricingApr({ grade, snapshot: { bounceReturnCount, penaltyChargeCount, creditVolatility }, lenders: privateLenderCompetition, velocity: cashVelocityControl });

  const monthlyRate = (apr / 12) / 100;
  const exposureFactor = grade === "A" ? 1.0 : grade === "B" ? 0.85 : grade === "C" ? 0.7 : 0.55;
  const cashCap = Math.max(500000, Math.round(avgMonthlyCredits * 1.1));
  const baseRecommended = Math.min(requestedExposure, Math.max(5000000, Math.min(cashCap, requestedExposure)));
  const recommendedExposure = clamp(Math.round(baseRecommended * exposureFactor), 1000000, 100000000);

  const tenureMonths = score >= 80 ? Math.min(maxTenureMonths, 12) : score >= 65 ? Math.min(maxTenureMonths, 10) : score >= 50 ? Math.min(maxTenureMonths, 8) : Math.min(maxTenureMonths, 6);
  const collectionFrequency = grade === "C" || grade === "D" || weeklyCollectionsDetected || estimatedLenders >= 3 ? "Weekly" : "Monthly";

  const upfrontPctBase = grade === "A" ? 0.12 : grade === "B" ? 0.18 : grade === "C" ? 0.28 : 0.38;
  const upfrontDeductionPct = clamp(upfrontPctBase + (estimatedLenders >= 3 ? 0.07 : 0) + (lowBalanceDays > 0 ? 0.03 : 0), 0.1, 0.6);
  const totalInterest = Math.round(recommendedExposure * monthlyRate * tenureMonths);
  const upfrontDeductionAmt = Math.round(totalInterest * upfrontDeductionPct);
  const remainingInterest = Math.max(0, totalInterest - upfrontDeductionAmt);
  const periods = collectionFrequency === "Weekly" ? Math.max(1, tenureMonths * 4) : tenureMonths;
  const principalPerPeriod = Math.round(recommendedExposure / periods);
  const interestPerPeriod = Math.round(remainingInterest / periods);
  const collectionAmount = Math.max(1000, principalPerPeriod + interestPerPeriod);
  const staged = grade === "C" || grade === "D" || estimatedLenders >= 3 || rolloverSignals >= 2;
  const stage1 = staged ? Math.round(recommendedExposure * 0.6) : recommendedExposure;
  const stage2 = staged ? Math.max(0, recommendedExposure - stage1) : 0;

  const structure = {
    schedule_type: "amortized_simple",
    net_disbursed_estimate: recommendedExposure - upfrontDeductionAmt,
    staged_disbursement: staged,
    stage_1_amount: stage1,
    stage_2_amount: stage2,
    stage_2_condition: staged ? "Release only after 2 clean collection cycles + no new lender signals." : "",
    best_collection_weekday: topInflowWeekday.toUpperCase(),
  };

  const recommendation = {
    recommendedExposure,
    tenureMonths,
    collectionFrequency,
    collectionAmount,
    upfrontDeductionPct,
    upfrontDeductionAmt,
    pricingApr: apr,
    structure,
  };

  const triggers = [];
  const lowBalanceHardStop = Math.max(50000, Math.round(avgWeeklyCredits * 0.15));
  const lowBalanceWarn = Math.max(100000, Math.round(avgWeeklyCredits * 0.25));
  triggers.push({
    triggerType: "BALANCE_HARD_STOP",
    severity: "Critical",
    condition: { balance_lt: lowBalanceHardStop },
    description: `Hard-stop: if balance drops below ₹${formatInr(lowBalanceHardStop)}, freeze disbursal/stop rolling and collect immediately.`,
  });
  triggers.push({
    triggerType: "BALANCE_WARN",
    severity: "High",
    condition: { balance_lt: lowBalanceWarn },
    description: `Warning: if balance stays below ₹${formatInr(lowBalanceWarn)} for 2 consecutive days, switch to daily follow-up + tighten collections.`,
  });
  if (estimatedLenders >= 3 || weeklyCollectionsDetected) {
    triggers.push({
      triggerType: "NEW_LENDER_SIGNAL",
      severity: "High",
      condition: { estimated_lenders: estimatedLenders, weekly_collections_detected: weeklyCollectionsDetected },
      description: "Private-lender stacking detected. Any new lender entry/interest payment → immediately re-price + reduce exposure / stop stage-2.",
    });
  }
  if (bounceReturnCount > 0) {
    triggers.push({
      triggerType: "BOUNCE_OR_RETURN",
      severity: "High",
      condition: { bounce_return_count: bounceReturnCount },
      description: "Bounce/return detected. Treat as stress: tighten collection frequency and demand bank-day evidence.",
    });
  }
  if (sameDaySpendRatio >= 0.85) {
    triggers.push({
      triggerType: "SPIKE_THEN_DRAIN",
      severity: "Medium",
      condition: { same_day_spend_ratio_gte: 0.85 },
      description: "Spike-then-drain pattern. Collections must align with peak inflow day(s) only.",
    });
  }
  triggers.push({
    triggerType: "COLLECTION_MISS",
    severity: "Critical",
    condition: { miss_count_gte: 1 },
    description: "Any 1 missed collection → classify as early default risk and move to recovery mode (no comfort).",
  });

  // Doc triggers (GST/ITR/cross-verification)
  if (gstUw && (num(gstUw.filingGapCount) > 0 || num(gstUw.lateFilingCount) >= 2)) {
    triggers.push({
      triggerType: "GST_DISCIPLINE",
      severity: num(gstUw.filingGapCount) > 0 ? "High" : "Medium",
      condition: { filing_gap_count: num(gstUw.filingGapCount), late_filing_count: num(gstUw.lateFilingCount) },
      description: "GST discipline risk: gaps/late filings. Any further non-compliance → freeze enhancements and move to control collections.",
    });
  }
  if (crossVerification?.bankVsGstAvgDiffPct != null && num(crossVerification.bankVsGstAvgDiffPct) > 25) {
    const v = num(crossVerification.bankVsGstAvgDiffPct);
    triggers.push({
      triggerType: "BANK_GST_MISMATCH",
      severity: v > 35 ? "Critical" : "High",
      condition: { avg_abs_diff_pct: v },
      description: "Bank vs GST mismatch elevated. Any new lender/cash-recycling signal → reduce exposure immediately.",
    });
  }
  if (crossVerification?.bankVsItrAvgDiffPct != null && num(crossVerification.bankVsItrAvgDiffPct) > 25) {
    const v = num(crossVerification.bankVsItrAvgDiffPct);
    triggers.push({
      triggerType: "BANK_ITR_MISMATCH",
      severity: v > 40 ? "Critical" : "High",
      condition: { avg_abs_diff_pct: v },
      description: "Bank vs ITR mismatch elevated. Treat ITR as weak evidence and rely on cash-control collections.",
    });
  }
  if (crossVerification?.itrVsGstAnnualDiffPct != null && num(crossVerification.itrVsGstAnnualDiffPct) > 25) {
    const v = num(crossVerification.itrVsGstAnnualDiffPct);
    triggers.push({
      triggerType: "ITR_GST_MISMATCH",
      severity: v > 40 ? "Critical" : "High",
      condition: { annual_abs_diff_pct: v, gst_annual_estimated: num(crossVerification.itrVsGstAnnualEstimated) },
      description: "ITR vs GST mismatch elevated. Reported numbers are unreliable → tighten structure and demand reconciliation proof.",
    });
  }
  if (crossVerification?.nilReturnMonthsWithBankCredits?.length) {
    triggers.push({
      triggerType: "GST_NIL_WITH_BANK_CREDITS",
      severity: "Critical",
      condition: { months: crossVerification.nilReturnMonthsWithBankCredits },
      description: "NIL GST returns conflict with active bank credits. Demand breakup + compliance proof before any exposure enhancement.",
    });
  }
  if (itrUw && num(itrUw.latestMarginPct) < 3) {
    triggers.push({
      triggerType: "ITR_MARGIN_THIN",
      severity: "Medium",
      condition: { latest_margin_pct_lt: 3, latest_margin_pct: num(itrUw.latestMarginPct) },
      description: "Thin margin: small shocks can trigger missed collections. Keep exposure capped; collect weekly.",
    });
  }

  const topSource = creditHeatMap[0]?.counterparty || "primary inflow";
  const topPct = creditHeatMap[0]?.pctOfTotal || 0;
  const riskFit = score >= 70 ? "Accept" : score >= 50 ? "AcceptWithControl" : "Avoid";
  const stressDays = topPct >= 60 ? 7 : topPct >= 40 ? 10 : 14;
  const recoveryLeverageSummary = `${topPct >= 40 ? `Recovery leverage weak: inflow concentrated in ${topSource} (${Math.round(topPct)}% of credits).` : "Recovery leverage moderate: no single inflow dominates."}${estimatedLenders >= 3 ? " Competition high: stacked with private lenders → recovery contest likely." : ""}${lowBalanceDays > 0 ? " Liquidity buffer thin → faster default if inflow pauses." : ""}`.trim();
  const streetSummary = `Borrower survives on ${topSource} inflow (~${Math.round(topPct)}% of credits). If disrupted, stress appears within ~${stressDays} days. ${collectionFrequency} collections must align on ${structure.best_collection_weekday}. Exposure beyond ₹${formatInr(recommendedExposure)} materially increases recovery risk.`;

  const verdict = {
    riskFit,
    riskGrade: grade,
    score,
    streetSummary,
    recoveryLeverageSummary,
  };

  const metrics = [
    { key: "total_credits", value: totalCredits, unit: "INR" },
    { key: "total_debits", value: totalDebits, unit: "INR" },
    { key: "avg_monthly_credits", value: avgMonthlyCredits, unit: "INR" },
    { key: "avg_monthly_debits", value: avgMonthlyDebits, unit: "INR" },
    { key: "avg_weekly_credits", value: avgWeeklyCredits, unit: "INR" },
    { key: "avg_usable_balance", value: avgUsableBalance, unit: "INR" },
    { key: "min_balance", value: minBalance, unit: "INR" },
    { key: "low_balance_days", value: lowBalanceDays, unit: "DAYS" },
    { key: "credit_volatility_score", value: cv, unit: "", meta: { bucket: creditVolatility } },
    { key: "penalty_charge_count", value: penaltyChargeCount, unit: "COUNT" },
    { key: "bounce_return_count", value: bounceReturnCount, unit: "COUNT" },
    { key: "fixed_obligation_estimate_monthly", value: fixedObligationEstimateMonthly, unit: "INR" },
  ];

  if (gstUw) {
    const gstTaxPaidTotal = (gstUw.months || []).reduce((s, m) => s + Math.max(0, num(m?.taxPaid)), 0);
    metrics.push(
      { key: "gst_avg_monthly_turnover", value: num(gstUw.avgMonthlyTurnover), unit: "INR" },
      {
        key: "gst_volatility_score",
        value: num(gstUw.volatilityScore),
        unit: "",
        meta: { bucket: String(gstUw.volatilityBucket || ""), seasonality: String(gstUw.seasonalityBucket || "") },
      },
      { key: "gst_filing_gap_count", value: num(gstUw.filingGapCount), unit: "COUNT" },
      { key: "gst_missing_months_count", value: Array.isArray(gstUw.missingMonths) ? gstUw.missingMonths.length : num(gstUw.filingGapCount), unit: "COUNT" },
      { key: "gst_late_filing_count", value: num(gstUw.lateFilingCount), unit: "COUNT" },
      { key: "gst_consecutive_drop_months_count", value: Array.isArray(gstUw.consecutiveDropMonths) ? gstUw.consecutiveDropMonths.length : 0, unit: "COUNT" },
      { key: "gst_tax_paid_total", value: gstTaxPaidTotal, unit: "INR" },
    );
  }

  if (itrUw) {
    metrics.push(
      { key: "itr_latest_turnover", value: num(itrUw.latestTurnover), unit: "INR" },
      { key: "itr_latest_profit", value: num(itrUw.latestProfit), unit: "INR" },
      { key: "itr_latest_margin_pct", value: num(itrUw.latestMarginPct), unit: "PCT" },
      { key: "itr_latest_tax_paid", value: num(itrUw.latestTaxPaid), unit: "INR" },
    );
    if (itrUw.yoyTurnoverPct != null) metrics.push({ key: "itr_yoy_turnover_pct", value: num(itrUw.yoyTurnoverPct), unit: "PCT" });
    if (itrUw.yoyProfitPct != null) metrics.push({ key: "itr_yoy_profit_pct", value: num(itrUw.yoyProfitPct), unit: "PCT" });
  }

  if (crossVerification) {
    if (crossVerification.bankVsGstAvgDiffPct != null) metrics.push({ key: "bank_vs_gst_avg_diff_pct", value: num(crossVerification.bankVsGstAvgDiffPct), unit: "PCT" });
    if (crossVerification.bankVsItrAvgDiffPct != null) metrics.push({ key: "bank_vs_itr_avg_diff_pct", value: num(crossVerification.bankVsItrAvgDiffPct), unit: "PCT" });
    if (crossVerification.itrVsGstAnnualDiffPct != null) metrics.push({ key: "itr_vs_gst_annual_diff_pct", value: num(crossVerification.itrVsGstAnnualDiffPct), unit: "PCT" });
    if (crossVerification.itrVsGstAnnualEstimated != null) metrics.push({ key: "gst_annual_estimated_from_months", value: num(crossVerification.itrVsGstAnnualEstimated), unit: "INR" });
    if (Array.isArray(crossVerification.nilReturnMonthsWithBankCredits))
      metrics.push({ key: "gst_nil_months_with_bank_credits_count", value: crossVerification.nilReturnMonthsWithBankCredits.length, unit: "COUNT" });
  }

  if (credibility) {
    metrics.push(
      { key: "credibility_score", value: num(credibility.score), unit: "SCORE", meta: { band: String(credibility.band || "") } },
      { key: "credibility_gst_score", value: num(credibility.gstScore), unit: "SCORE" },
      { key: "credibility_itr_score", value: num(credibility.itrScore), unit: "SCORE" },
      { key: "credibility_mismatch_penalty", value: num(credibility.mismatchPenalty), unit: "SCORE" },
    );
  }

  const aggressiveSummary = [
    `AGGRESSIVE VERDICT: ${riskFit === "AcceptWithControl" ? "Accept with Control" : riskFit} | Grade ${grade} | Score ${score}`,
    `Recommended Exposure: ₹${formatInr(recommendedExposure)} | Pricing: ${apr}% APR | Collections: ${collectionFrequency} ₹${formatInr(collectionAmount)}`,
    `Cash power: avg monthly credits ₹${formatInr(Math.round(avgMonthlyCredits))}. Top inflow source: ${topSource} (${Math.round(topPct)}%). ${estimatedLenders ? `Private lenders estimated: ${estimatedLenders}.` : ""} Upfront interest deduction: ${Math.round(upfrontDeductionPct * 100)}% (₹${formatInr(upfrontDeductionAmt)}).`,
    crossVerification?.mismatchFlags?.length
      ? `Cross-check: ${crossVerification.bankVsGstAvgDiffPct != null ? `Bank↔GST avg diff ${pct1(num(crossVerification.bankVsGstAvgDiffPct))}; ` : ""}${crossVerification.bankVsItrAvgDiffPct != null ? `Bank↔ITR avg diff ${pct1(num(crossVerification.bankVsItrAvgDiffPct))}; ` : ""}Flags: ${crossVerification.mismatchFlags.join(", ")}.`
      : "",
    credibility
      ? `Credibility: ${credibility.score}/100 (${credibility.band}). ${Array.isArray(credibility.reasons) && credibility.reasons.length ? `Reasons: ${credibility.reasons.join(", ")}.` : ""}`.trim()
      : "",
  ].join("\n");

  return {
    periodStart: normalized[0].dateIso,
    periodEnd: normalized[normalized.length - 1].dateIso,
    statementDays,
    bankName: "",
    accountType: "",
    metrics,
    creditHeatMap,
    debitHeatMap,
    gst: gstUw,
    itr: itrUw,
    crossVerification,
    credibility,
    privateLenderCompetition,
    cashVelocityControl,
    triggers,
    recommendation,
    verdict,
    ruleRunLog: ruleRunLog.map((r) => ({
      ...r,
      // Align with shared enums naming used in storage
      category: r.category,
      severity: r.severity,
    })),
    aggressiveSummary,
  };
}
