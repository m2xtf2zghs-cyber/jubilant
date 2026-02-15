package com.jubilant.lirasnative.shared.pd

import com.jubilant.lirasnative.shared.underwriting.UnderwritingResult
import com.jubilant.lirasnative.shared.underwriting.UwRuleRun
import com.jubilant.lirasnative.shared.underwriting.UwSeverity
import kotlin.math.roundToLong
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Deterministic (no-ML) question generator that converts underwriting outcomes into "PD Doubts".
 *
 * Principle: capital protection > borrower comfort. Questions are blunt and evidence-backed.
 */
object DynamicDoubtsGenerator {
  private fun sevOrder(s: PdDoubtSeverity): Int =
    when (s) {
      PdDoubtSeverity.ImmediateAction -> 3
      PdDoubtSeverity.HighRisk -> 2
      PdDoubtSeverity.Alert -> 1
    }

  private fun findRule(uw: UnderwritingResult, id: String): UwRuleRun? = uw.ruleRunLog.firstOrNull { it.id == id }

  private fun findRuleAny(uw: UnderwritingResult, ids: List<String>): UwRuleRun? {
    for (id in ids) {
      val r = findRule(uw, id)
      if (r != null) return r
    }
    return null
  }

  private fun jsonRuleEvidence(rule: UwRuleRun?): JsonObject =
    buildJsonObject {
      if (rule == null) return@buildJsonObject
      put("rule_id", rule.id)
      put("rule_name", rule.name)
      put("rule_category", rule.category.name)
      put("rule_severity", rule.severity.name)
      put("passed", rule.passed)
      put("score_delta", rule.scoreDelta)
      put("thresholds", rule.thresholds)
      put("evidence", rule.evidence)
      put("reason", rule.reason)
    }

  private fun evidenceTxsJson(uw: UnderwritingResult, limit: Int = 10): JsonArray =
    buildJsonArray {
      for (t in uw.privateLenderCompetition.evidence.take(limit)) {
        add(
          buildJsonObject {
            put("date", t.date)
            put("narration", t.narration)
            put("direction", t.direction)
            put("amount", t.amount)
          },
        )
      }
    }

