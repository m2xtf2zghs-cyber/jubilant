package com.jubilant.lirasnative.shared.underwriting

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToLong
import kotlin.math.sqrt
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toEpochDays
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

object UnderwritingEngine {
  fun runUnderwriting(
    transactions: List<UwTransaction>,
    params: UwParams = UwParams(),
    docs: UwDocsInput = UwDocsInput(),
  ): UnderwritingResult {
    require(transactions.isNotEmpty()) { "No transactions to underwrite." }

    val normalized = transactions.mapNotNull { tx -> normalizeTx(tx) }.sortedWith(compareBy({ it.date }, { it.seq }))
    require(normalized.isNotEmpty()) { "No usable transactions after normalization." }

    val periodStart = normalized.minOf { it.date }
    val periodEnd = normalized.maxOf { it.date }
    val statementDays = (periodEnd.toEpochDays() - periodStart.toEpochDays() + 1).coerceAtLeast(1)

    val requestedExposure = params.requestedExposure.coerceAtLeast(50_00_000).coerceAtMost(1_00_00_00_000)
    val maxTenure = min(12, max(1, params.maxTenureMonths))

    val snapshot = computeSnapshot(normalized, statementDays)
    val creditHeat = computeCreditHeatMap(normalized, snapshot.totalCredits)
    val debitHeat = computeDebitHeatMap(normalized, snapshot.totalDebits)
    val lenderCompetition = detectPrivateLenders(normalized, statementDays)
    val velocity = computeVelocityControl(normalized, snapshot)

    val gstUw = docs.gstMonths.takeIf { it.isNotEmpty() }?.let { computeGstUnderwriting(it) }
    val itrUw = docs.itrYears.takeIf { it.isNotEmpty() }?.let { computeItrUnderwriting(it) }
    val cross = computeCrossVerification(normalized, snapshot, gstUw, itrUw)
    val credibility = computeCredibilityScore(gstUw, itrUw, cross)

    val baseRules = runRules(snapshot, creditHeat, debitHeat, lenderCompetition, velocity, statementDays)
    val docRules = runDocRules(gstUw, itrUw, cross)
    val ruleRuns = baseRules + docRules
    val score = (100 + ruleRuns.sumOf { it.scoreDelta }).coerceIn(0, 100)
    val riskGrade = riskGrade(score)

    val pricingApr = pricingApr(riskGrade, snapshot, lenderCompetition, velocity)
    val recommendation = structureLoan(requestedExposure, maxTenure, riskGrade, score, snapshot, lenderCompetition, pricingApr)

    val triggers = buildTriggers(snapshot, recommendation, lenderCompetition, velocity) + buildDocTriggers(gstUw, itrUw, cross)
    val verdict = buildVerdict(score, riskGrade, snapshot, creditHeat, lenderCompetition, recommendation)

    val metrics = (snapshot.toMetrics() + docMetrics(gstUw, itrUw, cross, credibility))
    val aggressiveSummary = buildAggressiveSummary(snapshot, creditHeat, lenderCompetition, recommendation, verdict, cross)

    return UnderwritingResult(
      periodStart = periodStart.toString(),
      periodEnd = periodEnd.toString(),
      statementDays = statementDays,
      bankName = snapshot.bankName,
      accountType = snapshot.accountType,
      credibility = credibility,
      metrics = metrics,
      creditHeatMap = creditHeat,
      debitHeatMap = debitHeat,
      gst = gstUw,
      itr = itrUw,
      crossVerification = cross,
      privateLenderCompetition = lenderCompetition,
      cashVelocityControl = velocity,
      triggers = triggers,
      recommendation = recommendation,
      verdict = verdict,
      ruleRunLog = ruleRuns,
      aggressiveSummary = aggressiveSummary,
    )
  }

  // ---- Normalization ----

  private data class NTx(
    val date: LocalDate,
    val seq: Int,
    val narration: String,
    val debit: Long,
    val credit: Long,
    val balance: Long?,
  )

  private fun normalizeTx(tx: UwTransaction): NTx? {
    val date = runCatching { LocalDate.parse(tx.date.trim()) }.getOrNull() ?: return null
    val narration = tx.narration.trim().ifEmpty { "-" }
    val debit = tx.debit.coerceAtLeast(0)
    val credit = tx.credit.coerceAtLeast(0)
    val balance = tx.balance
    // Ignore pure zero lines (some statements include opening lines with 0/0 and empty narration).
    if (debit == 0L && credit == 0L && balance == null) return null
    return NTx(date = date, seq = 0, narration = narration, debit = debit, credit = credit, balance = balance)
  }

  // ---- Snapshot ----

  private data class Snapshot(
    val totalCredits: Long,
    val totalDebits: Long,
    val avgMonthlyCredits: Double,
    val avgMonthlyDebits: Double,
    val avgWeeklyCredits: Double,
    val avgUsableBalance: Double,
    val minBalance: Long?,
    val lowBalanceDays: Int,
    val creditVolatility: String,
    val creditVolatilityScore: Double,
    val penaltyChargeCount: Int,
    val bounceReturnCount: Int,
    val bankName: String,
    val accountType: String,
    val weekdayCreditTotals: Map<DayOfWeek, Long>,
    val monthDayCreditTotals: Map<Int, Long>,
    val fixedObligationEstimateMonthly: Double,
  ) {
    fun toMetrics(): List<UwMetric> {
      fun m(key: String, value: Double, unit: String = "", meta: JsonObject? = null) = UwMetric(key = key, value = value, unit = unit, meta = meta)
      val out = mutableListOf<UwMetric>()
      out += m("total_credits", totalCredits.toDouble(), "INR")
      out += m("total_debits", totalDebits.toDouble(), "INR")
      out += m("avg_monthly_credits", avgMonthlyCredits, "INR")
      out += m("avg_monthly_debits", avgMonthlyDebits, "INR")
      out += m("avg_weekly_credits", avgWeeklyCredits, "INR")
      out += m("avg_usable_balance", avgUsableBalance, "INR")
      out += m("min_balance", (minBalance ?: 0L).toDouble(), "INR")
      out += m("low_balance_days", lowBalanceDays.toDouble(), "DAYS")
      out += m(
        "credit_volatility_score",
        creditVolatilityScore,
        "",
        buildJsonObject { put("bucket", creditVolatility) },
      )
      out += m("penalty_charge_count", penaltyChargeCount.toDouble(), "COUNT")
      out += m("bounce_return_count", bounceReturnCount.toDouble(), "COUNT")
      out += m("fixed_obligation_estimate_monthly", fixedObligationEstimateMonthly, "INR")
      return out
    }
  }

  private fun computeSnapshot(txs: List<NTx>, statementDays: Int): Snapshot {
    val totalCredits = txs.sumOf { it.credit }
    val totalDebits = txs.sumOf { it.debit }

    val avgDailyCredits = totalCredits.toDouble() / statementDays.toDouble()
    val avgDailyDebits = totalDebits.toDouble() / statementDays.toDouble()
    val avgWeeklyCredits = avgDailyCredits * 7.0
    val avgMonthlyCredits = avgDailyCredits * 30.0
    val avgMonthlyDebits = avgDailyDebits * 30.0

    val balances = txs.mapNotNull { it.balance?.toDouble() }
    val avgUsableBalance = if (balances.isEmpty()) 0.0 else balances.average()
    val minBalance = txs.mapNotNull { it.balance }.minOrNull()

    val dailyCredits = txs.groupBy { it.date }.mapValues { (_, v) -> v.sumOf { it.credit } }
    val dailyCreditValues = dailyCredits.values.map { it.toDouble() }.filter { it > 0.0 }
    val mean = if (dailyCreditValues.isEmpty()) 0.0 else dailyCreditValues.average()
    val stdev =
      if (dailyCreditValues.size < 2) 0.0
      else sqrt(dailyCreditValues.sumOf { (it - mean).pow(2) } / (dailyCreditValues.size - 1).toDouble())
    val cv = if (mean <= 0.0) 0.0 else stdev / mean
    val creditVolatility =
      when {
        cv < 0.35 -> "Low"
        cv < 0.75 -> "Medium"
        else -> "High"
      }

    val dailyMinBalances =
      txs
        .filter { it.balance != null }
        .groupBy { it.date }
        .mapValues { (_, v) -> v.minOf { it.balance ?: Long.MAX_VALUE } }

    val lowBalanceThreshold = (avgMonthlyCredits * 0.05).roundToLong().coerceAtLeast(25_000)
    val lowBalanceDays = dailyMinBalances.count { (_, minBal) -> minBal < lowBalanceThreshold }

    val penaltyChargeCount = txs.count { isPenaltyCharge(it.narration) }
    val bounceReturnCount = txs.count { isBounceOrReturn(it.narration) }

    val weekdayCreditTotals =
      txs
        .filter { it.credit > 0 }
        .groupBy { it.date.dayOfWeek }
        .mapValues { (_, v) -> v.sumOf { it.credit } }

    val monthDayCreditTotals =
      txs
        .filter { it.credit > 0 }
        .groupBy { it.date.dayOfMonth }
        .mapValues { (_, v) -> v.sumOf { it.credit } }

    val fixedObligationEstimateMonthly = estimateFixedObligationsMonthly(txs, statementDays, avgMonthlyCredits)

    val bankName = detectBankName(txs)
    val accountType = detectAccountType(txs)

    return Snapshot(
      totalCredits = totalCredits,
      totalDebits = totalDebits,
      avgMonthlyCredits = avgMonthlyCredits,
      avgMonthlyDebits = avgMonthlyDebits,
      avgWeeklyCredits = avgWeeklyCredits,
      avgUsableBalance = avgUsableBalance,
      minBalance = minBalance,
      lowBalanceDays = lowBalanceDays,
      creditVolatility = creditVolatility,
      creditVolatilityScore = cv,
      penaltyChargeCount = penaltyChargeCount,
      bounceReturnCount = bounceReturnCount,
      bankName = bankName,
      accountType = accountType,
      weekdayCreditTotals = weekdayCreditTotals,
      monthDayCreditTotals = monthDayCreditTotals,
      fixedObligationEstimateMonthly = fixedObligationEstimateMonthly,
    )
  }

