package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.RawStatementLineCreateInput
import com.jubilant.lirasnative.shared.supabase.StatementCreateInput
import com.jubilant.lirasnative.shared.supabase.StatementRow
import com.jubilant.lirasnative.shared.supabase.StatementVersionCreateInput
import com.jubilant.lirasnative.shared.supabase.StatementVersionRow
import com.jubilant.lirasnative.shared.supabase.PdfFileCreateInput
import com.jubilant.lirasnative.shared.supabase.PdfFileRow
import com.jubilant.lirasnative.shared.supabase.SupabaseClient
import com.jubilant.lirasnative.shared.supabase.TransactionCreateInput
import com.jubilant.lirasnative.shared.supabase.MonthlyAggregateCreateInput
import com.jubilant.lirasnative.shared.supabase.PivotCreateInput
import com.jubilant.lirasnative.shared.supabase.ReconciliationFailureCreateInput

class StatementRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun createStatement(input: StatementCreateInput): StatementRow =
    supabase.createStatement(input)

  suspend fun createStatementVersion(input: StatementVersionCreateInput): StatementVersionRow =
    supabase.createStatementVersion(input)

  suspend fun createPdfFile(input: PdfFileCreateInput): PdfFileRow =
    supabase.createPdfFile(input)

  suspend fun uploadStatementPdf(
    ownerId: String,
    statementVersionId: String,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String = supabase.uploadStatementPdf(ownerId, statementVersionId, fileName, bytes, contentType)

  suspend fun insertRawLines(input: List<RawStatementLineCreateInput>) {
    supabase.insertRawStatementLines(input)
  }

  suspend fun insertTransactions(input: List<TransactionCreateInput>) {
    supabase.insertStatementTransactions(input)
  }

  suspend fun insertMonthlyAggregates(input: List<MonthlyAggregateCreateInput>) {
    supabase.insertMonthlyAggregates(input)
  }

  suspend fun insertPivots(input: List<PivotCreateInput>) {
    supabase.insertStatementPivots(input)
  }

  suspend fun insertReconciliationFailure(input: ReconciliationFailureCreateInput) {
    supabase.insertReconciliationFailure(input)
  }

  suspend fun updateStatementVersionStatus(versionId: String, status: String): StatementVersionRow =
    supabase.updateStatementVersionStatus(versionId, status)
}
