package com.jubilant.lirasnative.ui.util

import java.time.LocalDate

enum class LoanFrequency(
  val key: String,
  val label: String,
) {
  Monthly("monthly", "Monthly"),
  Weekly("weekly", "Weekly"),
  BiWeekly("biweekly", "Bi-Weekly"),
  BiMonthly("bimonthly", "Bi-Monthly"),
}

fun parseLoanFrequency(raw: String?): LoanFrequency {
  val s = raw?.trim().orEmpty().lowercase()
  if (s.isEmpty()) return LoanFrequency.Monthly
  return when {
    s == LoanFrequency.Monthly.key || s.contains("monthly") || s == "month" || s == "m" -> LoanFrequency.Monthly
    s == LoanFrequency.Weekly.key || s.contains("weekly") || s == "week" || s == "w" -> LoanFrequency.Weekly
    s == LoanFrequency.BiWeekly.key || s.contains("biweekly") || s.contains("bi-weekly") -> LoanFrequency.BiWeekly
    s == LoanFrequency.BiMonthly.key || s.contains("bimonthly") || s.contains("bi-monthly") -> LoanFrequency.BiMonthly
    else -> LoanFrequency.Monthly
  }
}

fun frequencyTenureLabel(frequency: LoanFrequency): String =
  when (frequency) {
    LoanFrequency.Monthly -> "Tenure (months)"
    LoanFrequency.Weekly, LoanFrequency.BiWeekly -> "Tenure (weeks)"
    LoanFrequency.BiMonthly -> "Tenure (15-day cycles)"
  }

fun formatTenureShort(
  tenure: Int,
  frequency: LoanFrequency,
): String =
  when (frequency) {
    LoanFrequency.Monthly -> "${tenure}m"
    LoanFrequency.Weekly, LoanFrequency.BiWeekly -> "${tenure}w"
    LoanFrequency.BiMonthly -> "${tenure}×15d"
  }

/**
 * Calculates the "Our Interest Rate" value using the exact formula structure requested:
 *
 * Monthly (unchanged):
 *   ( interest / given ) / ( (weeks + 1) / 2 ) * 100
 *
 * Weekly / Bi-Weekly / Bi-Monthly:
 *   ( interest / given ) / ( (weeks + 1) / 2 ) / DAYS * 3000
 */
fun calculateInterestRatePercent(
  given: Double,
  interest: Double,
  weeks: Double,
  frequency: LoanFrequency,
): Double {
  if (given <= 0.0 || weeks <= 0.0) return 0.0

  // Monthly logic must remain untouched.
  if (frequency == LoanFrequency.Monthly) {
    return (interest / given) / ((weeks + 1.0) / 2.0) * 100.0
  }

  val days =
    when (frequency) {
      LoanFrequency.Weekly -> 7.0
      LoanFrequency.BiWeekly -> 14.0
      LoanFrequency.BiMonthly -> 15.0
      LoanFrequency.Monthly -> 0.0
    }
  if (days <= 0.0) return 0.0

  return (interest / given) / ((weeks + 1.0) / 2.0) / days * 3000.0
}

fun followUpAt50PctTerm(
  start: LocalDate,
  weeks: Int,
  frequency: LoanFrequency,
): LocalDate {
  val half = (weeks / 2).coerceAtLeast(0)
  return when (frequency) {
    LoanFrequency.Monthly -> start.plusMonths(half.toLong())
    LoanFrequency.Weekly, LoanFrequency.BiWeekly -> start.plusWeeks(half.toLong())
    LoanFrequency.BiMonthly -> start.plusDays(half.toLong() * 15L)
  }
}

