package com.jubilant.lirasnative.shared.statement

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

object StatementAutopilotEngine {
  fun run(
    rawLines: List<RawStatementLine>,
    bankName: String? = null,
    accountType: String? = null,
  ): StatementAutopilotResult {
    val normalizedInput = rawLines.sortedWith(compareBy({ it.pageNo }, { it.rowNo }))
    val (adjustedLines, txnsRaw) = normalizeLines(normalizedInput, bankName, accountType)
    val txns = applySpikeDrainFlags(txnsRaw)

    val reconciliation = reconcile(adjustedLines, txns)
    val categories = txns.groupBy { it.category }
    val creditHeat = buildHeatMap(txns.filter { it.cr > 0 }, "CREDIT")
    val debitHeat = buildHeatMap(txns.filter { it.dr > 0 }, "DEBIT")
    val monthlyAggregates = buildMonthlyAggregates(txns)
    val analysisNotes = buildAnalysisNotes(monthlyAggregates)

    return StatementAutopilotResult(
      rawLines = adjustedLines,
      transactions = txns,
      monthlyAggregates = monthlyAggregates,
      creditHeat = creditHeat,
      debitHeat = debitHeat,
      reconciliation = reconciliation,
      categories = categories,
      analysisNotes = analysisNotes,
    )
  }

  private data class TxBuilder(
    val id: String,
    val rawLineIds: MutableList<String>,
    var date: String,
    var narration: String,
    var dr: Long,
    var cr: Long,
    var balance: Long?,
    var pageNo: Int,
    var rowNo: Int,
  )

  private fun normalizeLines(
    rawLines: List<RawStatementLine>,
    bankName: String?,
    accountType: String?,
  ): Pair<List<RawStatementLine>, List<NormalizedTransaction>> {
    val outputLines = rawLines.toMutableList()
    val transactions = mutableListOf<NormalizedTransaction>()
    var current: TxBuilder? = null
    var seq = 0

    fun finishCurrent() {
      val tx = current ?: return
      val month = tx.date.take(7)
      val counterparty = normalizeCounterparty(tx.narration)
      val category = categorize(tx.narration, tx.dr, tx.cr, counterparty)
      val flags = buildFlags(tx.narration, tx.dr, tx.cr)
      val uidBase =
        listOf(
          bankName.orEmpty(),
          accountType.orEmpty(),
          tx.date,
          tx.dr.toString(),
          tx.cr.toString(),
          tx.balance?.toString().orEmpty(),
          tx.narration,
          tx.pageNo.toString(),
          tx.rowNo.toString(),
        ).joinToString("|")
      val uid = fnv1a(uidBase)
      transactions +=
        NormalizedTransaction(
          id = "txn_${seq++}",
          rawLineIds = tx.rawLineIds.toList(),
          date = tx.date,
          month = month,
          narration = tx.narration.ifBlank { "-" },
          dr = tx.dr,
          cr = tx.cr,
          balance = tx.balance,
          counterpartyNorm = counterparty,
          txnType = if (tx.cr > 0) "CREDIT" else if (tx.dr > 0) "DEBIT" else "UNKNOWN",
          category = category,
          flags = flags,
          transactionUid = uid,
        )
      current = null
    }

    for ((idx, line) in rawLines.withIndex()) {
      val date = extractDate(line.rawDateText ?: line.rawRowText)
      val amounts = extractAmounts(line.rawRowText, line.rawDrText, line.rawCrText, line.rawBalanceText)
      val narrationText =
        line.rawNarrationText
          ?: line.rawRowText
            .replace(Regex("\\s+"), " ")
            .trim()
      if (date != null) {
        finishCurrent()
        val updated = line.copy(rawLineType = RawLineType.TRANSACTION)
        outputLines[idx] = updated
        current =
          TxBuilder(
            id = "raw_${line.pageNo}_${line.rowNo}",
            rawLineIds = mutableListOf(line.id),
            date = date,
            narration = stripDateFromNarration(narrationText),
            dr = amounts.first,
            cr = amounts.second,
            balance = amounts.third,
            pageNo = line.pageNo,
            rowNo = line.rowNo,
          )
      } else if (current != null) {
        val updated = line.copy(rawLineType = RawLineType.TRANSACTION)
        outputLines[idx] = updated
        current?.rawLineIds?.add(line.id)
        if (narrationText.isNotBlank()) {
          current?.narration = listOf(current?.narration.orEmpty(), narrationText).joinToString(" ").trim()
        }
      } else {
        outputLines[idx] = line.copy(rawLineType = RawLineType.NON_TXN_LINE)
      }
    }
    finishCurrent()

    return outputLines to transactions
  }

