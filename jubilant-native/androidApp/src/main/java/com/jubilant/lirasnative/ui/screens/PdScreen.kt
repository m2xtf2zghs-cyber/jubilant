package com.jubilant.lirasnative.ui.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.PdRepository
import com.jubilant.lirasnative.di.UnderwritingRepository
import com.jubilant.lirasnative.shared.pd.DynamicDoubtsGenerator
import com.jubilant.lirasnative.shared.pd.PdAnswerType
import com.jubilant.lirasnative.shared.pd.PdDoubtSeverity
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.PdAttachmentCreateInput
import com.jubilant.lirasnative.shared.supabase.PdGeneratedAnswerUpsertInput
import com.jubilant.lirasnative.shared.supabase.PdGeneratedQuestionRow
import com.jubilant.lirasnative.shared.supabase.PdGeneratedQuestionUpsertInput
import com.jubilant.lirasnative.shared.supabase.PdSessionRow
import com.jubilant.lirasnative.shared.underwriting.UnderwritingResult
import com.jubilant.lirasnative.ui.theme.Danger500
import com.jubilant.lirasnative.ui.theme.Gold500
import com.jubilant.lirasnative.ui.theme.Success500
import com.jubilant.lirasnative.ui.util.PdLocalStore
import java.net.URLConnection
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

private val UW_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

private val PD_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

private fun pdSeverityToDb(sev: PdDoubtSeverity): String =
  when (sev) {
    PdDoubtSeverity.Alert -> "Alert"
    PdDoubtSeverity.HighRisk -> "High Risk"
    PdDoubtSeverity.ImmediateAction -> "Immediate Action"
  }

private fun pdAnswerTypeToDb(t: PdAnswerType): String =
  when (t) {
    PdAnswerType.Text -> "text"
    PdAnswerType.Number -> "number"
    PdAnswerType.Date -> "date"
    PdAnswerType.YesNo -> "yes-no"
    PdAnswerType.File -> "file"
    PdAnswerType.Select -> "select"
  }

private fun coveredCodesFromPdMasterV50(): Set<String> =
  setOf(
    "D020_GST_DISCIPLINE",
    "D021_BANK_VS_GST_MISMATCH",
    "D022_BANK_VS_ITR_MISMATCH",
    "D030_PRIVATE_LENDER_STACKING",
    "D050_PENALTY_BOUNCE_RETURN",
    "D060_FIXED_OBLIGATIONS_PRESSURE",
    "D070_ITR_MARGIN_THIN",
  )

