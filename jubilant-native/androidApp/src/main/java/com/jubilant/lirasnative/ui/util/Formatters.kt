package com.jubilant.lirasnative.ui.util

import java.text.DecimalFormat

fun formatCompactInr(amount: Long): String {
    if (amount <= 0) return "₹0"

    val abs = amount.toDouble()
    val df2 = DecimalFormat("0.00")
    val df1 = DecimalFormat("0.0")

    return when {
        abs >= 10_000_000 -> "₹${df2.format(abs / 10_000_000)} Cr"
        abs >= 100_000 -> "₹${df2.format(abs / 100_000)} L"
        abs >= 1_000 -> "₹${df1.format(abs / 1_000)} K"
        else -> "₹$amount"
    }
}

fun formatShortDate(raw: String): String {
  val s = raw.trim()
  if (s.isEmpty()) return ""
  return if (s.length >= 10) s.substring(0, 10) else s
}
