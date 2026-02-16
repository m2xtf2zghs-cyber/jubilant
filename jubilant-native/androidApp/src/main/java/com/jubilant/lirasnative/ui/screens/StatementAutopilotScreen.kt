package com.jubilant.lirasnative.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.StatementRepository
import com.jubilant.lirasnative.shared.statement.RawLineType
import com.jubilant.lirasnative.shared.statement.RawStatementLine
import com.jubilant.lirasnative.shared.statement.StatementAutopilotEngine
import com.jubilant.lirasnative.shared.statement.StatementAutopilotResult
import com.jubilant.lirasnative.shared.statement.StatementParseStatus
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.RawStatementLineCreateInput
import com.jubilant.lirasnative.shared.supabase.PdfFileCreateInput
import com.jubilant.lirasnative.shared.supabase.StatementCreateInput
import com.jubilant.lirasnative.shared.supabase.StatementVersionCreateInput
import com.jubilant.lirasnative.shared.supabase.TransactionCreateInput
import com.jubilant.lirasnative.shared.supabase.MonthlyAggregateCreateInput
import com.jubilant.lirasnative.shared.supabase.PivotCreateInput
import com.jubilant.lirasnative.shared.supabase.ReconciliationFailureCreateInput
import com.jubilant.lirasnative.ui.util.StatementParseInput
import com.jubilant.lirasnative.ui.util.extractStatementRawLines
import java.net.URLConnection
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject

private val STATEMENT_JSON = Json { encodeDefaults = true; explicitNulls = false }