  /**
   * Generates deterministic doubts from an [UnderwritingResult].
   *
   * @param coveredCodes If a question code appears here, it will be returned with `coveredByPd=true` so UI can hide it.
   */
  fun generate(uw: UnderwritingResult, coveredCodes: Set<String> = emptySet()): List<PdGeneratedQuestion> {
    val out = mutableListOf<PdGeneratedQuestion>()

    fun add(q: PdGeneratedQuestion) {
      out += q.copy(coveredByPd = q.code in coveredCodes)
    }

    // 1) Counterparty concentration (Top-1)
    val top = uw.creditHeatMap.firstOrNull()
    if (top != null && top.pctOfTotal >= 40.0) {
      val r010 = findRule(uw, "R010")
      add(
        PdGeneratedQuestion(
          code = "D010_TOP1_CREDIT_CONCENTRATION",
          severity = if (top.pctOfTotal >= 60.0) PdDoubtSeverity.ImmediateAction else PdDoubtSeverity.HighRisk,
          category = "Concentration",
          questionText =
            "Top inflow source contributes ~${top.pctOfTotal.roundToLong()}% of credits (${top.counterparty}). " +
              "Explain the relationship and provide contract/order proof. What happens if this inflow stops for 30 days?",
          answerType = PdAnswerType.Text,
          requiredUploadHint = "Upload contract / work order / invoice proof",
          evidence =
            buildJsonObject {
              put("top_counterparty", top.counterparty)
              put("top_credit_pct", top.pctOfTotal)
              put("rule", jsonRuleEvidence(r010))
            },
          sourceRuleId = r010?.id,
        ),
      )
    }

    // 2) GST filing gaps / late filings
    uw.gst?.let { gst ->
      if (gst.filingGapCount > 0) {
        val r = findRuleAny(uw, listOf("GST-01", "R070"))
        add(
          PdGeneratedQuestion(
            code = "D200_GST_MISSED_FILINGS",
            severity = PdDoubtSeverity.HighRisk,
            category = "GST",
            questionText =
              "Missing GST filings detected for months: ${gst.missingMonths.take(12).joinToString(", ")}. " +
                "Explain why these months were missed. Confirm current compliance status and share filing acknowledgements/challans.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload GSTR-3B filing acknowledgements + tax payment challans",
            evidence =
              buildJsonObject {
                put("missed_months_count", gst.filingGapCount)
                put("missing_months", gst.missingMonths.joinToString(","))
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }

      if (gst.lateFilingCount >= 2) {
        val r = findRuleAny(uw, listOf("GST-02", "R070"))
        add(
          PdGeneratedQuestion(
            code = "D201_GST_LATE_FILINGS",
            severity = PdDoubtSeverity.Alert,
            category = "GST",
            questionText =
              "Repeated late GST filings detected (late months: ${gst.lateMonths.take(12).joinToString(", ")}). " +
                "Why were returns filed late repeatedly? Confirm how you will avoid delays going forward.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload filing acknowledgement for the last 3 months",
            evidence =
              buildJsonObject {
                put("late_months_count", gst.lateFilingCount)
                put("late_months", gst.lateMonths.joinToString(","))
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }

      if (gst.volatilityBucket == "High") {
        val r = findRuleAny(uw, listOf("GST-03"))
        add(
          PdGeneratedQuestion(
            code = "D202_GST_VOLATILITY_HIGH",
            severity = PdDoubtSeverity.HighRisk,
            category = "GST",
            questionText =
              "GST turnover volatility is HIGH (CV ~${(gst.volatilityScore * 100.0).roundToLong() / 100.0}). " +
                "Explain seasonality/contract cycles. Provide top customer list and expected inflow rhythm for the next 3 months.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload top customer list / contracts (optional)",
            evidence =
              buildJsonObject {
                put("volatility_score", gst.volatilityScore)
                put("volatility_bucket", gst.volatilityBucket)
                put("seasonality_bucket", gst.seasonalityBucket)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }

      if (gst.consecutiveDropMonths.size >= 2) {
        val r = findRuleAny(uw, listOf("GST-04"))
        add(
          PdGeneratedQuestion(
            code = "D203_GST_CONSECUTIVE_DROP",
            severity = PdDoubtSeverity.ImmediateAction,
            category = "GST",
            questionText =
              "Turnover dropped >30% for consecutive months (${gst.consecutiveDropMonths.joinToString(", ")}). " +
                "Explain root cause and recovery plan. Provide proof of current month stabilization (orders/invoices).",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload latest orders / invoices / work orders (recommended)",
            evidence =
              buildJsonObject {
                put("consecutive_drop_months", gst.consecutiveDropMonths.joinToString(","))
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }
    }

    // 3) Bank vs GST mismatch
    uw.crossVerification?.bankVsGstAvgDiffPct?.let { diff ->
      if (diff > 25.0) {
        val r = findRuleAny(uw, listOf("GST-05", "R071"))
        add(
          PdGeneratedQuestion(
            code = "D021_BANK_VS_GST_MISMATCH",
            severity = if (diff > 35.0) PdDoubtSeverity.ImmediateAction else PdDoubtSeverity.HighRisk,
            category = "Cross Verification",
            questionText =
              "Bank credits diverge from GST turnover by ~${(diff * 10.0).roundToLong() / 10.0}%. " +
                "Break-up: cash sales? inter-account transfers? loan inflows? Provide supporting documents and explain the variance.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload sales register / cash sales proof / transfer mapping",
            evidence =
              buildJsonObject {
                put("bank_vs_gst_avg_abs_diff_pct", diff)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }
    }

    // 3B) NIL GST returns but bank credits exist
    uw.crossVerification?.nilReturnMonthsWithBankCredits?.takeIf { it.isNotEmpty() }?.let { months ->
      val r = findRuleAny(uw, listOf("GST-06"))
      add(
        PdGeneratedQuestion(
          code = "D204_GST_NIL_WITH_BANK_CREDITS",
          severity = PdDoubtSeverity.ImmediateAction,
          category = "GST",
          questionText =
            "NIL GST returns but active bank credits detected for months: ${months.joinToString(", ")}. " +
              "Explain nature of receipts (cash sales/transfers/loans/refunds) and confirm compliance position with proof.",
          answerType = PdAnswerType.Text,
          requiredUploadHint = "Upload reconciliation + GST filing proof / CA note",
          evidence =
            buildJsonObject {
              put("months", months.joinToString(","))
              put("rule", jsonRuleEvidence(r))
            },
          sourceRuleId = r?.id,
        ),
      )
    }

    // 4) Bank vs ITR mismatch
    uw.crossVerification?.bankVsItrAvgDiffPct?.let { diff ->
      if (diff > 25.0) {
        val r = findRuleAny(uw, listOf("ITR-05", "R072"))
        add(
          PdGeneratedQuestion(
            code = "D022_BANK_VS_ITR_MISMATCH",
            severity = if (diff > 40.0) PdDoubtSeverity.ImmediateAction else PdDoubtSeverity.HighRisk,
            category = "Cross Verification",
            questionText =
              "Bank cash power diverges from ITR by ~${(diff * 10.0).roundToLong() / 10.0}%. " +
                "Explain declared turnover/profit vs actual bank movement. Provide computation summary and reconciliations.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload ITR computation + financials + reconciliation notes",
            evidence =
              buildJsonObject {
                put("bank_vs_itr_avg_abs_diff_pct", diff)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }
    }

    // 5) Private lender stacking / rollovers
    run {
      val plc = uw.privateLenderCompetition
      if (plc.estimatedLenders >= 2 || plc.weeklyCollectionsDetected || plc.rolloverRecyclingSignals >= 2) {
        val r040 = findRule(uw, "R040")
        add(
          PdGeneratedQuestion(
            code = "D030_PRIVATE_LENDER_STACKING",
            severity = if (plc.estimatedLenders >= 3 || plc.weeklyCollectionsDetected) PdDoubtSeverity.ImmediateAction else PdDoubtSeverity.HighRisk,
            category = "Competition",
            questionText =
              "We detected private-lender competition/repayment signals. List ALL lenders, outstanding, weekly/monthly commitments and next due dates. " +
                "Confirm if any rollovers/recycling are happening.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload lender list / promissory notes / repayment schedule proof",
            evidence =
              buildJsonObject {
                put("estimated_lenders", plc.estimatedLenders)
                put("approx_monthly_debt_load", plc.approxMonthlyDebtLoad)
                put("weekly_collections_detected", plc.weeklyCollectionsDetected)
                put("rollover_recycling_signals", plc.rolloverRecyclingSignals)
                put("evidence_txs", evidenceTxsJson(uw))
                put("rule", jsonRuleEvidence(r040))
              },
            sourceRuleId = r040?.id,
          ),
        )
      }
    }

    // 6) Spike-then-drain / pass-through
    if (uw.cashVelocityControl.sameDaySpendRatio >= 0.85) {
      val r050 = findRule(uw, "R050")
      add(
        PdGeneratedQuestion(
          code = "D040_SPIKE_THEN_DRAIN",
          severity = PdDoubtSeverity.HighRisk,
          category = "Cash Control",
          questionText =
            "Spike-then-drain behavior detected (same-day spend ~${((uw.cashVelocityControl.sameDaySpendRatio) * 1000.0).roundToLong() / 10.0}%). " +
              "Who controls outflows? Is this pass-through trading? Share top suppliers + payment terms and confirm margin buffer.",
          answerType = PdAnswerType.Text,
          evidence =
            buildJsonObject {
              put("same_day_spend_ratio", uw.cashVelocityControl.sameDaySpendRatio)
              put("idle_cash_retention_ratio", uw.cashVelocityControl.idleCashRetentionRatio)
              put("borrower_type", uw.cashVelocityControl.borrowerType)
              put("rule", jsonRuleEvidence(r050))
            },
          sourceRuleId = r050?.id,
        ),
      )
    }

    // 7) Penalty/return/bounce indicators
    run {
      val r030 = findRule(uw, "R030")
      if (r030 != null && !r030.passed) {
        add(
          PdGeneratedQuestion(
            code = "D050_PENALTY_BOUNCE_RETURN",
            severity = PdDoubtSeverity.HighRisk,
            category = "Discipline",
            questionText =
              "Penalty/bounce/return indicators present. Explain root cause and corrective actions taken. Provide proof of settlement and updated discipline.",
            answerType = PdAnswerType.Text,
            evidence = buildJsonObject { put("rule", jsonRuleEvidence(r030)) },
            sourceRuleId = r030.id,
          ),
        )
      }
    }

    // 8) Fixed obligations pressure
    run {
      val r060 = findRule(uw, "R060")
      if (r060 != null && !r060.passed) {
        add(
          PdGeneratedQuestion(
            code = "D060_FIXED_OBLIGATIONS_PRESSURE",
            severity = PdDoubtSeverity.HighRisk,
            category = "Obligations",
            questionText =
              "Fixed debits appear high versus inflows. Which obligations are non-negotiable? Can any be deferred for the next 90 days to protect collections?",
            answerType = PdAnswerType.Text,
            evidence = buildJsonObject { put("rule", jsonRuleEvidence(r060)) },
            sourceRuleId = r060.id,
          ),
        )
      }
    }

    // 9) Liquidity stress (low balance days)
    run {
      val r020 = findRule(uw, "R020")
      if (r020 != null && !r020.passed) {
        add(
          PdGeneratedQuestion(
            code = "D061_LIQUIDITY_STRESS",
            severity = PdDoubtSeverity.ImmediateAction,
            category = "Liquidity",
            questionText =
              "Account hits near-zero too often. Explain cash buffer plan and what will ensure weekly/monthly collections do not miss. " +
                "Confirm emergency funding options and backup inflow sources.",
            answerType = PdAnswerType.Text,
            evidence = buildJsonObject { put("rule", jsonRuleEvidence(r020)) },
            sourceRuleId = r020.id,
          ),
        )
      }
    }

    // 10) ITR margin thin
    uw.itr?.let { itr ->
      if (itr.latestMarginPct < 3.0) {
        val r = findRuleAny(uw, listOf("ITR-01", "R073"))
        add(
          PdGeneratedQuestion(
            code = "D070_ITR_MARGIN_THIN",
            severity = PdDoubtSeverity.Alert,
            category = "ITR",
            questionText =
              "Declared margin is thin (latest ~${(itr.latestMarginPct * 10.0).roundToLong() / 10.0}%). " +
                "Explain how you will absorb collection pressure without disrupting business. Provide gross margin and supplier credit terms.",
            answerType = PdAnswerType.Text,
            evidence =
              buildJsonObject {
                put("itr_latest_turnover", itr.latestTurnover)
                put("itr_latest_profit", itr.latestProfit)
                put("itr_latest_margin_pct", itr.latestMarginPct)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }

      if (itr.latestProfit < 0) {
        val r = findRuleAny(uw, listOf("ITR-02"))
        add(
          PdGeneratedQuestion(
            code = "D210_ITR_LOSS_BUSINESS",
            severity = PdDoubtSeverity.HighRisk,
            category = "ITR",
            questionText =
              "Declared loss in ITR. Explain how repayments will be serviced. Provide current month proof of profitability (sales + margin) and corrective actions taken.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload current month sales proof / provisional P&L (optional)",
            evidence =
              buildJsonObject {
                put("itr_latest_profit", itr.latestProfit)
                put("itr_latest_turnover", itr.latestTurnover)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }

      val yoy = itr.yoyTurnoverPct
      if (yoy != null && yoy <= -30.0) {
        val r = findRuleAny(uw, listOf("ITR-03"))
        add(
          PdGeneratedQuestion(
            code = "D211_ITR_INCOME_DECLINE",
            severity = PdDoubtSeverity.HighRisk,
            category = "ITR",
            questionText =
              "YoY income/turnover declined >30% (${(yoy * 10.0).roundToLong() / 10.0}%). Explain decline and current stabilization plan. Provide proof of current pipeline/orders.",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload order book / pipeline proof (optional)",
            evidence =
              buildJsonObject {
                put("itr_yoy_turnover_pct", yoy)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }

      if (itr.latestProfit > 0 && itr.latestTaxPaid == 0L) {
        val r = findRuleAny(uw, listOf("ITR-06"))
        add(
          PdGeneratedQuestion(
            code = "D213_ITR_TAX_ANOMALY",
            severity = PdDoubtSeverity.HighRisk,
            category = "ITR",
            questionText =
              "Profit exists but tax paid is zero in ITR. Explain reason (loss set-off, exemptions, filing status) and provide proof (computation + CA note).",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload ITR computation + CA note (recommended)",
            evidence =
              buildJsonObject {
                put("itr_latest_profit", itr.latestProfit)
                put("itr_latest_tax_paid", itr.latestTaxPaid)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }
    }

    // 11) ITR vs GST mismatch (annualized)
    uw.crossVerification?.itrVsGstAnnualDiffPct?.let { diff ->
      if (diff > 25.0) {
        val r = findRuleAny(uw, listOf("ITR-04"))
        add(
          PdGeneratedQuestion(
            code = "D212_ITR_VS_GST_MISMATCH",
            severity = PdDoubtSeverity.ImmediateAction,
            category = "Cross Verification",
            questionText =
              "ITR vs GST turnover mismatch is ~${(diff * 10.0).roundToLong() / 10.0}%. Provide reconciliation and explanation (cash sales, transfers, unbilled receipts).",
            answerType = PdAnswerType.Text,
            requiredUploadHint = "Upload reconciliation sheet / CA note",
            evidence =
              buildJsonObject {
                put("itr_vs_gst_annual_abs_diff_pct", diff)
                put("rule", jsonRuleEvidence(r))
              },
            sourceRuleId = r?.id,
          ),
        )
      }
    }

    // Sort: ImmediateAction > HighRisk > Alert; stable by code.
    return out.sortedWith(compareByDescending<PdGeneratedQuestion> { sevOrder(it.severity) }.thenBy { it.code })
  }

  fun mapUwSeverity(severity: UwSeverity): PdDoubtSeverity =
    when (severity) {
      UwSeverity.Critical -> PdDoubtSeverity.ImmediateAction
      UwSeverity.High -> PdDoubtSeverity.HighRisk
      UwSeverity.Medium -> PdDoubtSeverity.Alert
      UwSeverity.Low -> PdDoubtSeverity.Alert
      UwSeverity.Info -> PdDoubtSeverity.Alert
    }
}
