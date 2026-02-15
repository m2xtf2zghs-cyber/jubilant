package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject

@Serializable
data class UnderwritingApplicationRow(
  val id: String,
  @SerialName("owner_id") val ownerId: String,
  @SerialName("created_by") val createdBy: String,
  @SerialName("lead_id") val leadId: String? = null,
  @SerialName("created_at") val createdAt: String,
  @SerialName("updated_at") val updatedAt: String,
  val status: String = "completed",
  @SerialName("period_start") val periodStart: String? = null,
  @SerialName("period_end") val periodEnd: String? = null,
  @SerialName("bank_name") val bankName: String = "",
  @SerialName("account_type") val accountType: String = "",
  @SerialName("requested_exposure") val requestedExposure: Long = 0,
  @SerialName("report_json") val reportJson: JsonElement = buildJsonObject { },
  @SerialName("aggressive_summary") val aggressiveSummary: String = "",
)

@Serializable
data class UnderwritingApplicationCreateInput(
  val ownerId: String,
  val leadId: String?,
  val status: String,
  val periodStart: String?,
  val periodEnd: String?,
  val bankName: String,
  val accountType: String,
  val requestedExposure: Long,
  val reportJson: JsonElement,
  val aggressiveSummary: String,
)

@Serializable
data class UnderwritingApplicationListItem(
  val id: String,
  @SerialName("lead_id") val leadId: String? = null,
  @SerialName("created_at") val createdAt: String,
  val status: String = "completed",
  @SerialName("period_start") val periodStart: String? = null,
  @SerialName("period_end") val periodEnd: String? = null,
  @SerialName("bank_name") val bankName: String = "",
  @SerialName("account_type") val accountType: String = "",
  @SerialName("requested_exposure") val requestedExposure: Long = 0,
  @SerialName("aggressive_summary") val aggressiveSummary: String = "",
)

@Serializable
data class UnderwritingDocumentCreateInput(
  val applicationId: String,
  val ownerId: String,
  val type: String, // BANK_PDF | GST | ITR
  val storagePath: String,
  val metaJson: JsonObject = buildJsonObject { },
)

@Serializable
data class UnderwritingDocumentRow(
  val id: String,
  @SerialName("application_id") val applicationId: String,
  @SerialName("owner_id") val ownerId: String,
  @SerialName("created_by") val createdBy: String,
  @SerialName("created_at") val createdAt: String,
  val type: String,
  @SerialName("storage_path") val storagePath: String,
  @SerialName("meta_json") val metaJson: JsonObject = buildJsonObject { },
)

