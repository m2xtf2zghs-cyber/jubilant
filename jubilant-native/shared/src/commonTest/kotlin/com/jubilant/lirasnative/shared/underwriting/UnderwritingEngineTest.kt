package com.jubilant.lirasnative.shared.underwriting

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toEpochDays

class UnderwritingEngineTest {
  @Test
  fun flagsConcentrationLiquidityAndPrivateLenderSignals() {
    val txs = mutableListOf<UwTransaction>()
    // 100-day statement window so "short period" rule passes.
    // Credits are highly concentrated and balances are always near-zero -> should fail concentration + liquidity rules.
    val start = LocalDate.parse("2025-10-01")
    for (i in 0 until 100) {
      val date = LocalDate.fromEpochDays(start.toEpochDays() + i).toString()
      txs +=
        UwTransaction(
          date = date,
          narration = "NEFT/SALES/XYZ TRADERS",
          credit = 100_000,
          balance = 10_000,
        )
      // Weekly lender-like debit pattern.
      if (i % 7 == 0) {
        txs +=
          UwTransaction(
            date = date,
            narration = "UPI/INTEREST RETURN/RAJ",
            debit = 50_000,
            balance = 5_000,
          )
      }
    }

    val result = UnderwritingEngine.runUnderwriting(txs, UwParams(requestedExposure = 1_00_00_000, maxTenureMonths = 12))

    val r010 = result.ruleRunLog.find { it.id == "R010" }
    assertNotNull(r010)
    assertFalse(r010.passed)

    val r020 = result.ruleRunLog.find { it.id == "R020" }
    assertNotNull(r020)
    assertFalse(r020.passed)

    val r040 = result.ruleRunLog.find { it.id == "R040" }
    assertNotNull(r040)
    assertFalse(r040.passed)

    assertTrue(result.privateLenderCompetition.weeklyCollectionsDetected)
    assertTrue(result.privateLenderCompetition.estimatedLenders >= 1)
    assertTrue(result.recommendation.collectionFrequency == UwCollectionFrequency.Weekly)
  }

  @Test
  fun stableProfileGetsAcceptOrControl() {
    val txs = mutableListOf<UwTransaction>()
    for (d in 1..120) {
      val day = (d % 28 + 1).toString().padStart(2, '0')
      val month = if (d <= 60) "01" else "02"
      val date = "2026-$month-$day"
      txs +=
        UwTransaction(
          date = date,
          narration = "NEFT/RECEIPT/CLIENT_A",
          credit = 80_000,
          balance = 600_000,
        )
      txs +=
        UwTransaction(
          date = date,
          narration = "UPI/SUPPLIER/PAYMENT",
          debit = 40_000,
          balance = 560_000,
        )
    }

    val result = UnderwritingEngine.runUnderwriting(txs, UwParams(requestedExposure = 50_00_000, maxTenureMonths = 12))
    assertTrue(result.verdict.score >= 50)
    assertTrue(result.verdict.riskFit == UwRiskFit.Accept || result.verdict.riskFit == UwRiskFit.AcceptWithControl)
  }

  @Test
  fun gstItrCrossChecksAddRulesAndTriggers() {
    val txs = mutableListOf<UwTransaction>()
    val start = LocalDate.parse("2026-01-01")
    for (i in 0 until 92) {
      val date = LocalDate.fromEpochDays(start.toEpochDays() + i).toString()
      txs +=
        UwTransaction(
          date = date,
          narration = "NEFT/SALES/ACME DISTRIBUTORS",
          credit = 100_000,
          balance = 500_000,
        )
      txs +=
        UwTransaction(
          date = date,
          narration = "UPI/SUPPLIER/PAYMENT",
          debit = 60_000,
          balance = 440_000,
        )
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

    val result = UnderwritingEngine.runUnderwriting(txs, UwParams(requestedExposure = 1_00_00_000, maxTenureMonths = 12), docs)

    val gst05 = result.ruleRunLog.find { it.id == "GST-05" }
    assertNotNull(gst05)
    assertFalse(gst05.passed)

    val itr05 = result.ruleRunLog.find { it.id == "ITR-05" }
    assertNotNull(itr05)
    assertFalse(itr05.passed)

    val itr01 = result.ruleRunLog.find { it.id == "ITR-01" }
    assertNotNull(itr01)
    assertFalse(itr01.passed)

    val itr04 = result.ruleRunLog.find { it.id == "ITR-04" }
    assertNotNull(itr04)
    assertFalse(itr04.passed)

    assertNotNull(result.crossVerification)
    assertTrue((result.crossVerification?.mismatchFlags ?: emptyList()).isNotEmpty())
    assertTrue(result.triggers.any { it.triggerType == "BANK_GST_MISMATCH" })
  }
}
