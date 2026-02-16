package com.jubilant.lirasnative.shared.statement

import kotlinx.serialization.Serializable

@Serializable
enum class RawLineType {
  TRANSACTION,
  NON_TXN_LINE,
}

@Serializable
enum class StatementParseStatus {
  READY,
  PARSE_FAILED,
}

@Serializable
data class RawStatementLine(
  val id: String,
  val pageNo: Int,
  val rowNo: Int,
  val rawRowText: String,
  val rawDateText: String? = null,
  val rawNarrationText: String? = null,
  val rawDrText: String? = null,
  val rawCrText: String? = null,
  val rawBalanceText: String? = null,
  val rawLineType: RawLineType = RawLineType.NON_TXN_LINE,
  val extractionMethod: String? = null,
  val bboxJson: String? = null,
)

@Serializable
data class NormalizedTransaction(
  val id: String,
  val rawLineIds: List<String>,
  val date: String,
  val month: String,
  val narration: String,
  val dr: Long,
  val cr: Long,
  val balance: Long? = null,
  val counterpartyNorm: String,
  val txnType: String,
  val category: String,
  val flags: List<String> = emptyList(),
  val transactionUid: String,
)

@Serializable
data class MonthlyAggregate(
  val month: String,
  val creditCount: Int,
  val creditTotal: Long,
  val debitCount: Int,
  val debitTotal: Long,
  val cashDeposits: Long,
  val cashWithdrawals: Long,
  val penaltyCharges: Int,
  val bounces: Int,
  val balanceOn10th: Long?,
  val balanceOn20th: Long?,
  val balanceOnLast: Long?,
  val overdrawnDays: Int,
  val volatilityScore: Double,
)

@Serializable
data class CounterpartyAggregate(
  val name: String,
  val total: Long,
  val count: Int,
  val avg: Long,
  val pct: Double,
  val type: String,
)

@Serializable
data class BalanceContinuityFailure(
  val index: Int,
  val prevBalance: Long?,
  val expected: Long?,
  val actual: Long?,
  val diff: Long?,
)

@Serializable
data class StatementReconciliation(
  val totalRawLines: Int,
  val totalTxnLines: Int,
  val normalizedCount: Int,
  val unmappedLineIds: List<String>,
  val continuityFailures: List<BalanceContinuityFailure>,
  val parseConfidence: Double,
  val status: StatementParseStatus,
)

@Serializable
data class StatementAutopilotResult(
  val rawLines: List<RawStatementLine>,
  val transactions: List<NormalizedTransaction>,
  val monthlyAggregates: List<MonthlyAggregate>,
  val creditHeat: List<CounterpartyAggregate>,
  val debitHeat: List<CounterpartyAggregate>,
  val reconciliation: StatementReconciliation,
  val categories: Map<String, List<NormalizedTransaction>>,
  val analysisNotes: List<String> = emptyList(),
)