  // ---- Heat maps ----

  private fun computeCreditHeatMap(txs: List<NTx>, totalCredits: Long): List<UwCounterpartyRow> {
    if (totalCredits <= 0) return emptyList()
    val grouped =
      txs
        .filter { it.credit > 0 }
        .groupBy { extractCounterparty(it.narration) }
        .mapValues { (_, v) ->
          val sum = v.sumOf { it.credit }
          val freq = v.size
          val avg = if (freq == 0) 0L else (sum.toDouble() / freq.toDouble()).roundToLong()
          Triple(sum, freq, avg)
        }

    val rows =
      grouped.entries
        .sortedByDescending { it.value.first }
        .take(15)
        .map { (cp, triple) ->
          val (sum, freq, avg) = triple
          val pct = (sum.toDouble() / totalCredits.toDouble()) * 100.0
          val dep =
            when {
              pct >= 40.0 -> "High"
              pct >= 20.0 -> "Medium"
              else -> "Low"
            }
          UwCounterpartyRow(
            counterparty = cp,
            nature = classifyCreditNature(cp),
            freq = freq,
            avgAmt = avg,
            totalAmt = sum,
            pctOfTotal = pct,
            dependency = dep,
          )
        }

    return rows
  }

  private fun computeDebitHeatMap(txs: List<NTx>, totalDebits: Long): List<UwCounterpartyRow> {
    if (totalDebits <= 0) return emptyList()
    val grouped =
      txs
        .filter { it.debit > 0 }
        .groupBy { extractCounterparty(it.narration) }
        .mapValues { (_, v) ->
          val sum = v.sumOf { it.debit }
          val freq = v.size
          val avg = if (freq == 0) 0L else (sum.toDouble() / freq.toDouble()).roundToLong()
          Triple(sum, freq, avg)
        }

    val rows =
      grouped.entries
        .sortedByDescending { it.value.first }
        .take(15)
        .map { (cp, triple) ->
          val (sum, freq, avg) = triple
          val pct = (sum.toDouble() / totalDebits.toDouble()) * 100.0
          val (typ, priority, flexi) = classifyDebitType(cp)
          UwCounterpartyRow(
            counterparty = cp,
            nature = typ,
            freq = freq,
            avgAmt = avg,
            totalAmt = sum,
            pctOfTotal = pct,
            priorityLevel = priority,
            flexi = flexi,
          )
        }

    return rows
  }

  // ---- Private lender detection ----

  private fun detectPrivateLenders(txs: List<NTx>, statementDays: Int): UwPrivateLenderCompetition {
    val suspicious = mutableListOf<UwEvidenceTx>()
    val byCounterparty = mutableMapOf<String, Int>()
    var weeklyCollectionsDetected = false
    var rolloverSignals = 0

    val sorted = txs.sortedWith(compareBy({ it.date }, { it.seq }))
    for (i in sorted.indices) {
      val tx = sorted[i]
      val amount = max(tx.debit, tx.credit)
      val direction = if (tx.debit > 0) "DEBIT" else if (tx.credit > 0) "CREDIT" else "OTHER"
      val narration = tx.narration
      val cp = extractCounterparty(narration)

      val isKeywordHit = isPrivateLenderKeyword(narration)
      val isRound = isRoundFigure(amount)
      val isSmallRound = amount in 25_000L..5_00_000L && amount % 5_000L == 0L

      val score = (if (isKeywordHit) 2 else 0) + (if (isRound) 1 else 0) + (if (isSmallRound) 1 else 0)
      if (score >= 2 && (tx.debit > 0 || tx.credit > 0)) {
        byCounterparty[cp] = (byCounterparty[cp] ?: 0) + 1
        if (suspicious.size < 30) {
          suspicious += UwEvidenceTx(date = tx.date.toString(), narration = narration.take(140), direction = direction, amount = amount)
        }
      }

      // rollover/recycling: credit then debit similar amount within 2 days + keyword
      if (tx.credit > 0 && i + 1 < sorted.size) {
        val next = sorted[i + 1]
        val dayGap = next.date.toEpochDays() - tx.date.toEpochDays()
        if (dayGap in 0..2 && next.debit > 0) {
          val delta = abs(next.debit - tx.credit).toDouble() / max(1.0, tx.credit.toDouble())
          if (delta <= 0.08 && (isPrivateLenderKeyword(next.narration) || isPrivateLenderKeyword(tx.narration))) {
            rolloverSignals += 1
          }
        }
      }
    }

    // weekly collections detection: repeated debits every ~7 days with low variance amounts
    weeklyCollectionsDetected = detectWeeklyLikeDebits(txs)

    val lenderLikeCounterparties = byCounterparty.filterValues { it >= 2 }.keys
    val estimatedLenders = lenderLikeCounterparties.size.coerceIn(0, 12)

    val suspiciousDebitSum = suspicious.filter { it.direction == "DEBIT" }.sumOf { it.amount }
    val approxMonthlyDebtLoad =
      if (statementDays <= 0) suspiciousDebitSum
      else ((suspiciousDebitSum.toDouble() / statementDays.toDouble()) * 30.0).roundToLong()

    val summary =
      buildString {
        append("Estimated private lenders: ")
        append(estimatedLenders)
        append(". ")
        append("Approx monthly debt load: ₹")
        append(formatInr(approxMonthlyDebtLoad))
        append(". ")
        if (weeklyCollectionsDetected) append("Weekly collections pattern detected. ")
        if (rolloverSignals > 0) append("Rollover/recycling signals: $rolloverSignals. ")
      }.trim()

    return UwPrivateLenderCompetition(
      estimatedLenders = estimatedLenders,
      approxMonthlyDebtLoad = approxMonthlyDebtLoad,
      weeklyCollectionsDetected = weeklyCollectionsDetected,
      rolloverRecyclingSignals = rolloverSignals,
      evidence = suspicious,
      summary = summary,
    )
  }

  private fun detectWeeklyLikeDebits(txs: List<NTx>): Boolean {
    val debits = txs.filter { it.debit > 0 }.sortedBy { it.date.toEpochDays() }
    if (debits.size < 6) return false
    // look for repeated ~weekly cadence in the last 60 days
    val tail = debits.takeLast(60)
    val gaps = mutableListOf<Int>()
    for (i in 1 until tail.size) {
      gaps += (tail[i].date.toEpochDays() - tail[i - 1].date.toEpochDays())
    }
    val weeklyish = gaps.count { it in 5..9 }
    return weeklyish >= 4
  }

  // ---- Velocity & control ----

  private fun computeVelocityControl(txs: List<NTx>, snapshot: Snapshot): UwCashVelocityControl {
    val daily =
      txs.groupBy { it.date }.mapValues { (_, v) ->
        val c = v.sumOf { it.credit }
        val d = v.sumOf { it.debit }
        Pair(c, d)
      }

    val days = daily.keys.sortedBy { it.toEpochDays() }
    var sameDaySpend = 0.0
    var tPlusOneSpend = 0.0
    var creditDays = 0

    for (i in days.indices) {
      val date = days[i]
      val (c, d) = daily[date] ?: (0L to 0L)
      if (c <= 0L) continue
      creditDays += 1
      val same = min(d.toDouble() / c.toDouble(), 1.0)
      sameDaySpend += same
      if (i + 1 < days.size) {
        val next = daily[days[i + 1]] ?: (0L to 0L)
        val t1 = min(next.second.toDouble() / c.toDouble(), 1.0)
        tPlusOneSpend += t1
      }
    }

    val sameDaySpendRatio = if (creditDays == 0) 0.0 else sameDaySpend / creditDays.toDouble()
    val tPlusOneSpendRatio = if (creditDays == 0) 0.0 else tPlusOneSpend / creditDays.toDouble()
    val idleRetention = if (snapshot.avgMonthlyCredits <= 0.0) 0.0 else snapshot.avgUsableBalance / snapshot.avgMonthlyCredits

    val topWeekday = snapshot.weekdayCreditTotals.entries.maxByOrNull { it.value }?.key ?: DayOfWeek.MONDAY
    val topMonthDays =
      snapshot.monthDayCreditTotals.entries
        .sortedByDescending { it.value }
        .take(3)
        .map { it.key }

    val borrowerType =
      when {
        sameDaySpendRatio >= 0.85 && idleRetention < 0.10 -> "Pass-through operator (low control, thin margin)"
        idleRetention >= 0.25 -> "Cash-retainer (higher control/retention)"
        snapshot.creditVolatility == "Low" -> "Stable earner / salary-like"
        else -> "Trader / variable inflow operator"
      }

    val commentary =
      "Same-day spend ratio ${pct1(sameDaySpendRatio)}; T+1 spend ratio ${pct1(tPlusOneSpendRatio)}; idle retention ${pct1(idleRetention)}. Classified as: $borrowerType."

    return UwCashVelocityControl(
      sameDaySpendRatio = sameDaySpendRatio,
      tPlusOneSpendRatio = tPlusOneSpendRatio,
      idleCashRetentionRatio = idleRetention,
      topInflowWeekday = topWeekday.name.lowercase().replaceFirstChar { it.uppercase() },
      topInflowMonthDays = topMonthDays,
      borrowerType = borrowerType,
      commentary = commentary,
    )
  }

