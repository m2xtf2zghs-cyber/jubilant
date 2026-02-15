package com.jubilant.lirasnative.ui.screens

import android.net.Uri
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.TableView
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.MediatorsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadCreateInput
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorCreateInput
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject

@Composable
fun DataToolsScreen(
  leadsRepository: LeadsRepository,
  mediatorsRepository: MediatorsRepository,
  modifier: Modifier = Modifier,
) {
  val ctx = LocalContext.current
  val scope = rememberCoroutineScope()

  var busy by remember { mutableStateOf(false) }
  var message by remember { mutableStateOf<String?>(null) }
  var error by remember { mutableStateOf<String?>(null) }

  fun setOk(msg: String) {
    message = msg
    error = null
  }

  fun setErr(msg: String) {
    error = msg
    message = null
  }

  val exportCsvLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
      if (uri == null) return@rememberLauncherForActivityResult
      scope.launch {
        busy = true
        try {
          val mediators = mediatorsRepository.listMediators(limit = 2000)
          val mediatorNames = mediators.associate { it.id to it.name }
          val leads = leadsRepository.listLeadsDetailed(limit = 4000)
          val csv = buildLeadsCsv(leads, mediatorNames)
          writeTextToUri(ctx, uri, csv)
          setOk("Exported CSV (${leads.size} leads).")
        } catch (e: Exception) {
          setErr(e.message ?: "CSV export failed.")
        }
        busy = false
      }
    }

  val importCsvLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      if (uri == null) return@rememberLauncherForActivityResult
      scope.launch {
        busy = true
        try {
          val text = readTextFromUri(ctx, uri)
          val existingMediators = mediatorsRepository.listMediators(limit = 2000)
          val mediatorKeyToId = existingMediators.associateBy({ normalizeKey(it.name, it.phone) }, { it.id })

          val rows = parseCsv(text)
          if (rows.isEmpty()) throw IllegalArgumentException("CSV is empty.")
          val header = rows.first().map { it.trim() }
          val headerIndex = header.mapIndexed { idx, h -> h.lowercase() to idx }.toMap()

          fun col(name: String): Int? = headerIndex[name.lowercase()]

          val nameIdx = col("name") ?: col("client name") ?: 0
          val phoneIdx = col("phone")
          val companyIdx = col("company")
          val locationIdx = col("location") ?: col("city")
          val amountIdx = col("loanamount") ?: col("loan amount") ?: col("amount")
          val statusIdx = col("status")
          val mediatorIdx = col("mediator")
          val nextIdx = col("nextfollowup") ?: col("next follow up") ?: col("next_follow_up")

          var created = 0
          var skipped = 0
          rows.drop(1).forEach { cols ->
            val name = cols.getOrNull(nameIdx)?.trim().orEmpty()
            if (name.isBlank()) {
              skipped++
              return@forEach
            }

            val phone = phoneIdx?.let { cols.getOrNull(it)?.trim() }?.takeIf { !it.isNullOrBlank() }
            val company = companyIdx?.let { cols.getOrNull(it)?.trim() }?.takeIf { !it.isNullOrBlank() }
            val location = locationIdx?.let { cols.getOrNull(it)?.trim() }?.takeIf { !it.isNullOrBlank() }
            val amount = amountIdx?.let { cols.getOrNull(it)?.trim() }?.toLongOrNull()
            val status = statusIdx?.let { cols.getOrNull(it)?.trim() }?.takeIf { !it.isNullOrBlank() } ?: "New"

            val mediatorName = mediatorIdx?.let { cols.getOrNull(it)?.trim() }?.takeIf { !it.isNullOrBlank() }
            val mediatorId =
              mediatorName?.let { mn ->
                mediatorKeyToId[normalizeKey(mn, null)]
              }

            val nextFollowUp =
              nextIdx?.let { cols.getOrNull(it)?.trim() }?.takeIf { !it.isNullOrBlank() }?.let { raw ->
                parseDateLike(raw)
              }
                ?: defaultNextFollowUpIso()

            val now = Instant.now().toString()
            leadsRepository.createLead(
              LeadCreateInput(
                name = name,
                phone = phone,
                company = company,
                location = location,
                status = status,
                loanAmount = amount,
                nextFollowUp = nextFollowUp,
                mediatorId = mediatorId,
                notes = listOf(LeadNote(text = "Imported via CSV", date = now)),
              ),
            )
            created++
          }

          setOk("Imported $created leads (skipped $skipped).")
        } catch (e: Exception) {
          setErr(e.message ?: "CSV import failed.")
        }
        busy = false
      }
    }

  val exportBackupLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
      if (uri == null) return@rememberLauncherForActivityResult
      scope.launch {
        busy = true
        try {
          val json = Json { prettyPrint = true; ignoreUnknownKeys = true }
          val mediators = mediatorsRepository.listMediators(limit = 2000)
          val leads = leadsRepository.listLeadsDetailed(limit = 4000)
          val root =
            buildJsonObject {
              put("version", JsonPrimitive(1))
              put("exportedAt", JsonPrimitive(Instant.now().toString()))
              put("mediators", json.encodeToJsonElement(ListSerializer(Mediator.serializer()), mediators))
              put("leads", json.encodeToJsonElement(ListSerializer(Lead.serializer()), leads))
            }
          val text = json.encodeToString(JsonObject.serializer(), root)
          writeTextToUri(ctx, uri, text)
          setOk("Backup exported (${leads.size} leads, ${mediators.size} mediators).")
        } catch (e: Exception) {
          setErr(e.message ?: "Backup export failed.")
        }
        busy = false
      }
    }

  val importBackupLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      if (uri == null) return@rememberLauncherForActivityResult
      scope.launch {
        busy = true
        try {
          val json = Json { ignoreUnknownKeys = true }
          val raw = readTextFromUri(ctx, uri)
          val root = json.decodeFromString(JsonElement.serializer(), raw).jsonObject
          val mediatorsEl = root["mediators"] ?: throw IllegalArgumentException("Backup missing mediators.")
          val leadsEl = root["leads"] ?: throw IllegalArgumentException("Backup missing leads.")

          val backupMediators =
            json.decodeFromJsonElement(ListSerializer(Mediator.serializer()), mediatorsEl)
          val backupLeads =
            json.decodeFromJsonElement(ListSerializer(Lead.serializer()), leadsEl)

          // Create / match mediators first to preserve lead relationships.
          val existing = mediatorsRepository.listMediators(limit = 2000)
          val existingKeyToId = existing.associateBy({ normalizeKey(it.name, it.phone) }, { it.id })
          val oldToNewMediatorId = mutableMapOf<String, String>()

          for (m in backupMediators) {
            val key = normalizeKey(m.name, m.phone)
            val existingId = existingKeyToId[key]
            if (existingId != null) {
              oldToNewMediatorId[m.id] = existingId
              continue
            }
            val created =
              mediatorsRepository.createMediator(
                MediatorCreateInput(
                  name = m.name,
                  phone = m.phone,
                ),
              )
            oldToNewMediatorId[m.id] = created.id
          }

          var createdLeads = 0
          val now = Instant.now().toString()
          for (l in backupLeads) {
            val mappedMediator = l.mediatorId?.let { oldToNewMediatorId[it] }
            leadsRepository.createLead(
              LeadCreateInput(
                name = l.name,
                phone = l.phone,
                company = l.company,
                location = l.location,
                status = l.status,
                loanAmount = l.loanAmount,
                nextFollowUp = l.nextFollowUp,
                mediatorId = mappedMediator,
                isHighPotential = l.isHighPotential,
                assignedStaff = l.assignedStaff,
                documents = l.documents,
                notes =
                  (l.notes + LeadNote(text = "Imported from backup", date = now)).takeLast(500),
                loanDetails = l.loanDetails,
                rejectionDetails = l.rejectionDetails,
              ),
            )
            createdLeads++
          }

          setOk("Imported backup ($createdLeads leads, ${backupMediators.size} mediators).")
        } catch (e: Exception) {
          setErr(e.message ?: "Backup import failed.")
        }
        busy = false
      }
    }

  val scroll = rememberScrollState()
  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    error?.let { msg ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Text(
          text = msg,
          modifier = Modifier.padding(12.dp),
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.error,
        )
      }
    }
    message?.let { msg ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Text(
          text = msg,
          modifier = Modifier.padding(12.dp),
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.secondary,
        )
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Backup & CSV", style = MaterialTheme.typography.titleLarge)
        Text(
          "Use these tools to safely export/import your data. Backup import appends new records (it doesn’t overwrite existing data).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (busy) {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Text("Working…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }

        Spacer(Modifier.height(4.dp))

        Text("Backup (JSON)", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          OutlinedButton(
            onClick = { exportBackupLauncher.launch("Jubilant_Backup_${Instant.now().toString().take(10)}.json") },
            enabled = !busy,
            modifier = Modifier.weight(1f),
          ) {
            Icon(Icons.Outlined.FileDownload, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Export")
          }
          OutlinedButton(
            onClick = { importBackupLauncher.launch(arrayOf("application/json", "text/plain")) },
            enabled = !busy,
            modifier = Modifier.weight(1f),
          ) {
            Icon(Icons.Outlined.FileUpload, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Import")
          }
        }

        Spacer(Modifier.height(6.dp))
        Text("Leads (CSV)", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          Button(
            onClick = { exportCsvLauncher.launch("Jubilant_Leads_${Instant.now().toString().take(10)}.csv") },
            enabled = !busy,
            modifier = Modifier.weight(1f),
          ) {
            Icon(Icons.Outlined.TableView, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Export CSV")
          }
          OutlinedButton(
            onClick = { importCsvLauncher.launch(arrayOf("text/csv", "text/plain")) },
            enabled = !busy,
            modifier = Modifier.weight(1f),
          ) {
            Icon(Icons.Outlined.FileUpload, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Import CSV")
          }
        }
      }
    }
  }
}

private suspend fun writeTextToUri(context: android.content.Context, uri: Uri, text: String) {
  withContext(Dispatchers.IO) {
    context.contentResolver.openOutputStream(uri)?.use { out ->
      out.write(text.toByteArray(Charsets.UTF_8))
      out.flush()
    } ?: throw IllegalStateException("Couldn’t open destination file.")
  }
}

private suspend fun readTextFromUri(context: android.content.Context, uri: Uri): String {
  return withContext(Dispatchers.IO) {
    context.contentResolver.openInputStream(uri)?.use { input ->
      input.readBytes().toString(Charsets.UTF_8)
    } ?: throw IllegalStateException("Couldn’t read selected file.")
  }
}

private fun buildLeadsCsv(
  leads: List<Lead>,
  mediatorNames: Map<String, String>,
): String {
  val header = listOf("Name", "Phone", "Company", "Location", "Status", "LoanAmount", "Mediator", "NextFollowUp", "CreatedAt")
  val rows =
    leads.map { l ->
      listOf(
        l.name,
        l.phone.orEmpty(),
        l.company.orEmpty(),
        l.location.orEmpty(),
        l.status.orEmpty(),
        (l.loanAmount ?: 0L).toString(),
        l.mediatorId?.let { mediatorNames[it] }.orEmpty(),
        l.nextFollowUp.orEmpty(),
        l.createdAt.orEmpty(),
      )
    }
  return buildString {
    appendLine(header.joinToString(",") { csvEscape(it) })
    rows.forEach { r ->
      appendLine(r.joinToString(",") { csvEscape(it) })
    }
  }
}

private fun csvEscape(raw: String): String {
  val s = raw
  val needsQuotes = s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r')
  val escaped = s.replace("\"", "\"\"")
  return if (needsQuotes) "\"$escaped\"" else escaped
}

private fun parseCsv(text: String): List<List<String>> {
  val lines =
    text
      .replace("\uFEFF", "") // BOM
      .split("\n")
      .map { it.trimEnd('\r') }
      .filter { it.isNotBlank() }
  return lines.map(::parseCsvLine)
}

private fun parseCsvLine(line: String): List<String> {
  val out = mutableListOf<String>()
  val sb = StringBuilder()
  var i = 0
  var inQuotes = false

  while (i < line.length) {
    val c = line[i]
    if (inQuotes) {
      if (c == '"') {
        if (i + 1 < line.length && line[i + 1] == '"') {
          sb.append('"')
          i++
        } else {
          inQuotes = false
        }
      } else {
        sb.append(c)
      }
    } else {
      when (c) {
        ',' -> {
          out.add(sb.toString())
          sb.setLength(0)
        }
        '"' -> inQuotes = true
        else -> sb.append(c)
      }
    }
    i++
  }
  out.add(sb.toString())
  return out
}

private fun normalizeKey(name: String?, phone: String?): String {
  val n = name?.trim()?.lowercase().orEmpty()
  val p = phone?.trim()?.replace(" ", "")?.lowercase().orEmpty()
  return "$n|$p"
}

private fun defaultNextFollowUpIso(): String {
  val next = LocalDate.now(ZoneId.systemDefault()).plusDays(1)
  return next.atStartOfDay(ZoneId.systemDefault()).toInstant().toString()
}

private fun parseDateLike(raw: String): String? {
  val s = raw.trim()
  if (s.isBlank()) return null

  // Accept ISO instants directly.
  runCatching { Instant.parse(s) }.getOrNull()?.let { return it.toString() }

  // Accept YYYY-MM-DD (local date).
  val d = runCatching { LocalDate.parse(s.take(10)) }.getOrNull() ?: return null
  return d.atStartOfDay(ZoneId.systemDefault()).toInstant().toString()
}