private fun metric(uw: UnderwritingResult?, key: String): Double? =
  uw?.metrics?.firstOrNull { it.key == key }?.value

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdScreen(
  applicationId: String,
  leadId: String,
  leadsRepository: LeadsRepository,
  underwritingRepository: UnderwritingRepository,
  pdRepository: PdRepository,
  session: SessionState,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val scroll = rememberScrollState()

  var tab by rememberSaveable { mutableStateOf(0) } // 0: Doubts, 1: PD Form

  var loading by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var statusMsg by remember { mutableStateOf<String?>(null) }

  var lead by remember { mutableStateOf<Lead?>(null) }
  var uw by remember { mutableStateOf<UnderwritingResult?>(null) }
  var pdSession by remember { mutableStateOf<PdSessionRow?>(null) }

  var questions by remember { mutableStateOf<List<PdGeneratedQuestionRow>>(emptyList()) }
  var answersByQ by remember { mutableStateOf<Map<String, String>>(emptyMap()) } // questionId -> answerText (MVP)

  var pdDraft by remember { mutableStateOf<JsonElement?>(null) }
  var webViewRef by remember { mutableStateOf<WebView?>(null) }
  var pdMasterSaveJob by remember { mutableStateOf<Job?>(null) }
  var doubtsSaveJob by remember { mutableStateOf<Job?>(null) }

  fun resolveDisplayName(uri: Uri): String {
    val cr = context.contentResolver
    val name =
      runCatching {
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) cursor.getString(0) else null
        }
      }.getOrNull()
    return name?.takeIf { it.isNotBlank() } ?: "evidence"
  }

  fun contentTypeFor(uri: Uri, fileName: String): String =
    context.contentResolver.getType(uri)
      ?: URLConnection.guessContentTypeFromName(fileName)
      ?: "application/octet-stream"

  suspend fun refresh() {
    if (applicationId.isBlank()) return
    loading = true
    error = null
    try {
      // Lead (best-effort)
      lead = runCatching { leadsRepository.getLead(leadId) }.getOrNull()

      val app = underwritingRepository.getApplication(applicationId)
      val uwDecoded = UW_JSON.decodeFromJsonElement(UnderwritingResult.serializer(), app.reportJson)
      uw = uwDecoded

      val ownerId = app.ownerId
      val sess = pdRepository.getOrCreateSession(applicationId = app.id, ownerId = ownerId)
      pdSession = sess

      val remoteDraft = runCatching { pdRepository.getMasterDraft(sess.id) }.getOrNull()
      val localDraftStr = PdLocalStore.loadPdMasterDraft(context, applicationId)
      val localDraft = localDraftStr?.let { runCatching { PD_JSON.parseToJsonElement(it) }.getOrNull() }
      pdDraft = remoteDraft ?: localDraft

      // Generate doubts (deterministic) and upsert (ignore duplicates)
      val generated = DynamicDoubtsGenerator.generate(uwDecoded, coveredCodesFromPdMasterV50()).filter { !it.coveredByPd }
      val upsertRows =
        generated.map { q ->
          PdGeneratedQuestionUpsertInput(
            ownerId = ownerId,
            pdSessionId = sess.id,
            code = q.code,
            severity = pdSeverityToDb(q.severity),
            category = q.category,
            questionText = q.questionText,
            answerType = pdAnswerTypeToDb(q.answerType),
            optionsJson = q.options,
            evidenceJson = q.evidence,
            sourceRuleId = q.sourceRuleId,
            status = "Pending",
          )
        }
      runCatching { pdRepository.upsertQuestionsIgnoreDuplicates(upsertRows) }

      val qRows = pdRepository.listQuestions(sess.id)
      questions = qRows

      val answers = pdRepository.listAnswers(qRows.map { it.id })
      answersByQ =
        answers.associate { a ->
          val text = a.answerText ?: ""
          a.questionId to text
        }
    } catch (e: Exception) {
      error = e.message ?: "Couldn’t load PD data."
    } finally {
      loading = false
    }
  }

  fun sendInitToWebView() {
    val wv = webViewRef ?: return
    val u = uw ?: return

    val prefill =
      buildJsonObject {
        put("c_name", lead?.name ?: "")
        put("c_phone", lead?.phone ?: "")
        put("c_address", lead?.location ?: "")
        metric(u, "avg_monthly_credits")?.let { put("b_turnover", it.toLong().toString()) }
        metric(u, "bounce_return_count")?.let { put("b_bounce", it.toLong().toString()) }
        put("p_amt", u.recommendation.recommendedExposure.toString())
        put("p_roi", ((u.recommendation.pricingApr * 10.0).toLong() / 10.0).toString())
        put("p_ten", u.recommendation.tenureMonths.toString())
      }

    val payload =
      buildJsonObject {
        put("prefill", prefill)
        when (val d = pdDraft) {
          null -> put("draft", JsonNull)
          else -> put("draft", d)
        }
      }

    val js = "window.__PD_HOST_INIT__(${PD_JSON.encodeToString(JsonElement.serializer(), payload)});"
    wv.evaluateJavascript(js, null)
  }

  LaunchedEffect(applicationId) {
    refresh()
  }

  // Evidence upload (optional)
  var pendingUploadQ by remember { mutableStateOf<PdGeneratedQuestionRow?>(null) }
  val pickEvidence =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      val q = pendingUploadQ
      pendingUploadQ = null
      if (uri == null || q == null) return@rememberLauncherForActivityResult
      val sess = pdSession ?: return@rememberLauncherForActivityResult
      val ownerId = sess.ownerId
      scope.launch {
        loading = true
        error = null
        try {
          runCatching {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
          val fileName = resolveDisplayName(uri)
          val contentType = contentTypeFor(uri, fileName)
          val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read file.")
          val path = pdRepository.uploadEvidence(ownerId, sess.id, q.id, fileName, bytes, contentType)
          pdRepository.createAttachment(
            PdAttachmentCreateInput(
              ownerId = ownerId,
              pdSessionId = sess.id,
              questionId = q.id,
              storagePath = path,
              fileType = contentType,
              metaJson =
                buildJsonObject {
                  put("file_name", fileName)
                  put("size", bytes.size)
                },
            ),
          )
          // Link to answer (MVP: store attachment path in answer_json)
          pdRepository.upsertAnswer(
            PdGeneratedAnswerUpsertInput(
              ownerId = ownerId,
              questionId = q.id,
              attachmentPath = path,
              answerText = answersByQ[q.id] ?: null,
            ),
          )
          pdRepository.updateQuestion(q.id, status = "Resolved")
          statusMsg = "Evidence uploaded"
          refresh()
        } catch (e: Exception) {
          error = e.message ?: "Upload failed."
        } finally {
          loading = false
        }
      }
    }

  fun immediatePendingCount(): Int =
    questions.count { it.severity == "Immediate Action" && it.status != "Resolved" && it.status != "Waived" }

  fun anyPending(): Boolean = questions.any { it.status != "Resolved" && it.status != "Waived" }

  fun saveLocalDoubtAnswer(code: String, text: String) {
    val existing = PdLocalStore.loadDoubtsDraft(context, applicationId)
    val next =
      runCatching {
        val base = existing?.let { PD_JSON.parseToJsonElement(it) }?.jsonObject ?: emptyMap()
        buildJsonObject {
          base.forEach { (k, v) -> put(k, v) }
          put(code, text)
        }
      }.getOrElse {
        buildJsonObject { put(code, text) }
      }
    PdLocalStore.saveDoubtsDraft(context, applicationId, PD_JSON.encodeToString(JsonElement.serializer(), next))
  }

  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("PD + Dynamic Doubts", style = MaterialTheme.typography.titleLarge)
        Text(
          "Underwriting-driven doubts are deterministic and evidence-backed. Clear all Immediate Action items before submission.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
          "Lead: ${lead?.name ?: leadId.take(8)} • UW: ${applicationId.take(8)}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    if (error != null) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(
          error ?: "",
          modifier = Modifier.padding(12.dp),
          color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodyMedium,
        )
      }
    }

    if (statusMsg != null) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Success500.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, Success500.copy(alpha = 0.35f)),
      ) {
        Text(statusMsg ?: "", modifier = Modifier.padding(12.dp), color = Success500, style = MaterialTheme.typography.bodyMedium)
      }
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
      TextButton(onClick = { scope.launch { refresh() } }, enabled = !loading) { Text("Refresh") }
      Spacer(Modifier.weight(1f))
      Button(
        onClick = {
          val sess = pdSession ?: return@Button
          scope.launch {
            if (immediatePendingCount() > 0) {
              error = "Resolve all Immediate Action doubts first (${immediatePendingCount()} pending)."
              return@launch
            }
            loading = true
            error = null
            try {
              val openItemsStatus = if (anyPending()) "pending" else "resolved"
              pdRepository.updateSession(id = sess.id, status = "submitted", openItemsStatus = openItemsStatus)
              statusMsg = "PD submitted"
              delay(1200)
              statusMsg = null
              refresh()
            } catch (e: Exception) {
              error = e.message ?: "Submit failed."
            } finally {
              loading = false
            }
          }
        },
        enabled = !loading && pdSession != null,
      ) {
        if (loading) {
          CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
          Spacer(Modifier.size(10.dp))
        }
        Text("Submit PD")
      }
    }

    TabRow(selectedTabIndex = tab) {
      Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Doubts") })
      Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("PD Form") })
    }

    if (tab == 0) {
      if (questions.isEmpty() && !loading) {
        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
          Text(
            "No dynamic doubts generated for this underwriting run.",
            modifier = Modifier.padding(14.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }

      questions.forEach { q ->
        val sevColor =
          when (q.severity) {
            "Immediate Action" -> Danger500
            "High Risk" -> Gold500
            else -> MaterialTheme.colorScheme.onSurfaceVariant
          }

        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
              Text(q.severity, color = sevColor, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.ExtraBold)
              Spacer(Modifier.size(10.dp))
              Text(q.category.ifBlank { "—" }, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
              Spacer(Modifier.weight(1f))
              Text(
                q.status,
                style = MaterialTheme.typography.labelLarge,
                color = if (q.status == "Resolved") Success500 else MaterialTheme.colorScheme.onSurfaceVariant,
              )
            }

            Text(q.questionText, style = MaterialTheme.typography.bodyMedium)
            Text(
              q.code,
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
            )

            val current = answersByQ[q.id].orEmpty()
            OutlinedTextField(
              value = current,
              onValueChange = { next ->
                answersByQ = answersByQ.toMutableMap().apply { put(q.id, next) }
                val sess = pdSession ?: return@OutlinedTextField
                val ownerId = sess.ownerId
                // Local store (offline safety)
                saveLocalDoubtAnswer(q.code, next)

                doubtsSaveJob?.cancel()
                doubtsSaveJob =
                  scope.launch {
                    delay(650)
                    runCatching {
                      pdRepository.upsertAnswer(PdGeneratedAnswerUpsertInput(ownerId = ownerId, questionId = q.id, answerText = next))
                      if (next.trim().isNotEmpty()) pdRepository.updateQuestion(q.id, status = "Resolved")
                    }.onSuccess {
                      if (next.trim().isNotEmpty()) {
                        questions = questions.map { row -> if (row.id == q.id) row.copy(status = "Resolved") else row }
                      }
                    }.onFailure { ex ->
                      statusMsg = "Saved locally (offline)."
                      error = ex.message ?: "Couldn’t sync answer."
                    }
                  }
              },
              modifier = Modifier.fillMaxWidth(),
              label = { Text("Answer") },
              colors =
                TextFieldDefaults.outlinedTextFieldColors(
                  focusedBorderColor = MaterialTheme.colorScheme.secondary,
                  focusedLabelColor = MaterialTheme.colorScheme.secondary,
                ),
              minLines = 3,
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
              TextButton(
                onClick = {
                  scope.launch {
                    runCatching { pdRepository.updateQuestion(q.id, status = "Pending") }
                    refresh()
                  }
                },
                enabled = !loading,
              ) {
                Text("Mark pending")
              }
              TextButton(
                onClick = {
                  scope.launch {
                    runCatching { pdRepository.updateQuestion(q.id, status = "Resolved") }
                    refresh()
                  }
                },
                enabled = !loading,
              ) {
                Text("Resolve")
              }
              if (session.isAdmin) {
                TextButton(
                  onClick = {
                    scope.launch {
                      runCatching { pdRepository.updateQuestion(q.id, status = "Waived") }
                      refresh()
                    }
                  },
                  enabled = !loading,
                ) {
                  Text("Waive")
                }
              }
              Spacer(Modifier.weight(1f))
              TextButton(
                onClick = {
                  pendingUploadQ = q
                  pickEvidence.launch(arrayOf("*/*"))
                },
                enabled = !loading,
              ) {
                Text("Upload evidence")
              }
            }
          }
        }
      }
    } else {
      if (pdSession == null) {
        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
          Text(
            "PD form requires an active session (cloud). Go back online and refresh.",
            modifier = Modifier.padding(14.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      } else {
        PdMasterWebView(
          applicationId = applicationId,
          htmlAssetUrl = "file:///android_asset/pd/pd_master_v50.html",
          onWebViewReady = { wv ->
            webViewRef = wv
            sendInitToWebView()
          },
          onDraftChanged = { draft ->
            pdDraft = draft
            // Local save
            PdLocalStore.savePdMasterDraft(context, applicationId, PD_JSON.encodeToString(JsonElement.serializer(), draft))

            // Cloud save (throttled)
            val sess = pdSession ?: return@PdMasterWebView
            val ownerId = sess.ownerId
            pdMasterSaveJob?.cancel()
            pdMasterSaveJob =
              scope.launch {
                delay(900)
                statusMsg = "Saving draft…"
                runCatching { pdRepository.upsertMasterDraft(ownerId = ownerId, pdSessionId = sess.id, draft = draft) }
                  .onSuccess { statusMsg = "Draft saved" }
                  .onFailure { ex ->
                    statusMsg = "Saved locally"
                    error = ex.message ?: "Couldn’t sync PD draft."
                  }
                delay(1200)
                statusMsg = null
              }
          },
        )
      }
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun PdMasterWebView(
  applicationId: String,
  htmlAssetUrl: String,
  onWebViewReady: (WebView) -> Unit,
  onDraftChanged: (JsonElement) -> Unit,
) {
  val context = LocalContext.current

  AndroidView(
    modifier = Modifier.fillMaxWidth().height(900.dp),
    factory = {
      WebView(context).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        webViewClient =
          object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
              super.onPageFinished(view, url)
              onWebViewReady(this@apply)
            }
          }

        addJavascriptInterface(
          object {
            @JavascriptInterface
            fun postMessage(message: String) {
              // Called from PD HTML: window.JubilantAndroid.postMessage(JSON.stringify(msg))
              runCatching {
                val el = PD_JSON.parseToJsonElement(message).jsonObject
                val source = el["source"]?.jsonPrimitive?.content.orEmpty()
                if (source != "PD_MASTER_V50") return@runCatching
                val type = el["type"]?.jsonPrimitive?.content.orEmpty()
                if (type == "PD_DRAFT_CHANGE") {
                  val payload = el["payload"] ?: return@runCatching
                  onDraftChanged(payload)
                }
              }
            }
          },
          "JubilantAndroid",
        )

        loadUrl(htmlAssetUrl)
      }
    },
    update = { _ ->
      // no-op
    },
  )
}