  // ---- GST / ITR underwriting (optional docs) ----

  private fun monthIndexOrNull(ym: String): Int? {
    val parts = ym.trim().split("-")
    if (parts.size != 2) return null
    val y = parts[0].toIntOrNull() ?: return null
    val m = parts[1].toIntOrNull() ?: return null
    if (m !in 1..12) return null
    return (y * 12) + (m - 1)
  }

  private fun monthIndexToYm(index: Int): String {
    val y = index / 12
    val m0 = index % 12
    val m = (m0 + 1).coerceIn(1, 12)
    return "${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}"
  }

  private fun computeGstUnderwriting(monthsRaw: List<UwGstMonth>): UwGstUnderwriting {
    val months = monthsRaw.filter { it.turnover >= 0 }.sortedBy { it.month }
    val values = months.map { it.turnover.toDouble() }.filter { it > 0.0 }
    val mean = if (values.isEmpty()) 0.0 else values.average()
    val stdev =
      if (values.size < 2) 0.0
      else sqrt(values.sumOf { (it - mean).pow(2) } / (values.size - 1).toDouble())
    val cv = if (mean <= 0.0) 0.0 else stdev / mean

    val volatilityBucket =
      when {
        cv < 0.35 -> "Low"
        cv < 0.75 -> "Medium"
        else -> "High"
      }

    val totalTurnover = months.sumOf { it.turnover.coerceAtLeast(0) }.toDouble().coerceAtLeast(0.0)
    val top3Ratio =
      if (totalTurnover <= 0.0) 0.0
      else months.map { it.turnover.toDouble().coerceAtLeast(0.0) }.sortedDescending().take(3).sum() / totalTurnover
    val seasonalityBucket =
      when {
        top3Ratio >= 0.50 -> "High"
        top3Ratio >= 0.35 -> "Medium"
        else -> "Low"
      }

    val indices = months.mapNotNull { monthIndexOrNull(it.month) }
    val gapCount =
      if (indices.size < 2) 0
      else {
        val minI = indices.minOrNull() ?: 0
        val maxI = indices.maxOrNull() ?: 0
        val expected = (maxI - minI + 1).coerceAtLeast(0)
        max(0, expected - indices.distinct().size)
      }

    val missingMonths =
      if (indices.size < 2) emptyList()
      else {
        val minI = indices.minOrNull() ?: 0
        val maxI = indices.maxOrNull() ?: 0
        val present = indices.toSet()
        val missing = mutableListOf<String>()
        for (i in minI..maxI) {
          if (i !in present) missing += monthIndexToYm(i)
          if (missing.size >= 24) break
        }
        missing
      }

    val lateMonths = months.filter { (it.daysLate ?: 0) > 0 }.map { it.month }
    val lateCount = lateMonths.size
    val avgMonthly = mean.roundToLong().coerceAtLeast(0)

    val consecutiveDropMonths =
      run {
        val sorted = months.sortedBy { it.month }
        val dropMonths = mutableListOf<String>()
        for (i in 1 until sorted.size) {
          val prev = sorted[i - 1].turnover.toDouble()
          val cur = sorted[i].turnover.toDouble()
          if (prev <= 0.0) continue
          val dropPct = ((prev - cur) / prev) * 100.0
          if (dropPct >= 30.0) dropMonths += sorted[i].month
        }
        val consecutive = mutableListOf<String>()
        for (m in dropMonths) {
          val mi = monthIndexOrNull(m) ?: continue
          val prevM = monthIndexToYm(mi - 1)
          if (dropMonths.contains(prevM)) consecutive += m
        }
        consecutive.distinct().take(24)
      }

    val flags = mutableListOf<String>()
    if (gapCount > 0) flags += "GST_MISSED_FILINGS"
    if (lateCount >= 2) flags += "GST_LATE_FILINGS"
    if (volatilityBucket == "High") flags += "GST_VOLATILITY_HIGH"
    if (consecutiveDropMonths.size >= 2) flags += "GST_CONSECUTIVE_DROP"

    val commentary =
      buildString {
        append("GST avg monthly turnover ₹${formatInr(avgMonthly)}. ")
        if (gapCount > 0) append("Missed filings: $gapCount. ")
        if (lateCount > 0) append("Late filings: $lateCount. ")
        if (volatilityBucket == "High") append("High turnover volatility (CV ${(cv * 100.0).roundToLong() / 100.0}). ")
        if (consecutiveDropMonths.size >= 2) append("Consecutive turnover drop risk detected. ")
      }.trim()

    return UwGstUnderwriting(
      months = months,
      avgMonthlyTurnover = avgMonthly,
      volatilityScore = cv,
      volatilityBucket = volatilityBucket,
      seasonalityBucket = seasonalityBucket,
      filingGapCount = gapCount,
      missingMonths = missingMonths,
      lateFilingCount = lateCount,
      lateMonths = lateMonths,
      consecutiveDropMonths = consecutiveDropMonths,
      flags = flags,
      commentary = commentary,
    )
  }

  private fun itrYearKey(label: String): Int {
    val m = Regex("(20\\d{2})").find(label)
    return m?.value?.toIntOrNull() ?: 0
  }

  private fun computeItrUnderwriting(yearsRaw: List<UwItrYear>): UwItrUnderwriting {
    val years = yearsRaw.filter { it.turnover >= 0 }.sortedBy { itrYearKey(it.year) }
    val latest = years.maxByOrNull { itrYearKey(it.year) } ?: years.last()
    val latestTurnover = latest.turnover.coerceAtLeast(0)
    val latestProfit = latest.profit
    val marginPct = if (latestTurnover <= 0L) 0.0 else (latestProfit.toDouble() / latestTurnover.toDouble()) * 100.0
    val latestTaxPaid = latest.taxPaid.coerceAtLeast(0)

    val prev = years.filter { itrYearKey(it.year) < itrYearKey(latest.year) }.maxByOrNull { itrYearKey(it.year) }
    val yoyTurnoverPct =
      prev?.let {
        if (it.turnover <= 0L) null else ((latestTurnover - it.turnover).toDouble() / it.turnover.toDouble()) * 100.0
      }
    val yoyProfitPct =
      prev?.let {
        if (it.profit == 0L) null else ((latestProfit - it.profit).toDouble() / abs(it.profit).toDouble()) * 100.0
      }

    val flags = mutableListOf<String>()
    if (marginPct < 3.0) flags += "ITR_MARGIN_THIN"
    if (latestProfit < 0) flags += "ITR_LOSS"
    if ((yoyTurnoverPct ?: 0.0) <= -30.0) flags += "ITR_INCOME_DECLINE_30"
    if ((yoyTurnoverPct ?: 0.0) <= -15.0) flags += "ITR_TURNOVER_DROP"
    if ((yoyProfitPct ?: 0.0) <= -20.0) flags += "ITR_PROFIT_DROP"
    if (latestProfit > 0 && latestTaxPaid == 0L) flags += "ITR_TAX_ANOMALY"

    val commentary =
      buildString {
        append("ITR latest turnover ₹${formatInr(latestTurnover)}, profit ₹${formatInr(latestProfit)} (margin ${(marginPct * 10.0).roundToLong() / 10.0}%). ")
        yoyTurnoverPct?.let { append("YoY turnover ${(it * 10.0).roundToLong() / 10.0}%. ") }
        yoyProfitPct?.let { append("YoY profit ${(it * 10.0).roundToLong() / 10.0}%. ") }
        if (marginPct < 3.0) append("Margin is thin → higher default sensitivity to any inflow disruption. ")
        if (latestProfit < 0) append("Loss declared → collections must be control-first. ")
      }.trim()

    return UwItrUnderwriting(
      years = years,
      latestTurnover = latestTurnover,
      latestProfit = latestProfit,
      latestMarginPct = marginPct,
      latestTaxPaid = latestTaxPaid,
      yoyTurnoverPct = yoyTurnoverPct,
      yoyProfitPct = yoyProfitPct,
      flags = flags,
      commentary = commentary,
    )
  }

