package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.URLUtil
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
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import java.net.URLConnection
import java.time.Instant
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanDocScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  session: SessionState,
  onMutated: () -> Unit,
  onLeadClick: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val scroll = rememberScrollState()
  val actor = remember(session.userId, session.myProfile) { session.myProfile?.email ?: session.userId ?: "unknown" }

  var query by remember { mutableStateOf("") }
  var busy by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var selectedLeadId by remember { mutableStateOf<String?>(null) }

  fun resolveDisplayName(uri: Uri): String {
    val cr = context.contentResolver
    val name =
      runCatching {
        cr.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) cursor.getString(0) else null
        }
      }.getOrNull()
    val fallback = URLUtil.guessFileName(uri.toString(), null, cr.getType(uri))
    return name?.takeIf { it.isNotBlank() } ?: fallback.takeIf { it.isNotBlank() } ?: "attachment"
  }

  fun contentTypeFor(uri: Uri, fileName: String): String =
    context.contentResolver.getType(uri)
      ?: URLConnection.guessContentTypeFromName(fileName)
      ?: "application/octet-stream"

  fun appendNote(leadId: String, noteText: String) {
    scope.launch {
      runCatching {
        val lead = leadsRepository.getLead(leadId)
        val now = Instant.now().toString()
        val nextNotes = (lead.notes + LeadNote(text = noteText, date = now, byUser = actor)).takeLast(500)
        leadsRepository.updateLead(leadId, LeadUpdate(notes = nextNotes))
      }.onSuccess { onMutated() }
        .onFailure { Toast.makeText(context, it.message ?: "Couldn’t log action.", Toast.LENGTH_LONG).show() }
    }
  }

  val pickDoc =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
      val leadId = selectedLeadId
      if (uri == null || leadId.isNullOrBlank()) return@rememberLauncherForActivityResult
      scope.launch {
        busy = true
        error = null
        runCatching {
          runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
          val fileName = resolveDisplayName(uri)
          val contentType = contentTypeFor(uri, fileName)
          val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Couldn’t read file.")
          leadsRepository.uploadLeadAttachment(
            leadId = leadId,
            fileName = fileName,
            bytes = bytes,
            contentType = contentType,
          )
          appendNote(leadId, "[ATTACHMENT]: Uploaded $fileName (Scan Doc)")
          Toast.makeText(context, "Uploaded: $fileName", Toast.LENGTH_SHORT).show()
          onMutated()
        }.onFailure { ex ->
          error = ex.message ?: "Upload failed."
        }
        busy = false
      }
    }

  val filtered =
    remember(leads, query) {
      val q = query.trim().lowercase()
      if (q.isBlank()) {
        leads.sortedByDescending { it.updatedAt ?: it.createdAt }.take(80)
      } else {
        leads
          .filter { l ->
            (l.name).lowercase().contains(q) ||
              (l.company ?: "").lowercase().contains(q) ||
              (l.phone ?: "").contains(q)
          }
          .sortedByDescending { it.updatedAt ?: it.createdAt }
          .take(80)
      }
    }

  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Scan / Upload document", style = MaterialTheme.typography.titleMedium)
        Text(
          "Pick a lead, then select a file (PDF / image) to upload to that lead’s attachments.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    OutlinedTextField(
      value = query,
      onValueChange = { query = it },
      modifier = Modifier.fillMaxWidth(),
      leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
      label = { Text("Search (client / company / phone)") },
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
      colors =
        TextFieldDefaults.outlinedTextFieldColors(
          focusedBorderColor = MaterialTheme.colorScheme.secondary,
          focusedLabelColor = MaterialTheme.colorScheme.secondary,
          cursorColor = MaterialTheme.colorScheme.secondary,
        ),
    )

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

    if (busy) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
        Spacer(Modifier.size(10.dp))
        Text("Uploading…", style = MaterialTheme.typography.bodyMedium)
      }
    }

    if (filtered.isEmpty()) {
      Text(
        "No leads found.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    } else {
      filtered.forEach { l ->
        Card(
          modifier =
            Modifier
              .fillMaxWidth()
              .clickable(
                enabled = !busy,
                onClick = {
                  selectedLeadId = l.id
                  pickDoc.launch(arrayOf("application/pdf", "image/*"))
                },
              ),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        ) {
          Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
          ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
              Text(l.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
              val sub =
                listOfNotNull(
                  l.company?.takeIf { it.isNotBlank() },
                  l.phone?.takeIf { it.isNotBlank() },
                  l.status?.takeIf { it.isNotBlank() },
                ).joinToString(" • ")
              Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            TextButton(onClick = { onLeadClick(l.id) }, enabled = !busy) {
              Text("Open")
            }
          }
        }
      }
    }
  }
}