data class ManualEdit(
  val ignore: Boolean = false,
  val date: String? = null,
  val dr: String? = null,
  val cr: String? = null,
  val balance: String? = null,
  val narration: String? = null,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatementAutopilotScreen(
  leads: List<LeadSummary>,
  statementRepository: StatementRepository,
  session: SessionState,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val scroll = rememberScrollState()

  var selectedLeadId by remember { mutableStateOf<String?>(null) }
  val selectedLead = remember(leads, selectedLeadId) { leads.firstOrNull { it.id == selectedLeadId } }

  var selectedUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
  var selectedNames by remember { mutableStateOf<List<String>>(emptyList()) }

  var parseInput by remember { mutableStateOf<StatementParseInput?>(null) }
  var rawLines by remember { mutableStateOf<List<RawStatementLine>>(emptyList()) }
  var result by remember { mutableStateOf<StatementAutopilotResult?>(null) }
  var manualEdits by remember { mutableStateOf<Map<String, ManualEdit>>(emptyMap()) }
  var approvalStatus by remember { mutableStateOf("DRAFT") }

  var error by remember { mutableStateOf<String?>(null) }
  var loading by remember { mutableStateOf(false) }
  var showMapDialogFor by remember { mutableStateOf<RawStatementLine?>(null) }

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

  fun contentTypeFor(uri: Uri, fileName: String): String =
    context.contentResolver.getType(uri)
      ?: URLConnection.guessContentTypeFromName(fileName)
      ?: "application/pdf"

  fun fileIndexFor(lineId: String): Int? {
    val match = Regex("^f(\\d+)_").find(lineId) ?: return null
    return match.groupValues.getOrNull(1)?.toIntOrNull()
  }

  fun <T> chunk(items: List<T>, size: Int): List<List<T>> {
    if (items.isEmpty()) return emptyList()
    val out = mutableListOf<List<T>>()
    var idx = 0
    while (idx < items.size) {
      val end = (idx + size).coerceAtMost(items.size)
      out += items.subList(idx, end)
      idx = end
    }
    return out
  }

  val pickPdfs =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
      if (uris.isEmpty()) return@rememberLauncherForActivityResult
      scope.launch {
        runCatching {
          uris.forEach { uri ->
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
          }
        }
      }
      selectedUris = uris
      selectedNames = uris.map { resolveDisplayName(it) }
      parseInput = null
      rawLines = emptyList()
      result = null
      manualEdits = emptyMap()
      error = null
    }

  LaunchedEffect(selectedLeadId) {
    selectedUris = emptyList()
    selectedNames = emptyList()
    parseInput = null
    rawLines = emptyList()
    result = null
    manualEdits = emptyMap()
    error = null
  }

  fun applyEdits(lines: List<RawStatementLine>): List<RawStatementLine> {
    return lines.map { line ->
      val edit = manualEdits[line.id] ?: return@map line
      if (edit.ignore) {
        return@map line.copy(rawLineType = RawLineType.NON_TXN_LINE, rawDateText = null)
      }
      line.copy(
        rawDateText = edit.date ?: line.rawDateText,
        rawDrText = edit.dr ?: line.rawDrText,
        rawCrText = edit.cr ?: line.rawCrText,
        rawBalanceText = edit.balance ?: line.rawBalanceText,
        rawNarrationText = edit.narration ?: line.rawNarrationText,
      )
    }
  }

  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Statement Autopilot", style = MaterialTheme.typography.titleLarge)
        Text(
          "Strict capture + reconciliation. PDF blocked if parse failed.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    if (error != null) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.1f)),
      ) {
        Text(error ?: "", modifier = Modifier.padding(12.dp), color = MaterialTheme.colorScheme.error)
      }
    }

    if (selectedLead == null) {
      OutlinedTextField(
        value = selectedLeadId ?: "",
        onValueChange = { selectedLeadId = it.ifBlank { null } },
        label = { Text("Select lead ID") },
        modifier = Modifier.fillMaxWidth(),
      )
      leads.take(30).forEach { lead ->
        TextButton(onClick = { selectedLeadId = lead.id }) {
          Text(lead.name)
        }
      }
    } else {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(selectedLead.name, style = MaterialTheme.typography.titleMedium)
          Text("Ask: ₹${selectedLead.loanAmount ?: 0}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          TextButton(onClick = { selectedLeadId = null }) { Text("Change lead") }
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        listOf("DRAFT", "APPROVED", "REJECTED").forEach { option ->
          TextButton(onClick = { approvalStatus = option }) {
            Text(
              option,
              color = if (approvalStatus == option) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
              fontWeight = if (approvalStatus == option) FontWeight.Bold else FontWeight.Normal,
            )
          }
        }
      }

      Button(
        onClick = { pickPdfs.launch(arrayOf("application/pdf")) },
        enabled = !loading,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Icon(Icons.Outlined.Description, contentDescription = null)
        Spacer(Modifier.size(8.dp))
        Text(if (selectedUris.isEmpty()) "Select statement PDF(s)" else "Change PDFs (${selectedUris.size})")
      }

      if (selectedNames.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          selectedNames.take(6).forEach { name ->
            Text("• $name", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        Button(
          onClick = {
            if (selectedUris.isEmpty()) return@Button
            scope.launch {
              loading = true
              error = null
              runCatching {
                val pdfBytes =
                  selectedUris.map { uri ->
                    context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read PDF.")
                  }
                extractStatementRawLines(pdfBytes, context)
              }.onSuccess { input ->
                parseInput = input
                rawLines = input.rawLines
                result = null
                manualEdits = emptyMap()
                Toast.makeText(context, "Extracted ${input.rawLines.size} lines", Toast.LENGTH_SHORT).show()
              }.onFailure { ex ->
                error = ex.message ?: "Parse failed."
              }
              loading = false
            }
          },
          enabled = !loading && selectedUris.isNotEmpty(),
          modifier = Modifier.weight(1f),
        ) {
          Icon(Icons.Outlined.Refresh, contentDescription = null)
          Spacer(Modifier.size(8.dp))
          Text("Parse")
        }

        Button(
          onClick = {
            val input = parseInput ?: return@Button
            val adjusted = applyEdits(rawLines)
            result = StatementAutopilotEngine.run(adjusted, input.bankName, input.accountType)
          },
          enabled = !loading && rawLines.isNotEmpty(),
          modifier = Modifier.weight(1f),
        ) {
          Text("Run")
        }
      }
    }

    result?.let { r ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("Reconciliation", style = MaterialTheme.typography.titleMedium)
          Text(
            "Raw lines: ${r.reconciliation.totalRawLines} • Txn lines: ${r.reconciliation.totalTxnLines} • Mapped: ${r.reconciliation.totalTxnLines - r.reconciliation.unmappedLineIds.size}",
            style = MaterialTheme.typography.bodySmall,
          )
          val status = r.reconciliation.status.name
          Text("Status: $status", style = MaterialTheme.typography.bodySmall)
          if (r.reconciliation.unmappedLineIds.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              Icon(Icons.Outlined.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
              Text("Unmapped lines: ${r.reconciliation.unmappedLineIds.size}", color = MaterialTheme.colorScheme.error)
            }
          }
        }
      }

      if (r.reconciliation.unmappedLineIds.isNotEmpty() && session.isAdmin) {
        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Manual mapping", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            r.rawLines.filter { r.reconciliation.unmappedLineIds.contains(it.id) }.take(20).forEach { line ->
              Column(modifier = Modifier.fillMaxWidth()) {
                Text("P${line.pageNo} R${line.rowNo} • ${line.rawRowText}", style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                  TextButton(onClick = {
                    manualEdits = manualEdits + (line.id to ManualEdit(ignore = true))
                  }) { Text("Mark Non-Txn") }
                  TextButton(onClick = { showMapDialogFor = line }) { Text("Map Txn") }
                }
              }
            }
            Button(onClick = { val input = parseInput; if (input != null) result = StatementAutopilotEngine.run(applyEdits(rawLines), input.bankName, input.accountType) }) {
              Text("Re-run")
            }
          }
        }
      }
      if (r.reconciliation.unmappedLineIds.isNotEmpty() && !session.isAdmin) {
        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.08f)),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Parse failed", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.error)
            Text(
              "Admin must resolve unmapped lines before export.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }

      Button(
        onClick = {
          val lead = selectedLead ?: return@Button
          val input = parseInput ?: return@Button
          scope.launch {
            loading = true
            error = null
            runCatching {
              val parseStatus =
                if (r.reconciliation.status == StatementParseStatus.PARSE_FAILED) "PARSE_FAILED" else approvalStatus
              val statement =
                statementRepository.createStatement(
                  StatementCreateInput(ownerId = lead.ownerId ?: session.userId ?: error("Missing owner"), leadId = lead.id),
                )
              val ownerId = statement.ownerId
              val version =
                statementRepository.createStatementVersion(
                  StatementVersionCreateInput(
                    statementId = statement.id,
                    ownerId = ownerId,
                    status = parseStatus,
                    versionNo = 1,
                    bankName = input.bankName,
                    accountType = input.accountType,
                    periodStart = r.transactions.firstOrNull()?.date,
                    periodEnd = r.transactions.lastOrNull()?.date,
                    reportJson = STATEMENT_JSON.encodeToJsonElement(r).jsonObject,
                  ),
                )

              val pdfFileIds = mutableMapOf<Int, String>()
              selectedUris.forEachIndexed { idx, uri ->
                val name = selectedNames.getOrNull(idx) ?: resolveDisplayName(uri)
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("PDF read failed.")
                val storagePath = statementRepository.uploadStatementPdf(ownerId, version.id, name, bytes, contentTypeFor(uri, name))
                val fileRow =
                  statementRepository.createPdfFile(
                    PdfFileCreateInput(
                      statementVersionId = version.id,
                      ownerId = ownerId,
                      storagePath = storagePath,
                      fileName = name,
                      metaJson = null,
                    ),
                  )
                pdfFileIds[idx] = fileRow.id
              }

              val rawPayload =
                r.rawLines.map {
                  RawStatementLineCreateInput(
                    versionId = version.id,
                    ownerId = ownerId,
                    pdfFileId = fileIndexFor(it.id)?.let { idx -> pdfFileIds[idx] },
                    pageNo = it.pageNo,
                    rowNo = it.rowNo,
                    rawRowText = it.rawRowText,
                    rawDateText = it.rawDateText,
                    rawNarrationText = it.rawNarrationText,
                    rawDrText = it.rawDrText,
                    rawCrText = it.rawCrText,
                    rawBalanceText = it.rawBalanceText,
                    rawLineType = it.rawLineType.name,
                    extractionMethod = it.extractionMethod,
                    bboxJson = null,
                  )
                }
              chunk(rawPayload, 500).forEach { batch ->
                statementRepository.insertRawLines(batch)
              }

              val txnPayload =
                r.transactions.map {
                  TransactionCreateInput(
                    versionId = version.id,
                    ownerId = ownerId,
                    rawLineIds = it.rawLineIds,
                    date = it.date,
                    month = it.month,
                    narration = it.narration,
                    dr = it.dr,
                    cr = it.cr,
                    balance = it.balance,
                    counterpartyNorm = it.counterpartyNorm,
                    txnType = it.txnType,
                    category = it.category,
                    flagsJson = STATEMENT_JSON.encodeToJsonElement(it.flags),
                    transactionUid = it.transactionUid,
                  )
                }
              chunk(txnPayload, 500).forEach { batch ->
                statementRepository.insertTransactions(batch)
              }

              if (r.monthlyAggregates.isNotEmpty()) {
                val aggregates =
                  r.monthlyAggregates.map {
                    MonthlyAggregateCreateInput(
                      versionId = version.id,
                      ownerId = ownerId,
                      month = it.month,
                      metricsJson = STATEMENT_JSON.encodeToJsonElement(it),
                    )
                  }
                statementRepository.insertMonthlyAggregates(aggregates)
              }

              val pivots =
                listOf(
                  PivotCreateInput(
                    versionId = version.id,
                    ownerId = ownerId,
                    pivotType = "CREDIT_HEAT",
                    rowsJson = STATEMENT_JSON.encodeToJsonElement(r.creditHeat),
                  ),
                  PivotCreateInput(
                    versionId = version.id,
                    ownerId = ownerId,
                    pivotType = "DEBIT_HEAT",
                    rowsJson = STATEMENT_JSON.encodeToJsonElement(r.debitHeat),
                  ),
                )
              statementRepository.insertPivots(pivots)

              if (r.reconciliation.status == StatementParseStatus.PARSE_FAILED || r.reconciliation.continuityFailures.isNotEmpty()) {
                statementRepository.insertReconciliationFailure(
                  ReconciliationFailureCreateInput(
                    versionId = version.id,
                    ownerId = ownerId,
                    unmappedLineIds = STATEMENT_JSON.encodeToJsonElement(r.reconciliation.unmappedLineIds),
                    continuityFailures = STATEMENT_JSON.encodeToJsonElement(r.reconciliation.continuityFailures),
                  ),
                )
              }
            }.onSuccess {
              Toast.makeText(context, "Statement run saved", Toast.LENGTH_LONG).show()
            }.onFailure { ex ->
              error = ex.message ?: "Save failed."
            }
            loading = false
          }
        },
        modifier = Modifier.fillMaxWidth(),
      ) {
        Icon(Icons.Outlined.Save, contentDescription = null)
        Spacer(Modifier.size(8.dp))
        Text("Save run (cloud)")
      }
    }
  }

  if (showMapDialogFor != null) {
    val line = showMapDialogFor!!
    var dateText by remember(line.id) { mutableStateOf(line.rawDateText ?: "") }
    var drText by remember(line.id) { mutableStateOf("") }
    var crText by remember(line.id) { mutableStateOf("") }
    var balText by remember(line.id) { mutableStateOf("") }
    var narText by remember(line.id) { mutableStateOf(line.rawRowText) }

    AlertDialog(
      onDismissRequest = { showMapDialogFor = null },
      title = { Text("Map transaction") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedTextField(value = dateText, onValueChange = { dateText = it }, label = { Text("Date (YYYY-MM-DD)") })
          OutlinedTextField(value = drText, onValueChange = { drText = it }, label = { Text("Debit") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
          OutlinedTextField(value = crText, onValueChange = { crText = it }, label = { Text("Credit") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
          OutlinedTextField(value = balText, onValueChange = { balText = it }, label = { Text("Balance") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
          OutlinedTextField(value = narText, onValueChange = { narText = it }, label = { Text("Narration") })
        }
      },
      confirmButton = {
        TextButton(onClick = {
          manualEdits = manualEdits + (line.id to ManualEdit(date = dateText, dr = drText, cr = crText, balance = balText, narration = narText))
          showMapDialogFor = null
        }) { Text("Apply") }
      },
      dismissButton = { TextButton(onClick = { showMapDialogFor = null }) { Text("Cancel") } },
    )
  }
}