  private fun computeCrossVerification(
    txs: List<NTx>,
    snapshot: Snapshot,
    gst: UwGstUnderwriting?,
    itr: UwItrUnderwriting?,
  ): UwCrossVerification? {
    if (gst == null && itr == null) return null

    val bankByMonth =
      txs
        .filter { it.credit > 0 }
        .groupBy { "${it.date.year}-${it.date.monthNumber.toString().padStart(2, '0')}" }
        .mapValues { (_, v) -> v.sumOf { it.credit } }

    val rows =
      (gst?.months ?: emptyList())
        .sortedBy { it.month }
        .map { m ->
          val bankCredits = bankByMonth[m.month] ?: 0L
          val gstTurnover = m.turnover.coerceAtLeast(0)
          val diffPct =
            if (gstTurnover <= 0L) null
            else ((bankCredits - gstTurnover).toDouble() / gstTurnover.toDouble()) * 100.0
          UwCrossVerifyRow(
            month = m.month,
            bankCredits = bankCredits,
            gstTurnover = gstTurnover,
            diffPct = diffPct,
          )
        }

    val nilReturnMonthsWithBankCredits =
      rows
        .filter { it.gstTurnover == 0L && it.bankCredits > 0L }
        .map { it.month }
        .distinct()
        .take(24)

    val bankVsGstAvgDiffPct =
      rows
        .mapNotNull { it.diffPct }
        .takeIf { it.isNotEmpty() }
        ?.map { abs(it) }
        ?.average()

    val bankVsItrAvgDiffPct =
      itr?.latestTurnover
        ?.takeIf { it > 0L }
        ?.let { itrTurnover ->
          val itrMonthly = itrTurnover.toDouble() / 12.0
          if (itrMonthly <= 0.0) null else (abs(snapshot.avgMonthlyCredits - itrMonthly) / itrMonthly) * 100.0
        }

    val itrVsGstAnnualEstimated =
      if (gst == null || gst.months.isEmpty()) null
      else {
        val sum = gst.months.sumOf { it.turnover.coerceAtLeast(0) }
        val count = gst.months.size.coerceAtLeast(1)
        if (count >= 6) ((sum.toDouble() / count.toDouble()) * 12.0).roundToLong() else sum
      }

    val itrVsGstAnnualDiffPct =
      if (itr == null || itr.latestTurnover <= 0L || itrVsGstAnnualEstimated == null || itrVsGstAnnualEstimated <= 0L) null
      else (abs(itr.latestTurnover - itrVsGstAnnualEstimated).toDouble() / itrVsGstAnnualEstimated.toDouble()) * 100.0

    val mismatchFlags = mutableListOf<String>()
    if (bankVsGstAvgDiffPct != null && bankVsGstAvgDiffPct > 20.0) mismatchFlags += "BANK_VS_GST_MISMATCH"
    if (bankVsItrAvgDiffPct != null && bankVsItrAvgDiffPct > 25.0) mismatchFlags += "BANK_VS_ITR_MISMATCH"
    if (itrVsGstAnnualDiffPct != null && itrVsGstAnnualDiffPct > 25.0) mismatchFlags += "ITR_VS_GST_MISMATCH"
    if (nilReturnMonthsWithBankCredits.isNotEmpty()) mismatchFlags += "GST_NIL_WITH_BANK_CREDITS"

    val commentary =
      buildString {
        if (bankVsGstAvgDiffPct != null) append("Bank vs GST avg mismatch ~${(bankVsGstAvgDiffPct * 10.0).roundToLong() / 10.0}%. ")
        if (bankVsItrAvgDiffPct != null) append("Bank vs ITR avg mismatch ~${(bankVsItrAvgDiffPct * 10.0).roundToLong() / 10.0}%. ")
        if (itrVsGstAnnualDiffPct != null) append("ITR vs GST (annualized) mismatch ~${(itrVsGstAnnualDiffPct * 10.0).roundToLong() / 10.0}%. ")
        if (mismatchFlags.isNotEmpty()) append("Mismatch flags: ${mismatchFlags.joinToString(", ")}.")
      }.trim()

    return UwCrossVerification(
      bankVsGstAvgDiffPct = bankVsGstAvgDiffPct,
      bankVsItrAvgDiffPct = bankVsItrAvgDiffPct,
      itrVsGstAnnualDiffPct = itrVsGstAnnualDiffPct,
      itrVsGstAnnualEstimated = itrVsGstAnnualEstimated,
      nilReturnMonthsWithBankCredits = nilReturnMonthsWithBankCredits,
      rows = rows,
      mismatchFlags = mismatchFlags,
      commentary = commentary,
    )
  }

  private fun docMetrics(
    gst: UwGstUnderwriting?,
    itr: UwItrUnderwriting?,
    cross: UwCrossVerification?,
    credibility: UwCredibilityScore?,
  ): List<UwMetric> {
    fun m(key: String, value: Double, unit: String = "", meta: JsonObject? = null) = UwMetric(key = key, value = value, unit = unit, meta = meta)
    val out = mutableListOf<UwMetric>()
    gst?.let {
      out += m("gst_avg_monthly_turnover", it.avgMonthlyTurnover.toDouble(), "INR")
      out += m("gst_volatility_score", it.volatilityScore, "", buildJsonObject { put("bucket", it.volatilityBucket) })
      out += m("gst_seasonality_bucket", 0.0, "", buildJsonObject { put("bucket", it.seasonalityBucket) })
      out += m("gst_filing_gap_count", it.filingGapCount.toDouble(), "COUNT")
      out += m("gst_late_filing_count", it.lateFilingCount.toDouble(), "COUNT")
      out += m("gst_consecutive_drop_months", it.consecutiveDropMonths.size.toDouble(), "COUNT")
    }
    itr?.let {
      out += m("itr_latest_turnover", it.latestTurnover.toDouble(), "INR")
      out += m("itr_latest_profit", it.latestProfit.toDouble(), "INR")
      out += m("itr_latest_margin_pct", it.latestMarginPct, "PCT")
      out += m("itr_latest_tax_paid", it.latestTaxPaid.toDouble(), "INR")
      it.yoyTurnoverPct?.let { v -> out += m("itr_yoy_turnover_pct", v, "PCT") }
      it.yoyProfitPct?.let { v -> out += m("itr_yoy_profit_pct", v, "PCT") }
    }
    cross?.let {
      it.bankVsGstAvgDiffPct?.let { v -> out += m("bank_vs_gst_avg_diff_pct", v, "PCT") }
      it.bankVsItrAvgDiffPct?.let { v -> out += m("bank_vs_itr_avg_diff_pct", v, "PCT") }
      it.itrVsGstAnnualDiffPct?.let { v -> out += m("itr_vs_gst_annual_diff_pct", v, "PCT") }
      it.itrVsGstAnnualEstimated?.let { v -> out += m("gst_annual_estimated_from_months", v.toDouble(), "INR") }
      out += m("gst_nil_months_with_bank_credits", it.nilReturnMonthsWithBankCredits.size.toDouble(), "COUNT")
    }
    credibility?.let {
      out += m("credibility_score", it.score.toDouble(), "SCORE")
      out += m("credibility_gst_score", it.gstScore.toDouble(), "SCORE")
      out += m("credibility_itr_score", it.itrScore.toDouble(), "SCORE")
      out += m("credibility_mismatch_penalty", it.mismatchPenalty.toDouble(), "SCORE")
    }
    return out
  }

