package com.jubilant.lirasnative.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.UnderwritingRepository
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.UnderwritingApplicationCreateInput
import com.jubilant.lirasnative.shared.supabase.UnderwritingApplicationListItem
import com.jubilant.lirasnative.shared.supabase.UnderwritingDocumentCreateInput
import com.jubilant.lirasnative.shared.underwriting.UnderwritingEngine
import com.jubilant.lirasnative.shared.underwriting.UnderwritingResult
import com.jubilant.lirasnative.shared.underwriting.UwDocsInput
import com.jubilant.lirasnative.shared.underwriting.UwParams
import com.jubilant.lirasnative.shared.underwriting.UwGstMonth
import com.jubilant.lirasnative.shared.underwriting.UwItrYear
import com.jubilant.lirasnative.ui.util.BankPdfParseResult
import com.jubilant.lirasnative.ui.util.parseBankStatementPdfs
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import java.io.File
import java.net.URLConnection
import java.time.Instant
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put

private val UW_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

private fun fmtInr(amount: Long): String {
  val x = kotlin.math.abs(amount)
  val s = x.toString()
  if (s.length <= 3) return "₹$x"
  val last3 = s.takeLast(3)
  var rest = s.dropLast(3)
  val parts = mutableListOf<String>()
  while (rest.length > 2) {
    parts.add(rest.takeLast(2))
    rest = rest.dropLast(2)
  }
  if (rest.isNotBlank()) parts.add(rest)
  return "₹${parts.reversed().joinToString(",")},$last3"
}

private fun uwCacheFile(
  context: Context,
  leadId: String,
): File = File(context.filesDir, "uw_cache_${leadId}.json")

private fun loadUwCache(
  context: Context,
  leadId: String,
): UnderwritingResult? =
  runCatching {
    val f = uwCacheFile(context, leadId)
    if (!f.exists()) return@runCatching null
    UW_JSON.decodeFromString(UnderwritingResult.serializer(), f.readText())
  }.getOrNull()

