// Deterministic doubts generator (web copy of KMP DynamicDoubtsGenerator).
// Capital protection > borrower comfort. No ML.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const severityOrder = (s) => (s === "Immediate Action" ? 3 : s === "High Risk" ? 2 : 1);

const pct1 = (v) => `${Math.round(num(v) * 10) / 10}%`;

const pickRule = (uw, id) => (uw?.ruleRunLog || []).find((r) => r?.id === id) || null;
const pickRuleAny = (uw, ids = []) => {
  for (const id of ids) {
    const r = pickRule(uw, id);
    if (r) return r;
  }
  return null;
};

export function generateDynamicDoubts(uw, { coveredCodes = [] } = {}) {
  const covered = new Set(coveredCodes || []);
  const out = [];

  const add = (q) => out.push({ ...q, coveredByPd: covered.has(q.code) });

  const top = (uw?.creditHeatMap || [])[0] || null;
  if (top && num(top.pctOfTotal) >= 40) {
    const r010 = pickRule(uw, "R010");
    add({
      code: "D010_TOP1_CREDIT_CONCENTRATION",
      severity: num(top.pctOfTotal) >= 60 ? "Immediate Action" : "High Risk",
      category: "Concentration",
      question_text: `Top inflow source contributes ~${Math.round(num(top.pctOfTotal))}% of credits (${top.counterparty}). Explain the relationship and provide contract/order proof. What happens if this inflow stops for 30 days?`,
      answer_type: "text",
      required_upload_hint: "Upload contract / work order / invoice proof",
      evidence_json: { top_counterparty: top.counterparty, top_credit_pct: num(top.pctOfTotal), rule: r010 || null },
      source_rule_id: r010?.id || null,
    });
  }

  const gst = uw?.gst || null;
  if (gst && num(gst.filingGapCount) > 0) {
    const r = pickRuleAny(uw, ["GST-01", "R070"]);
    const missing = Array.isArray(gst.missingMonths) ? gst.missingMonths : [];
    add({
      code: "D200_GST_MISSED_FILINGS",
      severity: "High Risk",
      category: "GST",
      question_text: `Missing GST filings detected for months: ${missing.slice(0, 12).join(", ") || "(unknown months)"}. Explain why these months were missed. Confirm current compliance status and share filing acknowledgements/challans.`,
      answer_type: "text",
      required_upload_hint: "Upload GSTR-3B filing acknowledgements + tax payment challans",
      evidence_json: { missed_months_count: num(gst.filingGapCount), missing_months: missing, rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  if (gst && num(gst.lateFilingCount) >= 2) {
    const r = pickRuleAny(uw, ["GST-02", "R070"]);
    const late = Array.isArray(gst.lateMonths) ? gst.lateMonths : [];
    add({
      code: "D201_GST_LATE_FILINGS",
      severity: "Alert",
      category: "GST",
      question_text: `Repeated late GST filings detected (late months: ${late.slice(0, 12).join(", ") || "unknown"}). Why repeated delays? Confirm how you will avoid delays going forward.`,
      answer_type: "text",
      required_upload_hint: "Upload CA note / compliance plan (optional)",
      evidence_json: { late_months_count: num(gst.lateFilingCount), late_months: late, rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  if (gst && String(gst.volatilityBucket || "") === "High") {
    const r = pickRuleAny(uw, ["GST-03"]);
    add({
      code: "D202_GST_VOLATILITY_HIGH",
      severity: "High Risk",
      category: "GST",
      question_text: `GST turnover volatility is HIGH (CV ~${Math.round(num(gst.volatilityScore) * 100) / 100}). Explain seasonality/contract cycles. Provide top customer list and expected inflow rhythm for the next 3 months.`,
      answer_type: "text",
      required_upload_hint: "Upload top customer list / contracts (optional)",
      evidence_json: { volatility_score: num(gst.volatilityScore), volatility_bucket: String(gst.volatilityBucket || ""), seasonality_bucket: String(gst.seasonalityBucket || ""), rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  if (gst && Array.isArray(gst.consecutiveDropMonths) && gst.consecutiveDropMonths.length >= 2) {
    const r = pickRuleAny(uw, ["GST-04"]);
    add({
      code: "D203_GST_CONSECUTIVE_DROP",
      severity: "Immediate Action",
      category: "GST",
      question_text: `Turnover dropped >30% for consecutive months (${gst.consecutiveDropMonths.join(", ")}). Explain root cause and recovery plan. Provide proof of current month stabilization (orders/invoices).`,
      answer_type: "text",
      required_upload_hint: "Upload latest orders / invoices / work orders (recommended)",
      evidence_json: { consecutive_drop_months: gst.consecutiveDropMonths, rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  const cross = uw?.crossVerification || null;
  if (cross && num(cross.bankVsGstAvgDiffPct) > 25) {
    const r071 = pickRuleAny(uw, ["GST-05", "R071"]);
    const diff = num(cross.bankVsGstAvgDiffPct);
    add({
      code: "D021_BANK_VS_GST_MISMATCH",
      severity: diff > 35 ? "Immediate Action" : "High Risk",
      category: "Cross Verification",
      question_text: `Bank credits diverge from GST turnover by ~${pct1(diff)}. Break-up: cash sales? inter-account transfers? loan inflows? Provide supporting documents and explain the variance.`,
      answer_type: "text",
      required_upload_hint: "Upload sales register / cash sales proof / transfer mapping",
      evidence_json: { bank_vs_gst_avg_abs_diff_pct: diff, rule: r071 || null },
      source_rule_id: r071?.id || null,
    });
  }

  if (cross && Array.isArray(cross.nilReturnMonthsWithBankCredits) && cross.nilReturnMonthsWithBankCredits.length) {
    const r = pickRuleAny(uw, ["GST-06"]);
    add({
      code: "D204_GST_NIL_WITH_BANK_CREDITS",
      severity: "Immediate Action",
      category: "GST",
      question_text: `NIL GST returns but active bank credits detected for months: ${cross.nilReturnMonthsWithBankCredits.join(", ")}. Explain nature of receipts (cash sales/transfers/loans/refunds) and confirm compliance position with proof.`,
      answer_type: "text",
      required_upload_hint: "Upload reconciliation + GST filing proof / CA note",
      evidence_json: { months: cross.nilReturnMonthsWithBankCredits, rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  if (cross && num(cross.bankVsItrAvgDiffPct) > 25) {
    const r072 = pickRuleAny(uw, ["ITR-05", "R072"]);
    const diff = num(cross.bankVsItrAvgDiffPct);
    add({
      code: "D022_BANK_VS_ITR_MISMATCH",
      severity: diff > 40 ? "Immediate Action" : "High Risk",
      category: "Cross Verification",
      question_text: `Bank cash power diverges from ITR by ~${pct1(diff)}. Explain declared turnover/profit vs actual bank movement. Provide computation summary and reconciliations.`,
      answer_type: "text",
      required_upload_hint: "Upload ITR computation + financials + reconciliation notes",
      evidence_json: { bank_vs_itr_avg_abs_diff_pct: diff, rule: r072 || null },
      source_rule_id: r072?.id || null,
    });
  }

  if (cross && num(cross.itrVsGstAnnualDiffPct) > 25) {
    const r = pickRuleAny(uw, ["ITR-04"]);
    const diff = num(cross.itrVsGstAnnualDiffPct);
    add({
      code: "D212_ITR_VS_GST_MISMATCH",
      severity: "Immediate Action",
      category: "Cross Verification",
      question_text: `ITR vs GST turnover mismatch is ~${pct1(diff)} (annualized). Provide reconciliation and explanation. Upload supporting working/CA note.`,
      answer_type: "text",
      required_upload_hint: "Upload reconciliation + CA note",
      evidence_json: { itr_vs_gst_annual_abs_diff_pct: diff, gst_annual_estimated: num(cross.itrVsGstAnnualEstimated), rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  const plc = uw?.privateLenderCompetition || null;
  if (plc && (num(plc.estimatedLenders) >= 2 || plc.weeklyCollectionsDetected || num(plc.rolloverRecyclingSignals) >= 2)) {
    const r040 = pickRule(uw, "R040");
    add({
      code: "D030_PRIVATE_LENDER_STACKING",
      severity: num(plc.estimatedLenders) >= 3 || plc.weeklyCollectionsDetected ? "Immediate Action" : "High Risk",
      category: "Competition",
      question_text: `We detected private-lender competition/repayment signals. List ALL lenders, outstanding, weekly/monthly commitments and next due dates. Confirm if any rollovers/recycling are happening.`,
      answer_type: "text",
      required_upload_hint: "Upload lender list / promissory notes / repayment schedule proof",
      evidence_json: {
        estimated_lenders: num(plc.estimatedLenders),
        approx_monthly_debt_load: num(plc.approxMonthlyDebtLoad),
        weekly_collections_detected: Boolean(plc.weeklyCollectionsDetected),
        rollover_recycling_signals: num(plc.rolloverRecyclingSignals),
        evidence_txs: Array.isArray(plc.evidence) ? plc.evidence.slice(0, 10) : [],
        rule: r040 || null,
      },
      source_rule_id: r040?.id || null,
    });
  }

  const vel = uw?.cashVelocityControl || null;
  if (vel && num(vel.sameDaySpendRatio) >= 0.85) {
    const r050 = pickRule(uw, "R050");
    add({
      code: "D040_SPIKE_THEN_DRAIN",
      severity: "High Risk",
      category: "Cash Control",
      question_text: `Spike-then-drain behavior detected (same-day spend ~${pct1(num(vel.sameDaySpendRatio) * 100)}). Who controls outflows? Is this pass-through trading? Share top suppliers + payment terms and confirm margin buffer.`,
      answer_type: "text",
      evidence_json: {
        same_day_spend_ratio: num(vel.sameDaySpendRatio),
        idle_cash_retention_ratio: num(vel.idleCashRetentionRatio),
        borrower_type: vel.borrowerType || "",
        rule: r050 || null,
      },
      source_rule_id: r050?.id || null,
    });
  }

  const r030 = pickRule(uw, "R030");
  if (r030 && r030.passed === false) {
    add({
      code: "D050_PENALTY_BOUNCE_RETURN",
      severity: "High Risk",
      category: "Discipline",
      question_text: `Penalty/bounce/return indicators present. Explain root cause and corrective actions taken. Provide proof of settlement and updated discipline.`,
      answer_type: "text",
      evidence_json: { rule: r030 },
      source_rule_id: "R030",
    });
  }

  const r060 = pickRule(uw, "R060");
  if (r060 && r060.passed === false) {
    add({
      code: "D060_FIXED_OBLIGATIONS_PRESSURE",
      severity: "High Risk",
      category: "Obligations",
      question_text: `Fixed debits appear high versus inflows. Which obligations are non-negotiable? Can any be deferred for the next 90 days to protect collections?`,
      answer_type: "text",
      evidence_json: { rule: r060 },
      source_rule_id: "R060",
    });
  }

  const r020 = pickRule(uw, "R020");
  if (r020 && r020.passed === false) {
    add({
      code: "D061_LIQUIDITY_STRESS",
      severity: "Immediate Action",
      category: "Liquidity",
      question_text: `Account hits near-zero too often. Explain cash buffer plan and what will ensure weekly/monthly collections do not miss. Confirm emergency funding options and backup inflow sources.`,
      answer_type: "text",
      evidence_json: { rule: r020 },
      source_rule_id: "R020",
    });
  }

  const itr = uw?.itr || null;
  if (itr && num(itr.latestMarginPct) < 3) {
    const r073 = pickRuleAny(uw, ["ITR-01", "R073"]);
    add({
      code: "D070_ITR_MARGIN_THIN",
      severity: "Alert",
      category: "ITR",
      question_text: `Declared margin is thin (latest ~${pct1(num(itr.latestMarginPct))}). Explain how you will absorb collection pressure without disrupting business. Provide gross margin and supplier credit terms.`,
      answer_type: "text",
      evidence_json: {
        itr_latest_turnover: num(itr.latestTurnover),
        itr_latest_profit: num(itr.latestProfit),
        itr_latest_margin_pct: num(itr.latestMarginPct),
        rule: r073 || null,
      },
      source_rule_id: r073?.id || null,
    });
  }

  if (itr && Number(itr.latestProfit ?? 0) < 0) {
    const r = pickRuleAny(uw, ["ITR-02"]);
    add({
      code: "D210_ITR_LOSS_BUSINESS",
      severity: "High Risk",
      category: "ITR",
      question_text: `Declared loss in ITR. Explain how repayments will be serviced. Provide current month proof of profitability and cash buffer plan.`,
      answer_type: "text",
      required_upload_hint: "Upload latest management accounts / invoices / bank proof",
      evidence_json: { itr_latest_turnover: num(itr.latestTurnover), itr_latest_profit: num(itr.latestProfit), rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  if (itr && num(itr.yoyTurnoverPct) <= -30) {
    const r = pickRuleAny(uw, ["ITR-03"]);
    add({
      code: "D211_ITR_INCOME_DECLINE",
      severity: "High Risk",
      category: "ITR",
      question_text: `YoY turnover declined >30% (${Math.round(num(itr.yoyTurnoverPct) * 10) / 10}%). Explain decline and current stabilization plan. Provide proof of current month recovery.`,
      answer_type: "text",
      required_upload_hint: "Upload current month invoices/orders (recommended)",
      evidence_json: { yoy_turnover_pct: num(itr.yoyTurnoverPct), rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  if (itr && Number(itr.latestProfit ?? 0) > 0 && num(itr.latestTaxPaid) === 0) {
    const r = pickRuleAny(uw, ["ITR-06"]);
    add({
      code: "D213_ITR_TAX_ANOMALY",
      severity: "High Risk",
      category: "ITR",
      question_text: `Profit exists but tax paid = 0 (as per provided ITR inputs). Explain reason and provide computation/proof.`,
      answer_type: "text",
      required_upload_hint: "Upload ITR computation / CA note",
      evidence_json: { itr_latest_profit: num(itr.latestProfit), itr_latest_tax_paid: num(itr.latestTaxPaid), rule: r || null },
      source_rule_id: r?.id || null,
    });
  }

  return out.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity) || String(a.code).localeCompare(String(b.code)));
}
