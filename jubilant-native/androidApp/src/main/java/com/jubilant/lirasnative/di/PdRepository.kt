package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.PdAnswerRow
import com.jubilant.lirasnative.shared.supabase.PdAnswerUpsertInput
import com.jubilant.lirasnative.shared.supabase.PdAttachmentCreateInput
import com.jubilant.lirasnative.shared.supabase.PdAttachmentRow
import com.jubilant.lirasnative.shared.supabase.PdGeneratedAnswerRow
import com.jubilant.lirasnative.shared.supabase.PdGeneratedAnswerUpsertInput
import com.jubilant.lirasnative.shared.supabase.PdGeneratedQuestionRow
import com.jubilant.lirasnative.shared.supabase.PdGeneratedQuestionUpsertInput
import com.jubilant.lirasnative.shared.supabase.PdGeneratedQuestionUpdate
import com.jubilant.lirasnative.shared.supabase.PdSessionCreateInput
import com.jubilant.lirasnative.shared.supabase.PdSessionRow
import com.jubilant.lirasnative.shared.supabase.PdSessionUpdate
import com.jubilant.lirasnative.shared.supabase.SupabaseClient
import kotlinx.serialization.json.JsonElement

class PdRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun getOrCreateSession(applicationId: String, ownerId: String): PdSessionRow =
    supabase.getOrCreatePdSession(PdSessionCreateInput(ownerId = ownerId, applicationId = applicationId))

  suspend fun updateSession(id: String, status: String? = null, openItemsStatus: String? = null): PdSessionRow =
    supabase.updatePdSession(id = id, patch = PdSessionUpdate(status = status, openItemsStatus = openItemsStatus))

  suspend fun getMasterDraft(pdSessionId: String): JsonElement? =
    supabase.getPdAnswer(pdSessionId = pdSessionId, fieldKey = "__pd_master_v50_json")?.valueJson

  suspend fun upsertMasterDraft(ownerId: String, pdSessionId: String, draft: JsonElement): PdAnswerRow =
    supabase.upsertPdAnswer(
      PdAnswerUpsertInput(
        ownerId = ownerId,
        pdSessionId = pdSessionId,
        fieldKey = "__pd_master_v50_json",
        fieldLabel = "PD Master v50 JSON",
        valueJson = draft,
      ),
    )

  suspend fun listQuestions(pdSessionId: String, limit: Int = 500): List<PdGeneratedQuestionRow> =
    supabase.listPdGeneratedQuestions(pdSessionId = pdSessionId, limit = limit)

  suspend fun upsertQuestionsIgnoreDuplicates(rows: List<PdGeneratedQuestionUpsertInput>) {
    supabase.upsertPdGeneratedQuestionsIgnoreDuplicates(rows)
  }

  suspend fun updateQuestion(id: String, status: String? = null) {
    supabase.updatePdGeneratedQuestion(id = id, patch = PdGeneratedQuestionUpdate(status = status))
  }

  suspend fun listAnswers(questionIds: List<String>, limit: Int = 500): List<PdGeneratedAnswerRow> =
    supabase.listPdGeneratedAnswers(questionIds = questionIds, limit = limit)

  suspend fun upsertAnswer(input: PdGeneratedAnswerUpsertInput): PdGeneratedAnswerRow =
    supabase.upsertPdGeneratedAnswer(input = input)

  suspend fun uploadEvidence(
    ownerId: String,
    pdSessionId: String,
    questionId: String?,
    fileName: String,
    bytes: ByteArray,
    contentType: String,
  ): String =
    supabase.uploadPdAttachment(
      ownerId = ownerId,
      pdSessionId = pdSessionId,
      questionId = questionId,
      fileName = fileName,
      bytes = bytes,
      contentType = contentType,
    )

  suspend fun createAttachment(input: PdAttachmentCreateInput): PdAttachmentRow = supabase.createPdAttachment(input = input)
}