  private fun runDocRules(gst: UwGstUnderwriting?, itr: UwItrUnderwriting?, cross: UwCrossVerification?): List<UwRuleRun> {
    val rules = mutableListOf<UwRuleRun>()

    // GST rules (deterministic & explainable)
    gst?.let { g ->
      rules +=
        rule(
          id = "GST-01",
          name = "Missed GST filings (gaps)",
          category = UwRuleCategory.Discipline,
          severity = UwSeverity.High,
          passed = g.filingGapCount == 0,
          scoreDeltaFail = -18,
          thresholds = buildJsonObject { put("missed_months_max", 0) },
          evidence =
            buildJsonObject {
              put("missed_months_count", g.filingGapCount)
              put("missing_months", g.missingMonths.joinToString(","))
            },
          reasonFail = "Missed GST filings weaken enforceability and signal compliance risk. Structure tighter and demand proof before exposure.",
          reasonPass = "No obvious missed GST filing gaps in the provided months range.",
        )

      rules +=
        rule(
          id = "GST-02",
          name = "Repeated late GST filings",
          category = UwRuleCategory.Discipline,
          severity = UwSeverity.Medium,
          passed = g.lateFilingCount <= 1,
          scoreDeltaFail = -10,
          thresholds = buildJsonObject { put("late_months_max", 1) },
          evidence =
            buildJsonObject {
              put("late_months_count", g.lateFilingCount)
              put("late_months", g.lateMonths.joinToString(","))
            },
          reasonFail = "Repeated late filing indicates weak compliance discipline. Increase control (weekly collections) and reduce discretionary exposure.",
          reasonPass = "Late filing count is within tolerance.",
        )

      rules +=
        rule(
          id = "GST-03",
          name = "GST turnover volatility (high)",
          category = UwRuleCategory.Snapshot,
          severity = UwSeverity.High,
          passed = g.volatilityBucket != "High",
          scoreDeltaFail = -12,
          thresholds = buildJsonObject { put("volatility_bucket_max", "Medium") },
          evidence =
            buildJsonObject {
              put("volatility_score", g.volatilityScore)
              put("volatility_bucket", g.volatilityBucket)
              put("seasonality_bucket", g.seasonalityBucket)
            },
          reasonFail = "High turnover volatility increases collection miss probability. Prefer weekly collections and staged disbursement.",
          reasonPass = "GST turnover volatility is not flagged as high.",
        )

      rules +=
        rule(
          id = "GST-04",
          name = "Consecutive turnover drop (>30%)",
          category = UwRuleCategory.Snapshot,
          severity = UwSeverity.Critical,
          passed = g.consecutiveDropMonths.size < 2,
          scoreDeltaFail = -22,
          thresholds = buildJsonObject { put("drop_pct_min", 30.0); put("consecutive_months_min", 2) },
          evidence =
            buildJsonObject {
              put("consecutive_drop_months", g.consecutiveDropMonths.joinToString(","))
              put("count", g.consecutiveDropMonths.size)
            },
          reasonFail = "Consecutive sharp turnover drop indicates active stress. Treat as immediate action: cut exposure, shorten tenure, and demand proof of recovery.",
          reasonPass = "No consecutive sharp turnover drop detected.",
        )
    }

    // Cross-verification: GST vs Bank mismatch
    cross?.bankVsGstAvgDiffPct?.let { v ->
      rules +=
        rule(
          id = "GST-05",
          name = "GST vs Bank mismatch",
          category = UwRuleCategory.Discipline,
          severity = UwSeverity.Critical,
          passed = v <= 25.0,
          scoreDeltaFail = -18,
          thresholds = buildJsonObject { put("avg_abs_diff_pct_max", 25.0) },
          evidence = buildJsonObject { put("bank_vs_gst_avg_abs_diff_pct", v) },
          reasonFail = "GST vs Bank mismatch is materially high. Treat as control risk (unreported/cash/recycling). Reduce exposure + increase upfront deduction.",
          reasonPass = "GST vs Bank mismatch is within tolerance.",
        )
    }

    // Cross-verification: NIL GST with bank credits
    if (cross != null && cross.nilReturnMonthsWithBankCredits.isNotEmpty()) {
      rules +=
        rule(
          id = "GST-06",
          name = "NIL GST return with active bank credits",
          category = UwRuleCategory.Discipline,
          severity = UwSeverity.Critical,
          passed = false,
          scoreDeltaFail = -25,
          thresholds = buildJsonObject { put("nil_return_months_with_bank_credits_max", 0) },
          evidence = buildJsonObject { put("months", cross.nilReturnMonthsWithBankCredits.joinToString(",")) },
          reasonFail = "NIL GST returns conflict with active bank credits. This is a hard control red flag. Demand full breakup + compliance proof before any exposure.",
          reasonPass = "N/A",
        )
    }

    // ITR rules (deterministic)
    itr?.let { i ->
      rules +=
        rule(
          id = "ITR-01",
          name = "ITR margin low",
          category = UwRuleCategory.Snapshot,
          severity = UwSeverity.Medium,
          passed = i.latestMarginPct >= 3.0,
          scoreDeltaFail = -10,
          thresholds = buildJsonObject { put("margin_pct_min", 3.0) },
          evidence = buildJsonObject { put("latest_margin_pct", i.latestMarginPct); put("latest_turnover", i.latestTurnover); put("latest_profit", i.latestProfit) },
          reasonFail = "Declared margin is low. Any disruption will hit collections quickly. Prefer weekly collections and cap exposure.",
          reasonPass = "Margin is not critically low.",
        )

      rules +=
        rule(
          id = "ITR-02",
          name = "ITR loss business",
          category = UwRuleCategory.Snapshot,
          severity = UwSeverity.High,
          passed = i.latestProfit >= 0,
          scoreDeltaFail = -20,
          thresholds = buildJsonObject { put("latest_profit_min", 0) },
          evidence = buildJsonObject { put("latest_profit", i.latestProfit); put("latest_turnover", i.latestTurnover) },
          reasonFail = "Declared loss in ITR. Collections must be control-first (tight tenure, high upfront, staged).",
          reasonPass = "No loss declared in latest ITR input.",
        )

      i.yoyTurnoverPct?.let { yoy ->
        rules +=
          rule(
            id = "ITR-03",
            name = "YoY turnover decline >30%",
            category = UwRuleCategory.Snapshot,
            severity = UwSeverity.High,
            passed = yoy > -30.0,
            scoreDeltaFail = -16,
            thresholds = buildJsonObject { put("yoy_turnover_pct_min", -30.0) },
            evidence = buildJsonObject { put("yoy_turnover_pct", yoy) },
            reasonFail = "YoY turnover decline is severe. Treat as stress; reduce exposure and shorten tenure aggressively.",
            reasonPass = "YoY turnover decline not flagged as severe.",
          )
      }

      if (i.latestProfit > 0 && i.latestTaxPaid == 0L) {
        rules +=
          rule(
            id = "ITR-06",
            name = "Tax anomaly (profit but tax paid = 0)",
            category = UwRuleCategory.Discipline,
            severity = UwSeverity.High,
            passed = false,
            scoreDeltaFail = -12,
            thresholds = buildJsonObject { put("tax_paid_min_if_profit", 1) },
            evidence = buildJsonObject { put("latest_profit", i.latestProfit); put("latest_tax_paid", i.latestTaxPaid) },
            reasonFail = "Profit declared but tax paid is zero. Treat declared statements as weak evidence; demand computation and proof.",
            reasonPass = "N/A",
          )
      }
    }

    // ITR vs GST mismatch (annualized)
    cross?.itrVsGstAnnualDiffPct?.let { v ->
      rules +=
        rule(
          id = "ITR-04",
          name = "ITR vs GST mismatch (annualized)",
          category = UwRuleCategory.Discipline,
          severity = UwSeverity.Critical,
          passed = v <= 25.0,
          scoreDeltaFail = -18,
          thresholds = buildJsonObject { put("annual_abs_diff_pct_max", 25.0) },
          evidence = buildJsonObject { put("itr_vs_gst_annual_abs_diff_pct", v); put("gst_annual_estimated", cross.itrVsGstAnnualEstimated ?: 0) },
          reasonFail = "ITR vs GST mismatch is high. Treat reported numbers as unreliable; restructure with tighter control and documentary proof.",
          reasonPass = "ITR vs GST mismatch is within tolerance.",
        )
    }

    // ITR vs Bank mismatch (avg monthly)
    cross?.bankVsItrAvgDiffPct?.let { v ->
      rules +=
        rule(
          id = "ITR-05",
          name = "ITR vs Bank mismatch",
          category = UwRuleCategory.Discipline,
          severity = UwSeverity.High,
          passed = v <= 25.0,
          scoreDeltaFail = -12,
          thresholds = buildJsonObject { put("avg_abs_diff_pct_max", 25.0) },
          evidence = buildJsonObject { put("bank_vs_itr_avg_abs_diff_pct", v) },
          reasonFail = "ITR does not match bank cash power. Treat declared financials as unreliable. Tighten tenure + collections.",
          reasonPass = "ITR vs Bank mismatch is within tolerance.",
        )
    }

    return rules
  }

  private fun buildDocTriggers(gst: UwGstUnderwriting?, itr: UwItrUnderwriting?, cross: UwCrossVerification?): List<UwEarlyWarningTrigger> {
    val out = mutableListOf<UwEarlyWarningTrigger>()

    if (gst != null && gst.filingGapCount > 0) {
      out +=
        trigger(
          "GST_MISSED_FILINGS",
          UwSeverity.High,
          buildJsonObject { put("missed_months_count", gst.filingGapCount); put("missing_months", gst.missingMonths.joinToString(",")) },
          "GST missed filings detected. Freeze enhancements, demand compliance proof and tighten collections immediately.",
        )
    }
    if (gst != null && gst.lateFilingCount >= 2) {
      out +=
        trigger(
          "GST_LATE_FILINGS",
          UwSeverity.Medium,
          buildJsonObject { put("late_months_count", gst.lateFilingCount); put("late_months", gst.lateMonths.joinToString(",")) },
          "Repeated late GST filings. Treat compliance discipline as weak; tighten controls and avoid loose structures.",
        )
    }
    if (gst != null && gst.consecutiveDropMonths.size >= 2) {
      out +=
        trigger(
          "GST_CONSECUTIVE_DROP",
          UwSeverity.Critical,
          buildJsonObject { put("months", gst.consecutiveDropMonths.joinToString(",")); put("count", gst.consecutiveDropMonths.size) },
          "GST turnover shows consecutive sharp drops. Immediate action: reduce exposure, stage disbursement, and align collections to strongest inflow window.",
        )
    }

    cross?.bankVsGstAvgDiffPct?.let { v ->
      if (v > 25.0) {
        out +=
          trigger(
            "BANK_GST_MISMATCH",
            if (v > 40.0) UwSeverity.Critical else UwSeverity.High,
            buildJsonObject { put("avg_abs_diff_pct", v) },
            "Bank vs GST mismatch elevated. Any new lender/cash-recycling signal → reduce exposure immediately.",
          )
      }
    }

    if (cross != null && cross.nilReturnMonthsWithBankCredits.isNotEmpty()) {
      out +=
        trigger(
          "GST_NIL_WITH_BANK_CREDITS",
          UwSeverity.Critical,
          buildJsonObject { put("months", cross.nilReturnMonthsWithBankCredits.joinToString(",")) },
          "NIL GST returns with active bank credits detected. Treat as compliance/control red flag; demand full breakup and proof before any exposure.",
        )
    }

    cross?.itrVsGstAnnualDiffPct?.let { v ->
      if (v > 25.0) {
        out +=
          trigger(
            "ITR_GST_MISMATCH",
            if (v > 45.0) UwSeverity.Critical else UwSeverity.High,
            buildJsonObject { put("annual_abs_diff_pct", v); put("gst_annual_estimated", cross.itrVsGstAnnualEstimated ?: 0) },
            "ITR vs GST mismatch is elevated. Treat reported numbers as unreliable; tighten structure and demand reconciliations.",
          )
      }
    }

    cross?.bankVsItrAvgDiffPct?.let { v ->
      if (v > 25.0) {
        out +=
          trigger(
            "BANK_ITR_MISMATCH",
            if (v > 40.0) UwSeverity.Critical else UwSeverity.High,
            buildJsonObject { put("avg_abs_diff_pct", v) },
            "Bank vs ITR mismatch elevated. Treat ITR as weak evidence and rely on cash-control collections.",
          )
      }
    }

    if (itr != null && itr.latestMarginPct < 3.0) {
      out +=
        trigger(
          "ITR_MARGIN_THIN",
          UwSeverity.Medium,
          buildJsonObject { put("latest_margin_pct_lt", 3.0); put("latest_margin_pct", itr.latestMarginPct) },
          "Thin margin: small shocks can trigger missed collections. Keep exposure capped; collect weekly.",
        )
    }

    if (itr != null && itr.latestProfit < 0) {
      out +=
        trigger(
          "ITR_LOSS",
          UwSeverity.High,
          buildJsonObject { put("latest_profit_lt", 0); put("latest_profit", itr.latestProfit) },
          "Loss declared in ITR. Structure must be control-first (tight tenure, staged disbursement, higher upfront).",
        )
    }

    if (itr != null && (itr.yoyTurnoverPct ?: 0.0) <= -30.0) {
      out +=
        trigger(
          "ITR_INCOME_DECLINE",
          UwSeverity.High,
          buildJsonObject { put("yoy_turnover_pct_min", -30.0); put("yoy_turnover_pct", itr.yoyTurnoverPct ?: 0.0) },
          "Severe YoY income decline. Reduce exposure and shorten tenure; align collections to strongest inflow window.",
        )
    }

    return out
  }