  private fun reconcile(
    rawLines: List<RawStatementLine>,
    txns: List<NormalizedTransaction>,
  ): StatementReconciliation {
    val txnLineIds = txns.flatMap { it.rawLineIds }.toSet()
    val txnLines = rawLines.filter { it.rawLineType == RawLineType.TRANSACTION }
    val unmapped = txnLines.filter { !txnLineIds.contains(it.id) }.map { it.id }

    val continuity = mutableListOf<BalanceContinuityFailure>()
    var prevBalance: Long? = null
    txns.forEachIndexed { idx, tx ->
      val bal = tx.balance
      if (bal != null && prevBalance != null) {
        val expected = prevBalance!! + tx.cr - tx.dr
        val diff = abs(bal - expected)
        if (diff > 5L) {
          continuity += BalanceContinuityFailure(idx, prevBalance, expected, bal, diff)
        }
      }
      if (bal != null) prevBalance = bal
    }

    val confidence =
      if (txnLines.isEmpty()) 0.0
      else ((txnLines.size - unmapped.size).toDouble() / txnLines.size.toDouble()).coerceIn(0.0, 1.0)
    val status = if (unmapped.isEmpty()) StatementParseStatus.READY else StatementParseStatus.PARSE_FAILED

    return StatementReconciliation(
      totalRawLines = rawLines.size,
      totalTxnLines = txnLines.size,
      normalizedCount = txns.size,
      unmappedLineIds = unmapped,
      continuityFailures = continuity,
      parseConfidence = confidence,
      status = status,
    )
  }

  private fun buildHeatMap(txns: List<NormalizedTransaction>, type: String): List<CounterpartyAggregate> {
    if (txns.isEmpty()) return emptyList()
    val total = txns.sumOf { if (type == "CREDIT") it.cr else it.dr }.toDouble().coerceAtLeast(1.0)
    return txns
      .groupBy { it.counterpartyNorm.ifBlank { "UNKNOWN" } }
      .mapValues { (_, rows) ->
        val sum = rows.sumOf { if (type == "CREDIT") it.cr else it.dr }
        val count = rows.size
        val avg = if (count == 0) 0L else (sum.toDouble() / count.toDouble()).roundToLong()
        Triple(sum, count, avg)
      }
      .map { (name, triple) ->
        CounterpartyAggregate(
          name = name,
          total = triple.first,
          count = triple.second,
          avg = triple.third,
          pct = (triple.first.toDouble() / total) * 100.0,
          type = type,
        )
      }
      .sortedByDescending { it.total }
  }

  private fun buildMonthlyAggregates(txns: List<NormalizedTransaction>): List<MonthlyAggregate> {
    if (txns.isEmpty()) return emptyList()
    return txns.groupBy { it.month }.map { (month, rows) ->
      val credits = rows.filter { it.cr > 0 }
      val debits = rows.filter { it.dr > 0 }
      val cashDeposits = credits.filter { it.category == "CASH" }.sumOf { it.cr }
      val cashWithdrawals = debits.filter { it.category == "CASH" }.sumOf { it.dr }
      val penaltyCharges = rows.count { it.category == "BANK_FIN" && it.flags.contains("PENALTY") }
      val bounces = rows.count { it.category == "RETURN" }
      val balances = rows.mapNotNull { it.balance }
      val balanceOn10 = balanceOnDay(rows, 10)
      val balanceOn20 = balanceOnDay(rows, 20)
      val balanceOnLast = balances.lastOrNull()
      val overdrawnDays = rows.count { (it.balance ?: 0L) < 0L }
      val volatility = computeVolatility(rows.map { it.cr })
      MonthlyAggregate(
        month = month,
        creditCount = credits.size,
        creditTotal = credits.sumOf { it.cr },
        debitCount = debits.size,
        debitTotal = debits.sumOf { it.dr },
        cashDeposits = cashDeposits,
        cashWithdrawals = cashWithdrawals,
        penaltyCharges = penaltyCharges,
        bounces = bounces,
        balanceOn10th = balanceOn10,
        balanceOn20th = balanceOn20,
        balanceOnLast = balanceOnLast,
        overdrawnDays = overdrawnDays,
        volatilityScore = volatility,
      )
    }.sortedBy { it.month }
  }

  private fun buildAnalysisNotes(monthly: List<MonthlyAggregate>): List<String> {
    if (monthly.isEmpty()) return emptyList()
    val highestCredit = monthly.maxByOrNull { it.creditTotal }
    val worstVol = monthly.maxByOrNull { it.volatilityScore }
    val notes = mutableListOf<String>()
    if (highestCredit != null) notes += "Peak credits in ${highestCredit.month}: ${highestCredit.creditTotal}"
    if (worstVol != null) notes += "Highest volatility in ${worstVol.month}: ${"%.2f".format(worstVol.volatilityScore)}"
    return notes
  }

  private fun balanceOnDay(rows: List<NormalizedTransaction>, day: Int): Long? {
    val row = rows.firstOrNull { it.date.takeLast(2) == day.toString().padStart(2, '0') }
    return row?.balance
  }

  private fun computeVolatility(values: List<Long>): Double {
    val clean = values.filter { it > 0 }
    if (clean.size < 2) return 0.0
    val mean = clean.average()
    val variance = clean.sumOf { (it - mean) * (it - mean) } / (clean.size - 1).toDouble()
    return kotlin.math.sqrt(variance) / mean
  }

