package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
data class StatementRow(
  val id: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("lead_id")
  val leadId: String? = null,
  @SerialName("account_id")
  val accountId: String? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
)

@Serializable
data class StatementCreateInput(
  val ownerId: String,
  val leadId: String? = null,
  val accountId: String? = null,
)

@Serializable
data class StatementVersionRow(
  val id: String,
  @SerialName("statement_id")
  val statementId: String,
  val status: String,
  @SerialName("version_no")
  val versionNo: Int,
  @SerialName("created_at")
  val createdAt: String? = null,
  @SerialName("template_id")
  val templateId: String? = null,
  @SerialName("bank_name")
  val bankName: String? = null,
  @SerialName("account_type")
  val accountType: String? = null,
  @SerialName("period_start")
  val periodStart: String? = null,
  @SerialName("period_end")
  val periodEnd: String? = null,
  @SerialName("report_json")
  val reportJson: JsonObject? = null,
)

@Serializable
data class StatementVersionCreateInput(
  val statementId: String,
  val ownerId: String,
  val status: String,
  val versionNo: Int,
  val templateId: String? = null,
  val bankName: String? = null,
  val accountType: String? = null,
  val periodStart: String? = null,
  val periodEnd: String? = null,
  val reportJson: JsonObject? = null,
)

@Serializable
data class PdfFileRow(
  val id: String,
  @SerialName("statement_version_id")
  val statementVersionId: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("storage_path")
  val storagePath: String,
  @SerialName("file_name")
  val fileName: String? = null,
  @SerialName("meta_json")
  val metaJson: JsonObject? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
)

@Serializable
data class PdfFileCreateInput(
  val statementVersionId: String,
  val ownerId: String,
  val storagePath: String,
  val fileName: String? = null,
  val metaJson: JsonObject? = null,
)

@Serializable
data class RawStatementLineCreateInput(
  val versionId: String,
  val ownerId: String,
  val pdfFileId: String? = null,
  val pageNo: Int,
  val rowNo: Int,
  val rawRowText: String,
  val rawDateText: String? = null,
  val rawNarrationText: String? = null,
  val rawDrText: String? = null,
  val rawCrText: String? = null,
  val rawBalanceText: String? = null,
  val rawLineType: String,
  val extractionMethod: String? = null,
  val bboxJson: JsonObject? = null,
)

@Serializable
data class TransactionCreateInput(
  val versionId: String,
  val ownerId: String,
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
  val flagsJson: JsonElement? = null,
  val transactionUid: String,
)

@Serializable
data class MonthlyAggregateCreateInput(
  val versionId: String,
  val ownerId: String,
  val month: String,
  val metricsJson: JsonElement,
)

@Serializable
data class PivotCreateInput(
  val versionId: String,
  val ownerId: String,
  val pivotType: String,
  val rowsJson: JsonElement,
)

@Serializable
data class ReconciliationFailureCreateInput(
  val versionId: String,
  val ownerId: String,
  val unmappedLineIds: JsonElement,
  val continuityFailures: JsonElement,
)

@Serializable
data class BankParsingTemplateRow(
  val id: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("bank_name")
  val bankName: String,
  val country: String? = null,
  @SerialName("statement_variants")
  val statementVariants: JsonElement? = null,
  @SerialName("header_keywords_json")
  val headerKeywords: JsonElement? = null,
  @SerialName("date_regex")
  val dateRegex: String? = null,
  @SerialName("amount_regex")
  val amountRegex: String? = null,
  @SerialName("table_detection_strategy")
  val tableDetectionStrategy: String? = null,
  @SerialName("column_map_json")
  val columnMap: JsonElement? = null,
  @SerialName("row_start_rules_json")
  val rowStartRules: JsonElement? = null,
  @SerialName("multiline_rules_json")
  val multilineRules: JsonElement? = null,
  @SerialName("cleanup_rules_json")
  val cleanupRules: JsonElement? = null,
  @SerialName("preferred_extractors")
  val preferredExtractors: JsonElement? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
  @SerialName("updated_at")
  val updatedAt: String? = null,
)

@Serializable
data class BankParsingTemplateCreateInput(
  val ownerId: String,
  val bankName: String,
  val country: String? = null,
  val statementVariants: JsonElement? = null,
  val headerKeywords: JsonElement? = null,
  val dateRegex: String? = null,
  val amountRegex: String? = null,
  val tableDetectionStrategy: String? = null,
  val columnMap: JsonElement? = null,
  val rowStartRules: JsonElement? = null,
  val multilineRules: JsonElement? = null,
  val cleanupRules: JsonElement? = null,
  val preferredExtractors: JsonElement? = null,
)