  private fun computeCredibilityScore(
    gst: UwGstUnderwriting?,
    itr: UwItrUnderwriting?,
    cross: UwCrossVerification?,
  ): UwCredibilityScore? {
    if (gst == null && itr == null && cross == null) return null

    var gstPenalty = 0
    val gstReasons = mutableListOf<String>()
    gst?.let {
      if (it.filingGapCount > 0) {
        gstPenalty += min(40, it.filingGapCount * 10)
        gstReasons += "GST missed filings"
      }
      if (it.lateFilingCount >= 2) {
        gstPenalty += min(20, it.lateFilingCount * 5)
        gstReasons += "Repeated GST late filings"
      }
      if (it.volatilityBucket == "High") {
        gstPenalty += 15
        gstReasons += "High GST volatility"
      }
      if (it.consecutiveDropMonths.size >= 2) {
        gstPenalty += 20
        gstReasons += "GST consecutive turnover drop"
      }
    }

    var itrPenalty = 0
    val itrReasons = mutableListOf<String>()
    itr?.let {
      if (it.latestMarginPct < 3.0) {
        itrPenalty += if (it.latestMarginPct < 1.0) 20 else 10
        itrReasons += "Low ITR margin"
      }
      if (it.latestProfit < 0) {
        itrPenalty += 25
        itrReasons += "ITR loss"
      }
      if ((it.yoyTurnoverPct ?: 0.0) <= -30.0) {
        itrPenalty += 15
        itrReasons += "Severe YoY turnover decline"
      }
      if (it.latestProfit > 0 && it.latestTaxPaid == 0L) {
        itrPenalty += 10
        itrReasons += "Tax anomaly"
      }
    }

    var mismatchPenalty = 0
    val mismatchReasons = mutableListOf<String>()
    cross?.bankVsGstAvgDiffPct?.let { v ->
      if (v > 10.0) mismatchPenalty += 10
      if (v > 25.0) mismatchPenalty += 15
      if (v > 40.0) mismatchPenalty += 15
      if (v > 10.0) mismatchReasons += "GST vs Bank mismatch"
    }
    cross?.bankVsItrAvgDiffPct?.let { v ->
      if (v > 25.0) mismatchPenalty += 10
      if (v > 40.0) mismatchPenalty += 10
      if (v > 25.0) mismatchReasons += "ITR vs Bank mismatch"
    }
    cross?.itrVsGstAnnualDiffPct?.let { v ->
      if (v > 25.0) mismatchPenalty += 10
      if (v > 40.0) mismatchPenalty += 10
      if (v > 25.0) mismatchReasons += "ITR vs GST mismatch"
    }
    if (cross != null && cross.nilReturnMonthsWithBankCredits.isNotEmpty()) {
      mismatchPenalty += 25
      mismatchReasons += "NIL GST with bank credits"
    }
    mismatchPenalty = mismatchPenalty.coerceIn(0, 100)

    val gstScore = (100 - gstPenalty).coerceIn(0, 100)
    val itrScore = (100 - itrPenalty).coerceIn(0, 100)
    val overall =
      ((gstScore * 0.40) + (itrScore * 0.40) + ((100 - mismatchPenalty) * 0.20)).roundToLong().toInt().coerceIn(0, 100)

    val band =
      when {
        overall >= 75 -> "Strong"
        overall >= 55 -> "Moderate"
        else -> "Weak"
      }

    val reasons = (gstReasons + itrReasons + mismatchReasons).distinct().take(5)

    return UwCredibilityScore(
      score = overall,
      band = band,
      gstScore = gstScore,
      itrScore = itrScore,
      mismatchPenalty = mismatchPenalty,
      reasons = reasons,
    )
  }

  // ---- Rules ----

  private fun runRules(
    snapshot: Snapshot,
    creditHeat: List<UwCounterpartyRow>,
    debitHeat: List<UwCounterpartyRow>,
    lenders: UwPrivateLenderCompetition,
    velocity: UwCashVelocityControl,
    statementDays: Int,
  ): List<UwRuleRun> {
    val topCreditPct = creditHeat.firstOrNull()?.pctOfTotal ?: 0.0
    val top3CreditPct = creditHeat.take(3).sumOf { it.pctOfTotal }
    val lowBalanceRatio = if (statementDays <= 0) 0.0 else snapshot.lowBalanceDays.toDouble() / statementDays.toDouble()

    val rules = mutableListOf<UwRuleRun>()

    rules +=
      rule(
        id = "R001",
        name = "Statement period length",
        category = UwRuleCategory.Snapshot,
        severity = UwSeverity.Medium,
        passed = statementDays >= 90,
        scoreDeltaFail = -10,
        thresholds = buildJsonObject { put("min_days", 90) },
        evidence = buildJsonObject { put("statement_days", statementDays) },
        reasonFail = "Short statement window reduces confidence. Demand tighter structure / staged disbursal.",
        reasonPass = "Sufficient statement window for stability checks.",
      )

    rules +=
      rule(
        id = "R010",
        name = "Credit concentration (Top 1 source)",
        category = UwRuleCategory.Concentration,
        severity = UwSeverity.High,
        passed = topCreditPct < 40.0,
        scoreDeltaFail = -18,
        thresholds = buildJsonObject { put("top1_credit_pct_max", 40.0) },
        evidence = buildJsonObject { put("top1_credit_pct", topCreditPct) },
        reasonFail = "Borrower survival depends on 1 inflow. Control collections + cap exposure.",
        reasonPass = "No single inflow dominates the account.",
      )

    rules +=
      rule(
        id = "R011",
        name = "Credit concentration (Top 3 sources)",
        category = UwRuleCategory.Concentration,
        severity = UwSeverity.Medium,
        passed = top3CreditPct < 70.0,
        scoreDeltaFail = -10,
        thresholds = buildJsonObject { put("top3_credit_pct_max", 70.0) },
        evidence = buildJsonObject { put("top3_credit_pct", top3CreditPct) },
        reasonFail = "Inflow is concentrated. Stress appears quickly if 1-2 sources pause.",
        reasonPass = "Inflow sources are reasonably distributed.",
      )

    rules +=
      rule(
        id = "R020",
        name = "Liquidity stress (low-balance days)",
        category = UwRuleCategory.Liquidity,
        severity = UwSeverity.High,
        passed = lowBalanceRatio < 0.20,
        scoreDeltaFail = -18,
        thresholds = buildJsonObject { put("low_balance_days_ratio_max", 0.20) },
        evidence = buildJsonObject {
          put("low_balance_days", snapshot.lowBalanceDays)
          put("statement_days", statementDays)
          put("ratio", lowBalanceRatio)
        },
        reasonFail = "Account frequently hits near-zero. Weekly collections + high upfront deduction required.",
        reasonPass = "Liquidity buffer exists most days.",
      )

    rules +=
      rule(
        id = "R030",
        name = "Banking discipline (penalties/bounces)",
        category = UwRuleCategory.Discipline,
        severity = UwSeverity.Medium,
        passed = snapshot.penaltyChargeCount <= 2 && snapshot.bounceReturnCount <= 1,
        scoreDeltaFail = -12,
        thresholds = buildJsonObject { put("penalty_max", 2); put("bounce_max", 1) },
        evidence = buildJsonObject { put("penalty_charges", snapshot.penaltyChargeCount); put("bounce_returns", snapshot.bounceReturnCount) },
        reasonFail = "Discipline issues indicate payment instability. Price up + shorten tenure.",
        reasonPass = "No major penalty/bounce signal.",
      )

    rules +=
      rule(
        id = "R040",
        name = "Private lender competition",
        category = UwRuleCategory.Competition,
        severity = UwSeverity.High,
        passed = lenders.estimatedLenders <= 2 && !lenders.weeklyCollectionsDetected,
        scoreDeltaFail = -22,
        thresholds = buildJsonObject { put("estimated_lenders_max", 2); put("weekly_collections_allowed", false) },
        evidence = buildJsonObject { put("estimated_lenders", lenders.estimatedLenders); put("weekly_collections_detected", lenders.weeklyCollectionsDetected) },
        reasonFail = "Borrower is likely already stacked with private lenders. Reduce exposure + enforce weekly control.",
        reasonPass = "No strong stacking/weekly-collection signal.",
      )

    rules +=
      rule(
        id = "R050",
        name = "Cash velocity (same-day spend)",
        category = UwRuleCategory.Velocity,
        severity = UwSeverity.Medium,
        passed = velocity.sameDaySpendRatio < 0.85,
        scoreDeltaFail = -10,
        thresholds = buildJsonObject { put("same_day_spend_ratio_max", 0.85) },
        evidence = buildJsonObject { put("same_day_spend_ratio", velocity.sameDaySpendRatio) },
        reasonFail = "Pass-through behavior: inflows get drained fast. Collections must hit the inflow window.",
        reasonPass = "Cash retention is acceptable.",
      )

    rules +=
      rule(
        id = "R060",
        name = "Fixed obligations pressure",
        category = UwRuleCategory.Obligations,
        severity = UwSeverity.Medium,
        passed = snapshot.fixedObligationEstimateMonthly <= snapshot.avgMonthlyCredits * 0.55,
        scoreDeltaFail = -12,
        thresholds = buildJsonObject { put("fixed_obligation_pct_max", 0.55) },
        evidence = buildJsonObject {
          put("fixed_obligation_estimate_monthly", snapshot.fixedObligationEstimateMonthly)
          put("avg_monthly_credits", snapshot.avgMonthlyCredits)
          put("ratio", if (snapshot.avgMonthlyCredits <= 0.0) 0.0 else snapshot.fixedObligationEstimateMonthly / snapshot.avgMonthlyCredits)
        },
        reasonFail = "High fixed outflows reduce survivability. Keep tenure short + collect weekly.",
        reasonPass = "Obligation load appears manageable.",
      )

    return rules
  }