  private fun extractDate(raw: String?): String? {
    val s = raw?.trim().orEmpty()
    if (s.isBlank()) return null
    val m1 = Regex("(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})").find(s)
    if (m1 != null) {
      val dd = m1.groupValues[1].padStart(2, '0')
      val mm = m1.groupValues[2].padStart(2, '0')
      val yy = m1.groupValues[3]
      val yyyy = if (yy.length == 2) "20$yy" else yy
      return "$yyyy-$mm-$dd"
    }
    val m2 = Regex("(\\d{4})-(\\d{2})-(\\d{2})").find(s)
    return m2?.value
  }

  private fun extractAmounts(
    rawRow: String?,
    rawDr: String?,
    rawCr: String?,
    rawBal: String?,
  ): Triple<Long, Long, Long?> {
    fun parseMoney(input: String?): Long? {
      val clean = input?.replace(",", "")?.replace("₹", "")?.trim().orEmpty()
      if (clean.isBlank()) return null
      return clean.toDoubleOrNull()?.roundToLong()
    }

    val dr = parseMoney(rawDr) ?: 0L
    val cr = parseMoney(rawCr) ?: 0L
    val bal = parseMoney(rawBal)

    if (dr > 0 || cr > 0 || bal != null) return Triple(dr, cr, bal)

    val nums =
      Regex("-?\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d{1,2})?")
        .findAll(rawRow.orEmpty())
        .mapNotNull { parseMoney(it.value) }
        .toList()
    if (nums.isEmpty()) return Triple(0L, 0L, null)
    val balanceGuess = nums.lastOrNull()
    val others = if (nums.size >= 2) nums.dropLast(1) else emptyList()
    val candidate = others.lastOrNull()
    val maybeDr = candidate?.takeIf { it > 0 } ?: 0L
    val maybeCr = if (maybeDr == 0L && others.size >= 2) others[others.size - 2] else 0L
    return Triple(maybeDr, maybeCr, balanceGuess)
  }

  private fun stripDateFromNarration(narration: String): String {
    return narration.replace(Regex("^\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}"), "").trim()
  }

  private fun normalizeCounterparty(narration: String): String {
    val clean =
      narration
        .uppercase()
        .replace(Regex("[^A-Z0-9 ]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
    val tokens = clean.split(" ").filter { it.length >= 3 }
    return tokens.take(2).joinToString(" ").ifBlank { "UNKNOWN" }
  }

  private fun categorize(
    narration: String,
    dr: Long,
    cr: Long,
    counterparty: String,
  ): String {
    val n = narration.uppercase()
    val amt = max(dr, cr)
    return when {
      n.contains("RTN") || n.contains("RETURN") || n.contains("CHQ RET") || n.contains("NOT REP") -> "RETURN"
      n.contains("GST") || n.contains("TAX") || n.contains("CBDT") || n.contains("ITD") -> "TAX"
      n.contains("ATM") || n.contains("CASH") || n.contains("SELF") -> "CASH"
      n.contains("EMI") || n.contains("LOAN") || n.contains("INTEREST") || n.contains("OD INTEREST") ||
        n.contains("PROC FEE") || n.contains("LEGAL FEE") -> "BANK_FIN"
      n.contains("HAND LOAN") || n.contains("PVT") || n.contains("WEEKLY") -> "PVT_FIN"
      counterparty == "UNKNOWN" && amt >= 500_000L -> "DOUBT"
      amt >= 1_000_000L && (amt % 1_000L != 0L) -> "ODD FIG"
      dr > 0 && cr > 0 -> "CONS"
      else -> "FINAL"
    }
  }

  private fun buildFlags(narration: String, dr: Long, cr: Long): List<String> {
    val flags = mutableListOf<String>()
    val n = narration.uppercase()
    if (n.contains("PENALTY") || n.contains("CHARGE")) flags += "PENALTY"
    if (n.contains("RETURN") || n.contains("BOUNCE")) flags += "BOUNCE"
    if (max(dr, cr) > 5_00_000) flags += "HIGH_VALUE"
    val amt = max(dr, cr)
    if (amt >= 1_000_000 && amt % 1_000L != 0L) flags += "ODD_FIG"
    return flags
  }

  private fun applySpikeDrainFlags(txns: List<NormalizedTransaction>): List<NormalizedTransaction> {
    if (txns.size < 2) return txns
    val updated = txns.toMutableList()
    for (i in 0 until txns.lastIndex) {
      val current = txns[i]
      val next = txns[i + 1]
      if (current.cr >= 500_000 && next.dr >= (current.cr * 0.7)) {
        val flags1 = (current.flags + "SPIKE_DRAIN").distinct()
        val flags2 = (next.flags + "SPIKE_DRAIN").distinct()
        updated[i] = current.copy(flags = flags1)
        updated[i + 1] = next.copy(flags = flags2)
      }
    }
    return updated
  }

  private fun fnv1a(input: String): String {
    var hash = 0x811c9dc5.toInt()
    val prime = 0x01000193
    input.forEach { ch ->
      hash = hash xor ch.code
      hash *= prime
    }
    return hash.toUInt().toString(16)
  }
}
