package com.jubilant.lirasnative.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jubilant.lirasnative.di.AppContainer
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.ui.util.KEY_SYNC_PAUSED
import com.jubilant.lirasnative.ui.util.PREFS_NAME
import com.jubilant.lirasnative.ui.util.RetryQueueAction
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import kotlinx.serialization.json.Json

private val PD_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

class RetrySyncWorker(
  private val appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val syncPaused = prefs.getBoolean(KEY_SYNC_PAUSED, false)
    val forceRun = inputData.getBoolean(RetrySyncScheduler.INPUT_FORCE_RUN, false)
    if (syncPaused && !forceRun) return Result.success()

    val container = AppContainer(appContext)
    val supabase = container.supabaseClient
    if (!supabase.isConfigured()) return Result.success()

    // Only attempt syncing when a session exists.
    val session = runCatching { supabase.restoreSession() }.getOrNull()
    if (session == null) return Result.success()

    val targetActionId = inputData.getString(RetrySyncScheduler.INPUT_ACTION_ID)?.trim().orEmpty()
    val allActions = RetryQueueStore.load(appContext)
    val actions =
      if (targetActionId.isBlank()) allActions
      else allActions.filter { it.id == targetActionId }
    if (actions.isEmpty()) return Result.success()

    for (action in actions) {
      val ok =
        runCatching {
          processAction(container, action)
        }.isSuccess

      if (ok) {
        RetryQueueStore.removeById(appContext, action.id)
      } else {
        // Keep remaining items; retry later.
        return Result.retry()
      }
    }

    return Result.success()
  }

  private suspend fun processAction(container: AppContainer, action: RetryQueueAction) {
    when (action) {
      is RetryQueueAction.LeadUpdateAction -> {
        container.leadsRepository.updateLead(action.leadId, action.patch)
      }

      is RetryQueueAction.LeadAppendNoteAction -> {
        val lead = container.leadsRepository.getLead(action.leadId)
        val note = action.note
        val already =
          lead.notes.any { n ->
            n.date == note.date && n.text == note.text && (n.byUser ?: "") == (note.byUser ?: "")
          }
        if (already) return
        val nextNotes = (lead.notes + note).takeLast(500)
        container.leadsRepository.updateLead(action.leadId, LeadUpdate(notes = nextNotes))
      }

      is RetryQueueAction.MediatorUpdateAction -> {
        container.mediatorsRepository.updateMediator(action.mediatorId, action.patch)
      }

      is RetryQueueAction.PdMasterDraftAction -> {
        val draft = action.draft
        container.pdRepository.upsertMasterDraft(ownerId = action.ownerId, pdSessionId = action.pdSessionId, draft = draft)
      }

      is RetryQueueAction.PdDoubtAnswerAction -> {
        container.pdRepository.upsertAnswer(
          com.jubilant.lirasnative.shared.supabase.PdGeneratedAnswerUpsertInput(
            ownerId = action.ownerId,
            questionId = action.questionId,
            answerText = action.answerText,
          ),
        )
        if (action.markResolved && action.answerText.trim().isNotEmpty()) {
          container.pdRepository.updateQuestion(action.questionId, status = "Resolved")
        }
      }
    }
  }
}