  private fun rule(
    id: String,
    name: String,
    category: UwRuleCategory,
    severity: UwSeverity,
    passed: Boolean,
    scoreDeltaFail: Int,
    thresholds: JsonObject,
    evidence: JsonObject,
    reasonFail: String,
    reasonPass: String,
  ): UwRuleRun {
    return UwRuleRun(
      id = id,
      name = name,
      category = category,
      severity = severity,
      passed = passed,
      scoreDelta = if (passed) 0 else scoreDeltaFail,
      thresholds = thresholds,
      evidence = evidence,
      reason = if (passed) reasonPass else reasonFail,
    )
  }

  // ---- Pricing / structure ----

  private fun riskGrade(score: Int): String =
    when {
      score >= 80 -> "A"
      score >= 65 -> "B"
      score >= 50 -> "C"
      else -> "D"
    }

  private fun pricingApr(
    grade: String,
    snapshot: Snapshot,
    lenders: UwPrivateLenderCompetition,
    velocity: UwCashVelocityControl,
  ): Double {
    // Lender-aggressive baseline: 30% APR equivalent (simple) + risk premium.
    val baseApr = 30.0
    val gradePremium =
      when (grade) {
        "A" -> 0.0
        "B" -> 6.0
        "C" -> 12.0
        else -> 18.0
      }
    val competitionPremium = if (lenders.estimatedLenders >= 3 || lenders.weeklyCollectionsDetected) 6.0 else 0.0
    val disciplinePremium = if (snapshot.bounceReturnCount >= 2 || snapshot.penaltyChargeCount >= 4) 6.0 else 0.0
    val volatilityPremium = if (snapshot.creditVolatility == "High") 4.0 else 0.0
    val velocityPremium = if (velocity.sameDaySpendRatio >= 0.9) 4.0 else 0.0
    return (baseApr + gradePremium + competitionPremium + disciplinePremium + volatilityPremium + velocityPremium).coerceIn(18.0, 72.0)
  }

  private fun structureLoan(
    requestedExposure: Long,
    maxTenure: Int,
    grade: String,
    score: Int,
    snapshot: Snapshot,
    lenders: UwPrivateLenderCompetition,
    pricingApr: Double,
  ): UwRecommendation {
    val monthlyRate = (pricingApr / 12.0) / 100.0

    val exposureFactor =
      when (grade) {
        "A" -> 1.0
        "B" -> 0.85
        "C" -> 0.70
        else -> 0.55
      }
    val cashCap = (snapshot.avgMonthlyCredits * 1.10).roundToLong().coerceAtLeast(5_00_000)
    val baseRecommended = min(requestedExposure, max(50_00_000, min(cashCap, requestedExposure))).toDouble()
    val recommendedExposure =
      (baseRecommended * exposureFactor)
        .roundToLong()
        .coerceAtLeast(10_00_000)
        .coerceAtMost(1_00_00_00_000)

    val tenureMonths =
      when {
        score >= 80 -> min(maxTenure, 12)
        score >= 65 -> min(maxTenure, 10)
        score >= 50 -> min(maxTenure, 8)
        else -> min(maxTenure, 6)
      }.coerceIn(1, 12)

    val frequency =
      if (grade == "C" || grade == "D" || lenders.weeklyCollectionsDetected || lenders.estimatedLenders >= 3) UwCollectionFrequency.Weekly
      else UwCollectionFrequency.Monthly

    // Upfront deduction as % of total interest across the proposed tenure.
    val upfrontPctBase =
      when (grade) {
        "A" -> 0.12
        "B" -> 0.18
        "C" -> 0.28
        else -> 0.38
      }
    val upfrontPct =
      (upfrontPctBase +
          (if (lenders.estimatedLenders >= 3) 0.07 else 0.0) +
          (if (snapshot.lowBalanceDays > 0) 0.03 else 0.0))
        .coerceIn(0.10, 0.60)

    val totalInterest = (recommendedExposure.toDouble() * monthlyRate * tenureMonths.toDouble()).roundToLong()
    val upfrontDeductionAmt = (totalInterest.toDouble() * upfrontPct).roundToLong().coerceAtLeast(0)
    val remainingInterest = max(0L, totalInterest - upfrontDeductionAmt)

    val periods =
      when (frequency) {
        UwCollectionFrequency.Weekly -> max(1, tenureMonths * 4)
        UwCollectionFrequency.Monthly -> tenureMonths
      }
    val principalPerPeriod = (recommendedExposure.toDouble() / periods.toDouble()).roundToLong().coerceAtLeast(0)
    val interestPerPeriod = (remainingInterest.toDouble() / periods.toDouble()).roundToLong().coerceAtLeast(0)
    val collectionAmount = max(1_000L, principalPerPeriod + interestPerPeriod)

    val staged =
      grade == "C" || grade == "D" || lenders.estimatedLenders >= 3 || lenders.rolloverRecyclingSignals >= 2
    val stage1 = if (!staged) recommendedExposure else (recommendedExposure.toDouble() * 0.60).roundToLong()
    val stage2 = if (!staged) 0L else (recommendedExposure - stage1).coerceAtLeast(0)

    val structureJson =
      buildJsonObject {
        put("schedule_type", "amortized_simple")
        put("net_disbursed_estimate", recommendedExposure - upfrontDeductionAmt)
        put("staged_disbursement", staged)
        put("stage_1_amount", stage1)
        put("stage_2_amount", stage2)
        put("stage_2_condition", if (staged) "Release only after 2 clean collection cycles + no new lender signals." else "")
        put("best_collection_weekday", snapshot.weekdayCreditTotals.entries.maxByOrNull { it.value }?.key?.name ?: "MONDAY")
      }

    return UwRecommendation(
      recommendedExposure = recommendedExposure,
      tenureMonths = tenureMonths,
      collectionFrequency = frequency,
      collectionAmount = collectionAmount,
      upfrontDeductionPct = upfrontPct,
      upfrontDeductionAmt = upfrontDeductionAmt,
      pricingApr = pricingApr,
      structure = structureJson,
    )
  }

  // ---- Triggers ----

  private fun buildTriggers(
    snapshot: Snapshot,
    recommendation: UwRecommendation,
    lenders: UwPrivateLenderCompetition,
    velocity: UwCashVelocityControl,
  ): List<UwEarlyWarningTrigger> {
    val out = mutableListOf<UwEarlyWarningTrigger>()

    val weeklyInflow = snapshot.avgWeeklyCredits
    val lowBalanceHardStop = max(50_000L, (weeklyInflow * 0.15).roundToLong())
    val lowBalanceWarn = max(1_00_000L, (weeklyInflow * 0.25).roundToLong())

    out +=
      trigger(
        "BALANCE_HARD_STOP",
        UwSeverity.Critical,
        buildJsonObject { put("balance_lt", lowBalanceHardStop) },
        "Hard-stop: if balance drops below ₹${formatInr(lowBalanceHardStop)}, freeze disbursal/stop rolling and collect immediately.",
      )
    out +=
      trigger(
        "BALANCE_WARN",
        UwSeverity.High,
        buildJsonObject { put("balance_lt", lowBalanceWarn) },
        "Warning: if balance stays below ₹${formatInr(lowBalanceWarn)} for 2 consecutive days, switch to daily follow-up + tighten collections.",
      )

    if (lenders.estimatedLenders >= 3 || lenders.weeklyCollectionsDetected) {
      out +=
        trigger(
          "NEW_LENDER_SIGNAL",
          UwSeverity.High,
          buildJsonObject {
            put("estimated_lenders", lenders.estimatedLenders)
            put("weekly_collections_detected", lenders.weeklyCollectionsDetected)
          },
          "Private-lender stacking detected. Any new lender entry/interest payment → immediately re-price + reduce exposure / stop stage-2.",
        )
    }

    if (snapshot.bounceReturnCount > 0) {
      out +=
        trigger(
          "BOUNCE_OR_RETURN",
          UwSeverity.High,
          buildJsonObject { put("bounce_return_count", snapshot.bounceReturnCount) },
          "Bounce/return detected. Treat as stress: tighten collection frequency and demand bank-day evidence.",
        )
    }

    if (velocity.sameDaySpendRatio >= 0.85) {
      out +=
        trigger(
          "SPIKE_THEN_DRAIN",
          UwSeverity.Medium,
          buildJsonObject { put("same_day_spend_ratio_gte", 0.85) },
          "Spike-then-drain pattern. Collections must align with peak inflow day(s) only.",
        )
    }

    out +=
      trigger(
        "COLLECTION_MISS",
        UwSeverity.Critical,
        buildJsonObject { put("miss_count_gte", 1) },
        "Any 1 missed collection → classify as early default risk and move to recovery mode (no comfort).",
      )

    return out
  }

  private fun trigger(type: String, severity: UwSeverity, condition: JsonObject, description: String): UwEarlyWarningTrigger =
    UwEarlyWarningTrigger(triggerType = type, severity = severity, condition = condition, description = description)

