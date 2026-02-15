package com.jubilant.lirasnative.shared.underwriting

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
enum class UwSeverity {
  Info,
  Low,
  Medium,
  High,
  Critical,
}

@Serializable
enum class UwRuleCategory {
  Snapshot,
  Concentration,
  Liquidity,
  Discipline,
  Competition,
  Velocity,
  Obligations,
  Structure,
  Pricing,
  Triggers,
}

@Serializable
enum class UwCollectionFrequency {
  Weekly,
  Monthly,
}

@Serializable
enum class UwRiskFit {
  Accept,
  AcceptWithControl,
  Avoid,
}

@Serializable
data class UwGstMonth(
  /** yyyy-MM */
  val month: String,
  /** Reported GST turnover / taxable value (₹). */
  val turnover: Long,
  /** Optional GST tax paid for the month (₹). */
  val taxPaid: Long = 0,
  /** Optional filing date (ISO). */
  val filedOn: String? = null,
  /** Optional computed delay (days). */
  val daysLate: Int? = null,
)

@Serializable
data class UwGstUnderwriting(
  val months: List<UwGstMonth>,
  val avgMonthlyTurnover: Long,
  val volatilityScore: Double,
  val volatilityBucket: String = "Unknown",
  val seasonalityBucket: String = "Unknown",
  val filingGapCount: Int,
  /** yyyy-MM list (may be truncated for payload size). */
  val missingMonths: List<String> = emptyList(),
  val lateFilingCount: Int,
  /** yyyy-MM list. */
  val lateMonths: List<String> = emptyList(),
  /** yyyy-MM list where turnover dropped >30% vs previous month (consecutive drop risk). */
  val consecutiveDropMonths: List<String> = emptyList(),
  val flags: List<String>,
  val commentary: String,
)

@Serializable
data class UwItrYear(
  /** FY/AY label (string as-is). */
  val year: String,
  val turnover: Long,
  val profit: Long,
  /** Optional tax paid (₹). */
  val taxPaid: Long = 0,
)

@Serializable
data class UwItrUnderwriting(
  val years: List<UwItrYear>,
  val latestTurnover: Long,
  val latestProfit: Long,
  val latestMarginPct: Double,
  val latestTaxPaid: Long = 0,
  val yoyTurnoverPct: Double? = null,
  val yoyProfitPct: Double? = null,
  val flags: List<String>,
  val commentary: String,
)

@Serializable
data class UwCrossVerifyRow(
  /** yyyy-MM */
  val month: String,
  val bankCredits: Long,
  val gstTurnover: Long,
  val diffPct: Double? = null,
)

@Serializable
data class UwCrossVerification(
  val bankVsGstAvgDiffPct: Double? = null,
  val bankVsItrAvgDiffPct: Double? = null,
  val itrVsGstAnnualDiffPct: Double? = null,
  val itrVsGstAnnualEstimated: Long? = null,
  /** Months where GST turnover is zero but bank credits are present. */
  val nilReturnMonthsWithBankCredits: List<String> = emptyList(),
  val rows: List<UwCrossVerifyRow> = emptyList(),
  val mismatchFlags: List<String> = emptyList(),
  val commentary: String = "",
)

@Serializable
data class UwCredibilityScore(
  /** 0–100 */
  val score: Int,
  /** Strong / Moderate / Weak */
  val band: String,
  /** 0–100 */
  val gstScore: Int,
  /** 0–100 */
  val itrScore: Int,
  /** 0–100 (higher = worse) */
  val mismatchPenalty: Int,
  /** Short, blunt reasons driving the score. */
  val reasons: List<String> = emptyList(),
)

@Serializable
data class UwDocsInput(
  val gstMonths: List<UwGstMonth> = emptyList(),
  val itrYears: List<UwItrYear> = emptyList(),
)

@Serializable
data class UwTransaction(
  /** ISO date: yyyy-MM-dd */
  val date: String,
  val narration: String,
  val debit: Long = 0,
  val credit: Long = 0,
  val balance: Long? = null,
) {
  init {
    require(debit >= 0) { "debit must be >= 0" }
    require(credit >= 0) { "credit must be >= 0" }
  }
}

@Serializable
data class UwParams(
  /** Requested exposure (₹). If missing/0, engine uses ₹50L as baseline. */
  val requestedExposure: Long = 50_00_000,
  /** Max tenure constraint (months). Hard-capped to 12 by engine. */
  val maxTenureMonths: Int = 12,
)

@Serializable
data class UwMetric(
  val key: String,
  val value: Double,
  val unit: String = "",
  val period: String = "",
  val meta: JsonObject? = null,
)

@Serializable
data class UwCounterpartyRow(
  val counterparty: String,
  val nature: String,
  val freq: Int,
  val avgAmt: Long,
  val totalAmt: Long,
  val pctOfTotal: Double,
  val dependency: String = "",
  val priorityLevel: String = "",
  val flexi: String = "",
)

@Serializable
data class UwEvidenceTx(
  val date: String,
  val narration: String,
  val direction: String, // "DEBIT" | "CREDIT"
  val amount: Long,
)

@Serializable
data class UwPrivateLenderCompetition(
  val estimatedLenders: Int,
  val approxMonthlyDebtLoad: Long,
  val weeklyCollectionsDetected: Boolean,
  val rolloverRecyclingSignals: Int,
  val evidence: List<UwEvidenceTx>,
  val summary: String,
)

@Serializable
data class UwCashVelocityControl(
  val sameDaySpendRatio: Double,
  val tPlusOneSpendRatio: Double,
  val idleCashRetentionRatio: Double,
  val topInflowWeekday: String,
  val topInflowMonthDays: List<Int>,
  val borrowerType: String,
  val commentary: String,
)

@Serializable
data class UwEarlyWarningTrigger(
  val triggerType: String,
  val severity: UwSeverity,
  val condition: JsonObject,
  val description: String,
)

@Serializable
data class UwRecommendation(
  val recommendedExposure: Long,
  val tenureMonths: Int,
  val collectionFrequency: UwCollectionFrequency,
  val collectionAmount: Long,
  val upfrontDeductionPct: Double,
  val upfrontDeductionAmt: Long,
  val pricingApr: Double,
  val structure: JsonObject,
)

@Serializable
data class UwVerdict(
  val riskFit: UwRiskFit,
  val riskGrade: String,
  val score: Int,
  val streetSummary: String,
  val recoveryLeverageSummary: String,
)

@Serializable
data class UwRuleRun(
  val id: String,
  val name: String,
  val category: UwRuleCategory,
  val severity: UwSeverity,
  val passed: Boolean,
  val scoreDelta: Int,
  val thresholds: JsonObject,
  val evidence: JsonObject,
  val reason: String,
)

@Serializable
data class UnderwritingResult(
  val periodStart: String,
  val periodEnd: String,
  val statementDays: Int,
  val bankName: String = "",
  val accountType: String = "",
  val credibility: UwCredibilityScore? = null,
  val metrics: List<UwMetric>,
  val creditHeatMap: List<UwCounterpartyRow>,
  val debitHeatMap: List<UwCounterpartyRow>,
  val gst: UwGstUnderwriting? = null,
  val itr: UwItrUnderwriting? = null,
  val crossVerification: UwCrossVerification? = null,
  val privateLenderCompetition: UwPrivateLenderCompetition,
  val cashVelocityControl: UwCashVelocityControl,
  val triggers: List<UwEarlyWarningTrigger>,
  val recommendation: UwRecommendation,
  val verdict: UwVerdict,
  val ruleRunLog: List<UwRuleRun>,
  val aggressiveSummary: String,
)
