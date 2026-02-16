package com.jubilant.lirasnative.shared.statement

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class StatementAutopilotEngineTest {
  @Test
  fun testNormalizeAndReconcile() {
    val rawLines =
      listOf(
        RawStatementLine(
          id = "1",
          pageNo = 1,
          rowNo = 1,
          rawRowText = "01/01/2025 NEFT ABC TRADERS 0 50000 150000",
        ),
        RawStatementLine(
          id = "2",
          pageNo = 1,
          rowNo = 2,
          rawRowText = "02/01/2025 ATM CASH 10000 0 140000",
        ),
        RawStatementLine(
          id = "3",
          pageNo = 1,
          rowNo = 3,
          rawRowText = "CONTINUATION LINE FOR ATM CASH",
        ),
      )

    val result = StatementAutopilotEngine.run(rawLines, bankName = "TMB", accountType = "CURRENT")
    assertEquals(2, result.transactions.size)
    assertTrue(result.reconciliation.unmappedLineIds.isEmpty())
    assertEquals(StatementParseStatus.READY, result.reconciliation.status)
  }
}