  // ---- Verdict & summary ----

  private fun buildVerdict(
    score: Int,
    grade: String,
    snapshot: Snapshot,
    creditHeat: List<UwCounterpartyRow>,
    lenders: UwPrivateLenderCompetition,
    recommendation: UwRecommendation,
  ): UwVerdict {
    val top = creditHeat.firstOrNull()
    val topSource = top?.counterparty ?: "primary inflow"
    val topPct = top?.pctOfTotal ?: 0.0

    val recoveryLeverageSummary =
      buildString {
        if (topPct >= 40.0) append("Recovery leverage weak: inflow concentrated in $topSource (${pct1(topPct / 100.0)} of credits). ")
        else append("Recovery leverage moderate: no single inflow dominates. ")
        if (lenders.estimatedLenders >= 3) append("Competition high: stacked with private lenders → recovery contest likely. ")
        if (snapshot.lowBalanceDays > 0) append("Liquidity buffer thin → faster default if inflow pauses. ")
      }.trim()

    val riskFit =
      when {
        score >= 70 -> UwRiskFit.Accept
        score >= 50 -> UwRiskFit.AcceptWithControl
        else -> UwRiskFit.Avoid
      }

    val stressDays =
      when {
        topPct >= 60.0 -> 7
        topPct >= 40.0 -> 10
        snapshot.lowBalanceDays >= (recommendation.tenureMonths * 2) -> 10
        else -> 14
      }

    val street =
      "Borrower survives on $topSource inflow (~${topPct.toInt()}% of credits). If disrupted, stress appears within ~$stressDays days. " +
        "${recommendation.collectionFrequency.name} collections must align on ${recommendation.structure["best_collection_weekday"]?.toString() ?: "peak days"}. " +
        "Exposure beyond ₹${formatInr(recommendation.recommendedExposure)} materially increases recovery risk."

    return UwVerdict(
      riskFit = riskFit,
      riskGrade = grade,
      score = score,
      streetSummary = street,
      recoveryLeverageSummary = recoveryLeverageSummary,
    )
  }

  private fun buildAggressiveSummary(
    snapshot: Snapshot,
    creditHeat: List<UwCounterpartyRow>,
    lenders: UwPrivateLenderCompetition,
    recommendation: UwRecommendation,
    verdict: UwVerdict,
    cross: UwCrossVerification?,
  ): String {
    val top = creditHeat.firstOrNull()
    val topSource = top?.counterparty ?: "Unknown"
    val topPct = top?.pctOfTotal ?: 0.0
    val inflow = snapshot.avgMonthlyCredits.roundToLong()

    return buildString {
      append("AGGRESSIVE VERDICT: ")
      append(verdict.riskFit.name.replace("AcceptWithControl", "Accept with Control"))
      append(" | Grade ")
      append(verdict.riskGrade)
      append(" | Score ")
      append(verdict.score)
      append("\n")
      append("Recommended Exposure: ₹")
      append(formatInr(recommendation.recommendedExposure))
      append(" | Pricing: ")
      append(recommendation.pricingApr)
      append("% APR | Collections: ")
      append(recommendation.collectionFrequency.name)
      append(" ₹")
      append(formatInr(recommendation.collectionAmount))
      append("\n")
      append("Cash power: avg monthly credits ₹")
      append(formatInr(inflow))
      append(". Top inflow source: ")
      append(topSource)
      append(" (")
      append(topPct.toInt())
      append("%). ")
      if (lenders.estimatedLenders > 0) {
        append("Private lenders estimated: ")
        append(lenders.estimatedLenders)
        append(". ")
      }
      if (lenders.weeklyCollectionsDetected) append("Weekly collections already exist → must control strictly. ")
      append("Upfront interest deduction: ")
      append((recommendation.upfrontDeductionPct * 100.0).roundToLong())
      append("% (₹")
      append(formatInr(recommendation.upfrontDeductionAmt))
      append(").")

      if (cross != null && cross.mismatchFlags.isNotEmpty()) {
        append("\n")
        append("Cross-check: ")
        if (cross.bankVsGstAvgDiffPct != null) {
          append("Bank↔GST avg diff ")
          append((cross.bankVsGstAvgDiffPct * 10.0).roundToLong() / 10.0)
          append("%; ")
        }
        if (cross.bankVsItrAvgDiffPct != null) {
          append("Bank↔ITR avg diff ")
          append((cross.bankVsItrAvgDiffPct * 10.0).roundToLong() / 10.0)
          append("%; ")
        }
        append("Flags: ")
        append(cross.mismatchFlags.joinToString(", "))
        append(".")
      }
    }
  }

  // ---- Helpers ----

  private fun classifyCreditNature(counterparty: String): String {
    val t = counterparty.uppercase()
    return when {
      "SALARY" in t -> "Salary"
      "UPI" in t || "IMPS" in t || "NEFT" in t || "RTGS" in t -> "Transfer"
      "CASH" in t -> "Cash deposit"
      else -> "Receipts"
    }
  }

  private fun classifyDebitType(counterparty: String): Triple<String, String, String> {
    val t = counterparty.uppercase()
    return when {
      "EMI" in t || "LOAN" in t || "INTEREST" in t || "FINANCE" in t -> Triple("Existing lender", "High", "No")
      "RENT" in t -> Triple("Rent", "High", "No")
      "SALARY" in t || "WAGE" in t -> Triple("Payroll", "High", "No")
      "GST" in t || "TDS" in t || "PF" in t -> Triple("Statutory", "High", "No")
      "CHARGE" in t || "PENAL" in t || "FEE" in t -> Triple("Bank charges", "Medium", "No")
      else -> Triple("Supplier/ops", "Medium", "Maybe")
    }
  }

  private fun extractCounterparty(narrationRaw: String): String {
    val narration = narrationRaw.trim().replace(Regex("\\s+"), " ")
    val parts = narration.split("/", "-", "|").map { it.trim() }.filter { it.isNotEmpty() }
    val best =
      parts.asReversed().firstOrNull { p ->
        val up = p.uppercase()
        p.length >= 3 && up.any { it.isLetter() } && !up.startsWith("UPI") && !up.startsWith("IMPS") && !up.startsWith("NEFT")
      }
    return (best ?: parts.lastOrNull() ?: narration).take(42)
  }

  private fun isPrivateLenderKeyword(narration: String): Boolean {
    val t = narration.uppercase()
    val keywords =
      listOf(
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
      )
    return keywords.any { it in t }
  }

  private fun isPenaltyCharge(narration: String): Boolean {
    val t = narration.uppercase()
    return "CHARGE" in t || "PENAL" in t || "FEE" in t || "SMS" in t || "AMM" in t
  }

  private fun isBounceOrReturn(narration: String): Boolean {
    val t = narration.uppercase()
    return "BOUNCE" in t || "RETURN" in t || "RTO" in t || "REVERS" in t || "FAILED" in t
  }

  private fun isRoundFigure(amount: Long): Boolean {
    if (amount <= 0) return false
    return amount % 10_000L == 0L || amount % 5_000L == 0L || amount % 1_000L == 0L
  }

  private fun estimateFixedObligationsMonthly(txs: List<NTx>, statementDays: Int, avgMonthlyCredits: Double): Double {
    if (statementDays <= 0) return 0.0
    val debits = txs.filter { it.debit > 0 }
    if (debits.isEmpty()) return 0.0
    // Rough recurring: same counterparty appears 2+ times, and amount variance is small.
    val groups = debits.groupBy { extractCounterparty(it.narration) }
    var recurringSum = 0.0
    for ((_, list) in groups) {
      if (list.size < 2) continue
      val amounts = list.map { it.debit.toDouble() }
      val mean = amounts.average()
      val maxDev = amounts.maxOf { abs(it - mean) } / max(1.0, mean)
      if (maxDev <= 0.12) {
        // Scale to monthly by days
        val sum = list.sumOf { it.debit }.toDouble()
        recurringSum += (sum / statementDays.toDouble()) * 30.0
      }
    }
    // Keep it conservative: cap at 80% of avg monthly credits.
    return recurringSum.coerceAtMost(avgMonthlyCredits * 0.80)
  }

  private fun detectBankName(txs: List<NTx>): String {
    val sample = txs.take(50).joinToString(" ") { it.narration.uppercase() }
    return when {
      "HDFC" in sample -> "HDFC"
      "ICICI" in sample -> "ICICI"
      "AXIS" in sample -> "AXIS"
      "SBI" in sample || "STATE BANK" in sample -> "SBI"
      "KOTAK" in sample -> "KOTAK"
      "INDUSIND" in sample -> "INDUSIND"
      else -> ""
    }
  }

  private fun detectAccountType(txs: List<NTx>): String {
    val sample = txs.take(50).joinToString(" ") { it.narration.uppercase() }
    return when {
      "SAVINGS" in sample -> "SAVINGS"
      "CURRENT" in sample -> "CURRENT"
      else -> ""
    }
  }

  private fun formatInr(amount: Long): String {
    val n = abs(amount)
    val s = n.toString()
    if (s.length <= 3) return s
    val last3 = s.takeLast(3)
    var rest = s.dropLast(3)
    val parts = mutableListOf<String>()
    while (rest.length > 2) {
      parts += rest.takeLast(2)
      rest = rest.dropLast(2)
    }
    if (rest.isNotEmpty()) parts += rest
    return parts.asReversed().joinToString(",") + "," + last3
  }

  private fun pct1(ratio: Double): String = "${(ratio * 1000.0).roundToLong() / 10.0}%"
}
