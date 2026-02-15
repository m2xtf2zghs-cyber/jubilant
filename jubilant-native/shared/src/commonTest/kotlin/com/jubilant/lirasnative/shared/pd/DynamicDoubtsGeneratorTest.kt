package com.jubilant.lirasnative.shared.pd

import com.jubilant.lirasnative.shared.underwriting.UnderwritingEngine
import com.jubilant.lirasnative.shared.underwriting.UwDocsInput
import com.jubilant.lirasnative.shared.underwriting.UwGstMonth
import com.jubilant.lirasnative.shared.underwriting.UwItrYear
import com.jubilant.lirasnative.shared.underwriting.UwParams
import com.jubilant.lirasnative.shared.underwriting.UwTransaction
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toEpochDays

class DynamicDoubtsGeneratorTest {
  @Test
  fun generatesConcentrationAndLenderStackingDoubts() {
    val txs = mutableListOf<UwTransaction>()
    val start = LocalDate.parse("2025-10-01")
    for (i in 0 until 100) {
      val date = LocalDate.fromEpochDays(start.toEpochDays() + i).toString()
      txs += UwTransaction(date = date, narration = "NEFT/SALES/XYZ TRADERS", credit = 100_000, balance = 10_000)
      if (i % 7 == 0) {
        txs += UwTransaction(date = date, narration = "UPI/INTEREST RETURN/RAJ", debit = 50_000, balance = 5_000)
      }
    }

    val uw = UnderwritingEngine.runUnderwriting(txs, UwParams(requestedExposure = 1_00_00_000, maxTenureMonths = 12))
    val doubts = DynamicDoubtsGenerator.generate(uw)

    assertTrue(doubts.any { it.code == "D010_TOP1_CREDIT_CONCENTRATION" })
    assertTrue(doubts.any { it.code == "D030_PRIVATE_LENDER_STACKING" })
    assertTrue(doubts.any { it.code == "D061_LIQUIDITY_STRESS" })
  }

  @Test
  fun gstItrMismatchCreatesCrossVerificationDoubts() {
    val txs = mutableListOf<UwTransaction>()
    val start = LocalDate.parse("2026-01-01")
    for (i in 0 until 92) {
      val date = LocalDate.fromEpochDays(start.toEpochDays() + i).toString()
      txs += UwTransaction(date = date, narration = "NEFT/SALES/ACME DISTRIBUTORS", credit = 100_000, balance = 500_000)
      txs += UwTransaction(date = date, narration = "UPI/SUPPLIER/PAYMENT", debit = 60_000, balance = 440_000)
    }

    val docs =
      UwDocsInput(
        gstMonths =
          listOf(
            UwGstMonth(month = "2026-01", turnover = 10_00_000, daysLate = 0),
            UwGstMonth(month = "2026-02", turnover = 10_00_000, daysLate = 0),
            UwGstMonth(month = "2026-03", turnover = 10_00_000, daysLate = 0),
          ),
        itrYears =
          listOf(
            UwItrYear(year = "AY 2024-25", turnover = 1_20_00_000, profit = 2_00_000),
            UwItrYear(year = "AY 2023-24", turnover = 1_00_00_000, profit = 4_00_000),
          ),
      )

    val uw = UnderwritingEngine.runUnderwriting(txs, UwParams(requestedExposure = 1_00_00_000, maxTenureMonths = 12), docs)
    assertNotNull(uw.crossVerification)

    val doubts = DynamicDoubtsGenerator.generate(uw, coveredCodes = setOf("D021_BANK_VS_GST_MISMATCH"))
    assertTrue(doubts.any { it.code == "D022_BANK_VS_ITR_MISMATCH" })

    val gstMismatch = doubts.firstOrNull { it.code == "D021_BANK_VS_GST_MISMATCH" }
    assertNotNull(gstMismatch)
    assertTrue(gstMismatch.coveredByPd)
  }

  @Test
  fun gstMissedFilingGapGeneratesDoubtWithMonths() {
    val txs = mutableListOf<UwTransaction>()
    val start = LocalDate.parse("2026-01-01")
    for (i in 0 until 60) {
      val date = LocalDate.fromEpochDays(start.toEpochDays() + i).toString()
      txs += UwTransaction(date = date, narration = "NEFT/SALES/CLIENT_A", credit = 100_000, balance = 250_000)
      txs += UwTransaction(date = date, narration = "UPI/SUPPLIER/PAYMENT", debit = 60_000, balance = 190_000)
    }

    val docs =
      UwDocsInput(
        gstMonths =
          listOf(
            UwGstMonth(month = "2026-01", turnover = 15_00_000, daysLate = 0),
            // Skip Feb to create a gap.
            UwGstMonth(month = "2026-03", turnover = 15_00_000, daysLate = 0),
          ),
      )

    val uw = UnderwritingEngine.runUnderwriting(txs, UwParams(requestedExposure = 1_00_00_000, maxTenureMonths = 12), docs)
    val doubts = DynamicDoubtsGenerator.generate(uw)

    assertTrue(doubts.any { it.code == "D200_GST_MISSED_FILINGS" })
  }
}