private fun saveUwCache(
  context: Context,
  leadId: String,
  result: UnderwritingResult,
) {
  runCatching {
    val f = uwCacheFile(context, leadId)
    f.writeText(UW_JSON.encodeToString(UnderwritingResult.serializer(), result))
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UnderwritingScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  underwritingRepository: UnderwritingRepository,
  session: SessionState,
  onProceedToPd: ((applicationId: String, leadId: String) -> Unit)? = null,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val scroll = rememberScrollState()
  var error by remember { mutableStateOf<String?>(null) }
  val errorHandler =
    remember {
      CoroutineExceptionHandler { _, throwable ->
        error = throwable.message ?: "Unexpected error"
      }
    }

  val actor = remember(session.userId, session.myProfile) { session.myProfile?.email ?: session.userId ?: "unknown" }

  var query by remember { mutableStateOf("") }
  var selectedLeadId by remember { mutableStateOf<String?>(null) }
  val selectedLead = remember(leads, selectedLeadId) { leads.firstOrNull { it.id == selectedLeadId } }

  var selectedUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
  var selectedNames by remember { mutableStateOf<List<String>>(emptyList()) }

  var gstUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
  var gstNames by remember { mutableStateOf<List<String>>(emptyList()) }
  var itrUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
  var itrNames by remember { mutableStateOf<List<String>>(emptyList()) }

  var gstMonths by remember { mutableStateOf<List<UwGstMonth>>(emptyList()) }
  var itrYears by remember { mutableStateOf<List<UwItrYear>>(emptyList()) }
  var itrProfitText by remember { mutableStateOf<List<String>>(emptyList()) }

  var parseMeta by remember { mutableStateOf<BankPdfParseResult?>(null) }
  var result by remember { mutableStateOf<UnderwritingResult?>(null) }
  var detailsTab by remember { mutableStateOf("Summary") } // Summary | GST | ITR | Cross

  var runs by remember { mutableStateOf<List<UnderwritingApplicationListItem>>(emptyList()) }
  var loading by remember { mutableStateOf(false) }

  fun resolveDisplayName(uri: Uri): String {
    val cr = context.contentResolver
    val name =
      runCatching {
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) cursor.getString(0) else null
        }
      }.getOrNull()
    return name?.takeIf { it.isNotBlank() } ?: "statement.pdf"
  }

  fun resolveSize(uri: Uri): Long =
    runCatching {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getLong(0) else 0L
      } ?: 0L
    }.getOrNull() ?: 0L

  fun contentTypeFor(uri: Uri, fileName: String): String =
    context.contentResolver.getType(uri)
      ?: URLConnection.guessContentTypeFromName(fileName)
      ?: "application/pdf"

  fun refreshRuns() {
    val lead = selectedLead ?: return
    scope.launch(errorHandler) {
      loading = true
      error = null
      runCatching { underwritingRepository.listApplications(leadId = lead.id, limit = 50) }
        .onSuccess { runs = it }
        .onFailure { error = it.message ?: "Couldn’t load underwriting runs." }
      loading = false
    }
  }

  fun appendNote(leadId: String, noteText: String) {
    scope.launch(errorHandler) {
      val now = Instant.now().toString()
      val note = LeadNote(text = noteText, date = now, byUser = actor)
      runCatching {
        val lead = leadsRepository.getLead(leadId)
        val nextNotes = (lead.notes + note).takeLast(500)
        leadsRepository.updateLead(leadId, LeadUpdate(notes = nextNotes))
      }
        .onFailure {
          RetryQueueStore.enqueueLeadAppendNote(context.applicationContext, leadId, note)
          RetrySyncScheduler.enqueueNow(context.applicationContext)
          Toast.makeText(context, "Saved offline — will sync when online.", Toast.LENGTH_LONG).show()
        }
    }
  }

  val pickPdfs =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
      if (uris.isEmpty()) return@rememberLauncherForActivityResult
      scope.launch(errorHandler) {
        runCatching {
          uris.forEach { uri ->
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
          }
        }
      }
      selectedUris = uris
      selectedNames = uris.map { resolveDisplayName(it) }
      parseMeta = null
      result = null
      error = null
    }

  val pickGstPdfs =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
      if (uris.isEmpty()) return@rememberLauncherForActivityResult
      scope.launch(errorHandler) {
        runCatching {
          uris.forEach { uri ->
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
          }
        }
      }
      gstUris = uris
      gstNames = uris.map { resolveDisplayName(it) }
      error = null
    }

  val pickItrPdfs =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
      if (uris.isEmpty()) return@rememberLauncherForActivityResult
      scope.launch(errorHandler) {
        runCatching {
          uris.forEach { uri ->
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
          }
        }
      }
      itrUris = uris
      itrNames = uris.map { resolveDisplayName(it) }
      error = null
    }

  LaunchedEffect(selectedLeadId) {
    selectedUris = emptyList()
    selectedNames = emptyList()
    gstUris = emptyList()
    gstNames = emptyList()
    itrUris = emptyList()
    itrNames = emptyList()
    gstMonths = emptyList()
    itrYears = emptyList()
    itrProfitText = emptyList()
    parseMeta = null
    result = null
    detailsTab = "Summary"
    runs = emptyList()
    error = null
    val leadId = selectedLeadId
    if (leadId != null) {
      refreshRuns()
      val cached = loadUwCache(context, leadId)
      if (cached != null) result = cached
    }
  }

  LaunchedEffect(result, selectedLeadId) {
    val lid = selectedLeadId
    val r = result
    if (lid != null && r != null) saveUwCache(context, lid, r)
  }

  val filtered =
    remember(leads, query) {
      val q = query.trim().lowercase()
      val base = leads.sortedByDescending { it.updatedAt ?: it.createdAt }
      if (q.isBlank()) base.take(80)
      else
        base.filter { l ->
          l.name.lowercase().contains(q) ||
            (l.company ?: "").lowercase().contains(q) ||
            (l.phone ?: "").contains(q)
        }.take(80)
    }

  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          Icon(Icons.Outlined.Gavel, contentDescription = null)
          Column(modifier = Modifier.weight(1f)) {
            Text("Hardcoded Underwriting", style = MaterialTheme.typography.titleLarge)
            Text(
              "Deterministic rule engine + credit & recovery intelligence (no ML).",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          TextButton(onClick = { refreshRuns() }, enabled = !loading && selectedLead != null) {
            Icon(Icons.Outlined.Refresh, contentDescription = null)
            Spacer(Modifier.size(6.dp))
            Text("Refresh")
          }
        }
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

    if (selectedLead == null) {
      OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Search lead (client / company / phone)") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        colors =
          TextFieldDefaults.outlinedTextFieldColors(
            focusedBorderColor = MaterialTheme.colorScheme.secondary,
            focusedLabelColor = MaterialTheme.colorScheme.secondary,
            cursorColor = MaterialTheme.colorScheme.secondary,
          ),
      )

      if (filtered.isEmpty()) {
        Text("No leads found.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        filtered.forEach { l ->
          Card(
            modifier = Modifier.fillMaxWidth().clickable { selectedLeadId = l.id },
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
          ) {
            Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
              Text(l.name, style = MaterialTheme.typography.titleMedium)
              Text(
                listOfNotNull(l.company?.takeIf { it.isNotBlank() }, l.phone?.takeIf { it.isNotBlank() }).joinToString(" • ").ifBlank { "—" },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
              Text(
                "Ask: ${fmtInr(l.loanAmount ?: 50_00_000)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            }
          }
        }
      }
      return@Column
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(selectedLead.name, style = MaterialTheme.typography.titleLarge)
            Text(
              listOfNotNull(selectedLead.company?.takeIf { it.isNotBlank() }, selectedLead.phone?.takeIf { it.isNotBlank() }).joinToString(" • ").ifBlank { "—" },
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
            )
            Text("Ask: ${fmtInr(selectedLead.loanAmount ?: 50_00_000)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          TextButton(onClick = { selectedLeadId = null }) { Text("Change") }
        }

        Button(
          onClick = { pickPdfs.launch(arrayOf("application/pdf")) },
          enabled = !loading,
          modifier = Modifier.fillMaxWidth(),
        ) {
          Icon(Icons.Outlined.FolderOpen, contentDescription = null)
          Spacer(Modifier.size(8.dp))
          Text(if (selectedUris.isEmpty()) "Select bank statement PDFs" else "Change PDFs (${selectedUris.size})")
        }

        if (selectedNames.isNotEmpty()) {
          Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            selectedNames.take(6).forEach { name ->
              Text("• $name", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (selectedNames.size > 6) {
              Text("… +${selectedNames.size - 6} more", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          TextButton(
            onClick = { pickGstPdfs.launch(arrayOf("application/pdf")) },
            enabled = !loading,
            modifier = Modifier.weight(1f),
          ) {
            Text(if (gstUris.isEmpty()) "Add GST PDF(s)" else "GST PDFs (${gstUris.size})")
          }
          TextButton(
            onClick = { pickItrPdfs.launch(arrayOf("application/pdf")) },
            enabled = !loading,
            modifier = Modifier.weight(1f),
          ) {
            Text(if (itrUris.isEmpty()) "Add ITR PDF(s)" else "ITR PDFs (${itrUris.size})")
          }
        }

        if (gstNames.isNotEmpty()) {
          Text(
            "GST: ${gstNames.take(3).joinToString()}${if (gstNames.size > 3) " …" else ""}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }
        if (itrNames.isNotEmpty()) {
          Text(
            "ITR: ${itrNames.take(3).joinToString()}${if (itrNames.size > 3) " …" else ""}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }

        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
              Column(modifier = Modifier.weight(1f)) {
                Text("GST inputs (optional)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(
                  "Add months if you want GST cross-verification + doubts (no PDF parsing yet).",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
              }
              TextButton(onClick = { gstMonths = gstMonths + UwGstMonth(month = "", turnover = 0, taxPaid = 0, daysLate = 0) }) { Text("+ Month") }
            }

            if (gstMonths.isEmpty()) {
              Text("No GST months added.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
              gstMonths.forEachIndexed { idx, row ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                  OutlinedTextField(
                    value = row.month,
                    onValueChange = { v -> gstMonths = gstMonths.mapIndexed { i, x -> if (i == idx) x.copy(month = v) else x } },
                    modifier = Modifier.weight(1.1f),
                    label = { Text("Month (YYYY-MM)") },
                    singleLine = true,
                  )
                  OutlinedTextField(
                    value = row.turnover.toString(),
                    onValueChange = { v ->
                      val n = v.filter { it.isDigit() }.toLongOrNull() ?: 0L
                      gstMonths = gstMonths.mapIndexed { i, x -> if (i == idx) x.copy(turnover = n) else x }
                    },
                    modifier = Modifier.weight(1f),
                    label = { Text("Turnover") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                  )
                  OutlinedTextField(
                    value = row.taxPaid.toString(),
                    onValueChange = { v ->
                      val n = v.filter { it.isDigit() }.toLongOrNull() ?: 0L
                      gstMonths = gstMonths.mapIndexed { i, x -> if (i == idx) x.copy(taxPaid = n) else x }
                    },
                    modifier = Modifier.weight(0.9f),
                    label = { Text("Tax") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                  )
                  OutlinedTextField(
                    value = (row.daysLate ?: 0).toString(),
                    onValueChange = { v ->
                      val n = v.filter { it.isDigit() }.toIntOrNull() ?: 0
                      gstMonths = gstMonths.mapIndexed { i, x -> if (i == idx) x.copy(daysLate = n) else x }
                    },
                    modifier = Modifier.weight(0.7f),
                    label = { Text("Late") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                  )
                  TextButton(onClick = { gstMonths = gstMonths.filterIndexed { i, _ -> i != idx } }) { Text("✕") }
                }
              }
            }

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
              Column(modifier = Modifier.weight(1f)) {
                Text("ITR inputs (optional)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(
                  "Add turnover + profit for basic sanity checks + doubts.",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
              }
              TextButton(
                onClick = {
                  itrYears = itrYears + UwItrYear(year = "", turnover = 0, profit = 0, taxPaid = 0)
                  itrProfitText = itrProfitText + "0"
                },
              ) {
                Text("+ Year")
              }
            }

            if (itrYears.isEmpty()) {
              Text("No ITR years added.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
              itrYears.forEachIndexed { idx, row ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                  OutlinedTextField(
                    value = row.year,
                    onValueChange = { v -> itrYears = itrYears.mapIndexed { i, x -> if (i == idx) x.copy(year = v) else x } },
                    modifier = Modifier.weight(1.1f),
                    label = { Text("Year") },
                    singleLine = true,
                  )
                  OutlinedTextField(
                    value = row.turnover.toString(),
                    onValueChange = { v ->
                      val n = v.filter { it.isDigit() }.toLongOrNull() ?: 0L
                      itrYears = itrYears.mapIndexed { i, x -> if (i == idx) x.copy(turnover = n) else x }
                    },
                    modifier = Modifier.weight(1f),
                    label = { Text("Turnover") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                  )
                  OutlinedTextField(
                    value = itrProfitText.getOrNull(idx) ?: row.profit.toString(),
                    onValueChange = { v ->
                      val next = itrProfitText.toMutableList()
                      while (next.size <= idx) next.add(row.profit.toString())
                      next[idx] = v
                      itrProfitText = next.toList()

                      val clean = v.trim().replace(",", "")
                      val n = clean.toLongOrNull()
                      if (n != null) {
                        itrYears = itrYears.mapIndexed { i, x -> if (i == idx) x.copy(profit = n) else x }
                      }
                    },
                    modifier = Modifier.weight(1f),
                    label = { Text("Profit") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                  )
                  OutlinedTextField(
                    value = row.taxPaid.toString(),
                    onValueChange = { v ->
                      val n = v.filter { it.isDigit() }.toLongOrNull() ?: 0L
                      itrYears = itrYears.mapIndexed { i, x -> if (i == idx) x.copy(taxPaid = n) else x }
                    },
                    modifier = Modifier.weight(0.9f),
                    label = { Text("Tax") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                  )
                  TextButton(
                    onClick = {
                      itrYears = itrYears.filterIndexed { i, _ -> i != idx }
                      itrProfitText = itrProfitText.filterIndexed { i, _ -> i != idx }
                    },
                  ) {
                    Text("✕")
                  }
                }
              }
            }
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          Button(
            onClick = {
              if (selectedUris.isEmpty()) return@Button
              scope.launch(errorHandler) {
                loading = true
                error = null
                runCatching {
                  val pdfBytes =
                    selectedUris.map { uri ->
                      context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read PDF.")
                    }
                  parseBankStatementPdfs(pdfBytes, context)
                }.onSuccess { meta ->
                  parseMeta = meta
                  result = null
                  Toast.makeText(context, "Parsed ${meta.transactions.size} transactions", Toast.LENGTH_SHORT).show()
                }.onFailure { ex ->
                  error = ex.message ?: "Parse failed."
                }
                loading = false
              }
            },
            enabled = !loading && selectedUris.isNotEmpty(),
            modifier = Modifier.weight(1f),
          ) {
            Icon(Icons.Outlined.Description, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text("Parse")
          }

          Button(
            onClick = {
              val meta = parseMeta ?: return@Button
              scope.launch(errorHandler) {
                loading = true
                error = null
                runCatching {
                  val ask = selectedLead.loanAmount ?: 50_00_000
                  val docs =
                    UwDocsInput(
                      // Keep NIL months (turnover=0) for deterministic NIL-return detection.
                      gstMonths = gstMonths.filter { it.month.isNotBlank() },
                      itrYears = itrYears.filter { it.year.isNotBlank() },
                    )
                  UnderwritingEngine.runUnderwriting(
                    transactions = meta.transactions,
                    params = UwParams(requestedExposure = ask, maxTenureMonths = 12),
                    docs = docs,
                  )
                }.onSuccess { r ->
                  result = r
                  detailsTab = "Summary"
                }.onFailure { ex ->
                  error = ex.message ?: "Underwriting failed."
                }
                loading = false
              }
            },
            enabled = !loading && (parseMeta?.transactions?.isNotEmpty() == true),
            modifier = Modifier.weight(1f),
          ) {
            Icon(Icons.Outlined.Gavel, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text("Run")
          }
        }

        if (loading) {
          Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
          ) {
            CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            Spacer(Modifier.size(10.dp))
            Text("Working…", style = MaterialTheme.typography.bodyMedium)
          }
        }
      }
    }

    parseMeta?.let { meta ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("Statement snapshot", style = MaterialTheme.typography.titleMedium)
          Text(
            "Bank: ${meta.bankName.ifBlank { "—" }} • Type: ${meta.accountType.ifBlank { "—" }}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Text(
            "Period: ${meta.periodStart.ifBlank { "—" }} → ${meta.periodEnd.ifBlank { "—" }} • Transactions: ${meta.transactions.size}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Text(
            "Preview: ${meta.transactions.take(6).joinToString { it.date }}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
          )
        }
      }
    }

    result?.let { r ->
      val tabs = listOf("Summary", "GST", "ITR", "Cross")
      val tabIndex = (tabs.indexOf(detailsTab)).let { if (it < 0) 0 else it }
      val topGstFlags = r.ruleRunLog.filter { it.id.startsWith("GST-") && !it.passed }.take(3)
      val topItrFlags = r.ruleRunLog.filter { it.id.startsWith("ITR-") && !it.passed }.take(3)
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("Underwriting result", style = MaterialTheme.typography.titleLarge)
          Text(
            "Decision snapshot first. Full report is available in tabs (GST/ITR/Cross).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )

          TabRow(selectedTabIndex = tabIndex) {
            tabs.forEachIndexed { i, t ->
              Tab(selected = i == tabIndex, onClick = { detailsTab = t }, text = { Text(t) })
            }
          }

          when (detailsTab) {
            "GST" -> {
              val gst = r.gst
              if (gst == null) {
                Text("No GST inputs for this run.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              } else {
                Card(
                  modifier = Modifier.fillMaxWidth(),
                  colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                  border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                ) {
                  Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("GST discipline", style = MaterialTheme.typography.titleMedium)
                    Text(
                      "Avg monthly turnover: ${fmtInr(gst.avgMonthlyTurnover)} • Volatility: ${gst.volatilityBucket} • Seasonality: ${gst.seasonalityBucket}",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                      "Missing: ${gst.filingGapCount} • Late: ${gst.lateFilingCount} • Drops: ${gst.consecutiveDropMonths.size}",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (gst.commentary.isNotBlank()) {
                      Text(gst.commentary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                  }
                }

                if (gst.months.isNotEmpty()) {
                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                      Text("GST months", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                      gst.months.take(12).forEach { m ->
                        Text(
                          "${m.month}: turnover ${fmtInr(m.turnover)} • tax ${fmtInr(m.taxPaid)}${if ((m.daysLate ?: 0) > 0) " • late ${m.daysLate}d" else ""}",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                          maxLines = 2,
                          overflow = TextOverflow.Ellipsis,
                        )
                      }
                    }
                  }
                }

                if (topGstFlags.isNotEmpty()) {
                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                      Text("Top GST flags", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                      topGstFlags.forEach { f ->
                        Text(
                          "• ${f.id} (${f.severity}): ${f.reason}",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                          maxLines = 3,
                          overflow = TextOverflow.Ellipsis,
                        )
                      }
                    }
                  }
                }
              }
            }
            "ITR" -> {
              val itr = r.itr
              if (itr == null) {
                Text("No ITR inputs for this run.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              } else {
                Card(
                  modifier = Modifier.fillMaxWidth(),
                  colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                  border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                ) {
                  Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("ITR snapshot", style = MaterialTheme.typography.titleMedium)
                    Text(
                      "Latest turnover: ${fmtInr(itr.latestTurnover)} • Profit: ${fmtInr(itr.latestProfit)} • Margin: ${"%.2f".format(itr.latestMarginPct)}% • Tax: ${fmtInr(itr.latestTaxPaid)}",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (itr.yoyTurnoverPct != null || itr.yoyProfitPct != null) {
                      Text(
                        "YoY turnover: ${itr.yoyTurnoverPct?.let { "%.1f".format(it) + "%" } ?: "—"} • YoY profit: ${itr.yoyProfitPct?.let { "%.1f".format(it) + "%" } ?: "—"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                      )
                    }
                    if (itr.commentary.isNotBlank()) {
                      Text(itr.commentary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                  }
                }

                if (itr.years.isNotEmpty()) {
                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                      Text("ITR years", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                      itr.years.take(6).forEach { y ->
                        Text(
                          "${y.year}: turnover ${fmtInr(y.turnover)} • profit ${fmtInr(y.profit)} • tax ${fmtInr(y.taxPaid)}",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                          maxLines = 2,
                          overflow = TextOverflow.Ellipsis,
                        )
                      }
                    }
                  }
                }

                if (topItrFlags.isNotEmpty()) {
                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                      Text("Top ITR flags", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                      topItrFlags.forEach { f ->
                        Text(
                          "• ${f.id} (${f.severity}): ${f.reason}",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                          maxLines = 3,
                          overflow = TextOverflow.Ellipsis,
                        )
                      }
                    }
                  }
                }
              }
            }
            "Cross" -> {
              val cross = r.crossVerification
              Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
              ) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                  Text("Credibility", style = MaterialTheme.typography.titleMedium)
                  val cred = r.credibility
                  if (cred == null) {
                    Text("Credibility score requires GST/ITR inputs.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                  } else {
                    Text(
                      "Score ${cred.score}/100 (${cred.band}) • GST ${cred.gstScore} • ITR ${cred.itrScore} • Penalty ${cred.mismatchPenalty}",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (cred.reasons.isNotEmpty()) {
                      Text(
                        "Drivers: ${cred.reasons.joinToString(", ")}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                      )
                    }
                  }
                }
              }

              if (cross == null) {
                Text("No cross-verification data for this run.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              } else {
                Card(
                  modifier = Modifier.fillMaxWidth(),
                  colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                  border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                  elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                  Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("GST vs Bank reconciliation (monthly)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text(
                      "Avg diff: ${cross.bankVsGstAvgDiffPct?.let { "%.1f".format(kotlin.math.abs(it)) + "%" } ?: "—"} • NIL months: ${cross.nilReturnMonthsWithBankCredits.size}",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    cross.rows.take(12).forEach { row ->
                      val v = row.diffPct?.let { kotlin.math.abs(it) }
                      val status =
                        if (row.gstTurnover <= 0L) "No GST"
                        else if (v == null) "—"
                        else if (v <= 10.0) "OK"
                        else if (v <= 25.0) "Review"
                        else "Critical"
                      Text(
                        "${row.month}: GST ${fmtInr(row.gstTurnover)} • Bank ${fmtInr(row.bankCredits)} • ${v?.let { "%.1f".format(it) + "%" } ?: "—"} • $status",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                      )
                    }
                    if (cross.commentary.isNotBlank()) {
                      Text(cross.commentary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                  }
                }
              }
            }
            else -> {
              Text(
                r.aggressiveSummary,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )

              Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
              ) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                  Text("Recommended exposure: ${fmtInr(r.recommendation.recommendedExposure)}", style = MaterialTheme.typography.titleMedium)
                  Text(
                    "Collections: ${r.recommendation.collectionFrequency} ${fmtInr(r.recommendation.collectionAmount)} • Tenure: ${r.recommendation.tenureMonths}m",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                  )
                  Text(
                    "Pricing: ${"%.1f".format(r.recommendation.pricingApr)}% APR • Upfront: ${"%.0f".format(r.recommendation.upfrontDeductionPct * 100)}% (${fmtInr(r.recommendation.upfrontDeductionAmt)})",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                  )
                }
              }

              if (r.credibility != null) {
                val cred = r.credibility!!
                Card(
                  modifier = Modifier.fillMaxWidth(),
                  colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                  border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                  elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                  Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Business credibility", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text(
                      "Score ${cred.score}/100 (${cred.band})",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (cred.reasons.isNotEmpty()) {
                      Text(
                        "Drivers: ${cred.reasons.joinToString(", ")}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                      )
                    }
                  }
                }
              }

              if (topGstFlags.isNotEmpty() || topItrFlags.isNotEmpty()) {
                Card(
                  modifier = Modifier.fillMaxWidth(),
                  colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                  border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                  elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                  Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Key risks", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    if (topGstFlags.isNotEmpty()) {
                      Text("GST", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                      topGstFlags.forEach { f ->
                        Text(
                          "• ${f.id}: ${f.reason}",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                          maxLines = 2,
                          overflow = TextOverflow.Ellipsis,
                        )
                      }
                    }
                    if (topItrFlags.isNotEmpty()) {
                      Text("ITR", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                      topItrFlags.forEach { f ->
                        Text(
                          "• ${f.id}: ${f.reason}",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                          maxLines = 2,
                          overflow = TextOverflow.Ellipsis,
                        )
                      }
                    }
                  }
                }
              }
            }
          }

          Button(
            onClick = {
              val lead = selectedLead ?: return@Button
              val meta = parseMeta
              val ownerId = lead.ownerId ?: session.userId
              val createdBy = session.userId
              if (ownerId.isNullOrBlank() || createdBy.isNullOrBlank()) {
                error = "Missing session user id / owner id."
                return@Button
              }

              scope.launch(errorHandler) {
                loading = true
                error = null
                runCatching {
                  val app =
                    underwritingRepository.createApplication(
                      UnderwritingApplicationCreateInput(
                        ownerId = ownerId,
                        leadId = lead.id,
                        status = "completed",
                        periodStart = meta?.periodStart?.takeIf { it.isNotBlank() },
                        periodEnd = meta?.periodEnd?.takeIf { it.isNotBlank() },
                        bankName = meta?.bankName.orEmpty(),
                        accountType = meta?.accountType.orEmpty(),
                        requestedExposure = lead.loanAmount ?: 0,
                        reportJson = UW_JSON.encodeToJsonElement(r),
                        aggressiveSummary = r.aggressiveSummary,
                      ),
                    )

                  if (selectedUris.isNotEmpty()) {
                    selectedUris.forEachIndexed { idx, uri ->
                      val fileName = selectedNames.getOrNull(idx) ?: resolveDisplayName(uri)
                      val contentType = contentTypeFor(uri, fileName)
                      val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read PDF.")
                      val path = underwritingRepository.uploadDocument(
                        applicationId = app.id,
                        ownerId = ownerId,
                        fileName = fileName,
                        bytes = bytes,
                        contentType = contentType,
                      )
                      val size = resolveSize(uri)
                      underwritingRepository.createDocument(
                        UnderwritingDocumentCreateInput(
                          applicationId = app.id,
                          ownerId = ownerId,
                          type = "BANK_PDF",
                          storagePath = path,
                          metaJson =
                            buildJsonObject {
                              put("file_name", fileName)
                              put("size", size)
                            },
                        ),
                      )
                    }
                  }

                  if (gstUris.isNotEmpty()) {
                    gstUris.forEachIndexed { idx, uri ->
                      val fileName = gstNames.getOrNull(idx) ?: resolveDisplayName(uri)
                      val contentType = contentTypeFor(uri, fileName)
                      val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read PDF.")
                      val path = underwritingRepository.uploadDocument(applicationId = app.id, ownerId = ownerId, fileName = fileName, bytes = bytes, contentType = contentType)
                      val size = resolveSize(uri)
                      underwritingRepository.createDocument(
                        UnderwritingDocumentCreateInput(
                          applicationId = app.id,
                          ownerId = ownerId,
                          type = "GST",
                          storagePath = path,
                          metaJson =
                            buildJsonObject {
                              put("file_name", fileName)
                              put("size", size)
                            },
                        ),
                      )
                    }
                  }

                  if (itrUris.isNotEmpty()) {
                    itrUris.forEachIndexed { idx, uri ->
                      val fileName = itrNames.getOrNull(idx) ?: resolveDisplayName(uri)
                      val contentType = contentTypeFor(uri, fileName)
                      val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read PDF.")
                      val path = underwritingRepository.uploadDocument(applicationId = app.id, ownerId = ownerId, fileName = fileName, bytes = bytes, contentType = contentType)
                      val size = resolveSize(uri)
                      underwritingRepository.createDocument(
                        UnderwritingDocumentCreateInput(
                          applicationId = app.id,
                          ownerId = ownerId,
                          type = "ITR",
                          storagePath = path,
                          metaJson =
                            buildJsonObject {
                              put("file_name", fileName)
                              put("size", size)
                            },
                        ),
                      )
                    }
                  }

                  appendNote(lead.id, "[UW]: Underwriting run created (ID ${app.id.take(8)}), exposure ${fmtInr(r.recommendation.recommendedExposure)}")
                  app
                }.onSuccess {
                  Toast.makeText(context, "Saved underwriting run.", Toast.LENGTH_SHORT).show()
                  refreshRuns()
                  val lead = selectedLead
                  if (lead != null) onProceedToPd?.invoke(it.id, lead.id)
                }.onFailure { ex ->
                  error = ex.message ?: "Save failed."
                }
                loading = false
              }
            },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth(),
          ) {
            Icon(Icons.Outlined.Save, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text("Save run (cloud audit)")
          }
        }
      }
    }

    if (runs.isNotEmpty()) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Saved underwriting runs", style = MaterialTheme.typography.titleMedium)
          runs.take(10).forEach { row ->
            Card(
              modifier = Modifier.fillMaxWidth(),
              colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
              border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            ) {
              Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                  modifier = Modifier.fillMaxWidth(),
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                  Text(
                    "${row.bankName.ifBlank { "Bank" }} • ${row.periodStart ?: "—"} → ${row.periodEnd ?: "—"}",
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.weight(1f),
                  )
                  if (onProceedToPd != null && selectedLead != null) {
                    TextButton(onClick = { onProceedToPd.invoke(row.id, selectedLead.id) }) {
                      Text("PD")
                    }
                  }
                }
                Text(
                  row.aggressiveSummary.ifBlank { "—" },
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                  maxLines = 3,
                  overflow = TextOverflow.Ellipsis,
                )
              }
            }
          }
          if (runs.size > 10) {
            Text("… +${runs.size - 10} more", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
      }
    }
  }
}
