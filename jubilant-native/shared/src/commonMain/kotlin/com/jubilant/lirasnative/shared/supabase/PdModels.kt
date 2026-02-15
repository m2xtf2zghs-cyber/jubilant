package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject

@Serializable
data class PdSessionRow(
  val id: String,
  @SerialName("application_id")
  val applicationId: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("created_at")
  val createdAt: String,
  @SerialName("updated_at")
  val updatedAt: String,
  @SerialName("updated_by")
  val updatedBy: String? = null,
  val status: String = "in_progress",
  @SerialName("open_items_status")
  val openItemsStatus: String = "pending",
)

@Serializable
data class PdSessionCreateInput(
  val ownerId: String,
  val applicationId: String,
  val status: String = "in_progress",
  val openItemsStatus: String = "pending",
)

@Serializable
data class PdSessionUpdate(
  val status: String? = null,
  @SerialName("open_items_status")
  val openItemsStatus: String? = null,
)

@Serializable
data class PdAnswerRow(
  val id: String,
  @SerialName("pd_session_id")
  val pdSessionId: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("created_at")
  val createdAt: String,
  @SerialName("updated_at")
  val updatedAt: String,
  @SerialName("updated_by")
  val updatedBy: String? = null,
  @SerialName("field_key")
  val fieldKey: String,
  @SerialName("field_label")
  val fieldLabel: String = "",
  @SerialName("value_text")
  val valueText: String? = null,
  @SerialName("value_number")
  val valueNumber: Double? = null,
  @SerialName("value_json")
  val valueJson: JsonElement? = null,
)

@Serializable
data class PdAnswerUpsertInput(
  val ownerId: String,
  val pdSessionId: String,
  val fieldKey: String,
  val fieldLabel: String = "",
  val valueText: String? = null,
  val valueNumber: Double? = null,
  val valueJson: JsonElement? = null,
)

@Serializable
data class PdGeneratedQuestionRow(
  val id: String,
  @SerialName("pd_session_id")
  val pdSessionId: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("created_at")
  val createdAt: String,
  @SerialName("updated_at")
  val updatedAt: String,
  @SerialName("updated_by")
  val updatedBy: String? = null,
  val code: String,
  val severity: String,
  val category: String = "",
  @SerialName("question_text")
  val questionText: String,
  @SerialName("answer_type")
  val answerType: String = "text",
  @SerialName("options_json")
  val optionsJson: JsonElement? = null,
  @SerialName("evidence_json")
  val evidenceJson: JsonElement? = null,
  @SerialName("source_rule_id")
  val sourceRuleId: String? = null,
  val status: String = "Pending",
)

@Serializable
data class PdGeneratedQuestionUpsertInput(
  val ownerId: String,
  val pdSessionId: String,
  val code: String,
  val severity: String,
  val category: String = "",
  val questionText: String,
  val answerType: String = "text",
  val optionsJson: JsonElement? = null,
  val evidenceJson: JsonElement? = null,
  val sourceRuleId: String? = null,
  val status: String = "Pending",
)

@Serializable
data class PdGeneratedQuestionUpdate(
  val status: String? = null,
)

@Serializable
data class PdGeneratedAnswerRow(
  val id: String,
  @SerialName("question_id")
  val questionId: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_at")
  val createdAt: String,
  @SerialName("updated_at")
  val updatedAt: String,
  @SerialName("updated_by")
  val updatedBy: String? = null,
  @SerialName("answer_text")
  val answerText: String? = null,
  @SerialName("answer_number")
  val answerNumber: Double? = null,
  @SerialName("answer_json")
  val answerJson: JsonElement? = null,
  @SerialName("attachment_path")
  val attachmentPath: String? = null,
)

@Serializable
data class PdGeneratedAnswerUpsertInput(
  val ownerId: String,
  val questionId: String,
  val answerText: String? = null,
  val answerNumber: Double? = null,
  val answerJson: JsonElement? = null,
  val attachmentPath: String? = null,
)

@Serializable
data class PdAttachmentRow(
  val id: String,
  @SerialName("pd_session_id")
  val pdSessionId: String,
  @SerialName("owner_id")
  val ownerId: String,
  @SerialName("created_by")
  val createdBy: String,
  @SerialName("created_at")
  val createdAt: String,
  @SerialName("question_id")
  val questionId: String? = null,
  @SerialName("storage_path")
  val storagePath: String,
  @SerialName("file_type")
  val fileType: String = "",
  @SerialName("meta_json")
  val metaJson: JsonObject = buildJsonObject { },
)

@Serializable
data class PdAttachmentCreateInput(
  val ownerId: String,
  val pdSessionId: String,
  val questionId: String? = null,
  val storagePath: String,
  val fileType: String = "",
  val metaJson: JsonObject = buildJsonObject { },
)

