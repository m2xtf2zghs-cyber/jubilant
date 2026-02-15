package com.jubilant.lirasnative.shared.pd

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject

@Serializable
enum class PdDoubtSeverity {
  Alert,
  HighRisk,
  ImmediateAction,
}

@Serializable
enum class PdAnswerType {
  Text,
  Number,
  Date,
  YesNo,
  Select,
  File,
}

@Serializable
enum class PdDoubtStatus {
  Pending,
  Resolved,
  Waived,
}

@Serializable
data class PdGeneratedQuestion(
  /** Stable deterministic code (used for de-dup + audit). */
  val code: String,
  val severity: PdDoubtSeverity,
  val category: String,
  val questionText: String,
  val answerType: PdAnswerType,
  val options: List<String> = emptyList(),
  val requiredUploadHint: String? = null,
  val evidence: JsonObject = buildJsonObject { },
  val sourceRuleId: String? = null,
  /** If true, the app should treat this as covered by an existing PD mandatory field and not show it twice. */
  val coveredByPd: Boolean = false,
)

