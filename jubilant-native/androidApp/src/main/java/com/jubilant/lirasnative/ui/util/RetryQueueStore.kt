package com.jubilant.lirasnative.ui.util

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.MediatorUpdate
import java.io.File
import java.util.UUID
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

private const val FILE_NAME = "retry_queue.json"
private const val KEY_COUNT = "retry_queue_count"
private const val MAX_QUEUE_ITEMS = 300

private val QUEUE_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
    classDiscriminator = "type"
  }

@Serializable
sealed class RetryQueueAction {
  abstract val id: String
  abstract val createdAtMs: Long

  @Serializable
  @SerialName("lead_update")
  data class LeadUpdateAction(
    override val id: String,
    override val createdAtMs: Long,
    val leadId: String,
    val patch: LeadUpdate,
  ) : RetryQueueAction()

  @Serializable
  @SerialName("lead_append_note")
  data class LeadAppendNoteAction(
    override val id: String,
    override val createdAtMs: Long,
    val leadId: String,
    val note: LeadNote,
  ) : RetryQueueAction()

  @Serializable
  @SerialName("mediator_update")
  data class MediatorUpdateAction(
    override val id: String,
    override val createdAtMs: Long,
    val mediatorId: String,
    val patch: MediatorUpdate,
  ) : RetryQueueAction()

  @Serializable
  @SerialName("pd_master_draft")
  data class PdMasterDraftAction(
    override val id: String,
    override val createdAtMs: Long,
    val ownerId: String,
    val pdSessionId: String,
    val draft: JsonElement,
  ) : RetryQueueAction()

  @Serializable
  @SerialName("pd_doubt_answer")
  data class PdDoubtAnswerAction(
    override val id: String,
    override val createdAtMs: Long,
    val ownerId: String,
    val questionId: String,
    val answerText: String,
    val markResolved: Boolean,
  ) : RetryQueueAction()
}

object RetryQueueStore {
  private val ser = ListSerializer(RetryQueueAction.serializer())
  private val lock = Any()

  private fun file(context: Context): File = File(context.filesDir, FILE_NAME)

  fun load(context: Context): List<RetryQueueAction> =
    synchronized(lock) {
      runCatching {
        val f = file(context)
        if (!f.exists()) return@runCatching emptyList()
        QUEUE_JSON.decodeFromString(ser, f.readText())
      }.getOrNull() ?: emptyList()
    }

  private fun save(context: Context, actions: List<RetryQueueAction>) {
    synchronized(lock) {
      runCatching {
        val next = actions.takeLast(MAX_QUEUE_ITEMS)
        file(context).writeText(QUEUE_JSON.encodeToString(ser, next))
        prefs(context).edit().putInt(KEY_COUNT, next.size).apply()
      }
    }
  }

  fun count(context: Context): Int {
    val cached = prefs(context).getInt(KEY_COUNT, -1)
    return if (cached >= 0) cached else load(context).size
  }

  fun enqueueLeadUpdate(context: Context, leadId: String, patch: LeadUpdate) {
    val now = System.currentTimeMillis()
    val action =
      RetryQueueAction.LeadUpdateAction(
        id = UUID.randomUUID().toString(),
        createdAtMs = now,
        leadId = leadId,
        patch = patch,
      )
    val next = load(context) + action
    save(context, next)
  }

  fun enqueueLeadAppendNote(context: Context, leadId: String, note: LeadNote) {
    val now = System.currentTimeMillis()
    val action =
      RetryQueueAction.LeadAppendNoteAction(
        id = UUID.randomUUID().toString(),
        createdAtMs = now,
        leadId = leadId,
        note = note,
      )
    val next = load(context) + action
    save(context, next)
  }

  fun enqueueMediatorUpdate(context: Context, mediatorId: String, patch: MediatorUpdate) {
    val now = System.currentTimeMillis()
    val action =
      RetryQueueAction.MediatorUpdateAction(
        id = UUID.randomUUID().toString(),
        createdAtMs = now,
        mediatorId = mediatorId,
        patch = patch,
      )
    val next = load(context) + action
    save(context, next)
  }

  fun enqueuePdMasterDraft(context: Context, ownerId: String, pdSessionId: String, draft: JsonElement) {
    val now = System.currentTimeMillis()
    val action =
      RetryQueueAction.PdMasterDraftAction(
        id = UUID.randomUUID().toString(),
        createdAtMs = now,
        ownerId = ownerId,
        pdSessionId = pdSessionId,
        draft = draft,
      )
    val next =
      load(context)
        .filterNot { it is RetryQueueAction.PdMasterDraftAction && it.pdSessionId == pdSessionId } + action
    save(context, next)
  }

  fun enqueuePdDoubtAnswer(
    context: Context,
    ownerId: String,
    questionId: String,
    answerText: String,
    markResolved: Boolean,
  ) {
    val now = System.currentTimeMillis()
    val action =
      RetryQueueAction.PdDoubtAnswerAction(
        id = UUID.randomUUID().toString(),
        createdAtMs = now,
        ownerId = ownerId,
        questionId = questionId,
        answerText = answerText,
        markResolved = markResolved,
      )
    val next =
      load(context)
        .filterNot { it is RetryQueueAction.PdDoubtAnswerAction && it.questionId == questionId } + action
    save(context, next)
  }

  fun removeById(context: Context, id: String) {
    val next = load(context).filterNot { it.id == id }
    save(context, next)
  }

  fun clear(context: Context) {
    synchronized(lock) {
      runCatching { file(context).delete() }
      prefs(context).edit().putInt(KEY_COUNT, 0).apply()
    }
  }

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}

@Composable
fun rememberRetryQueueCount(): Int {
  val context = LocalContext.current.applicationContext
  val prefs = remember(context) { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
  var count by remember { mutableIntStateOf(RetryQueueStore.count(context)) }

  DisposableEffect(prefs) {
    val listener =
      SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == KEY_COUNT) {
          count = RetryQueueStore.count(context)
        }
      }
    prefs.registerOnSharedPreferenceChangeListener(listener)
    onDispose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
  }

  return count
}
