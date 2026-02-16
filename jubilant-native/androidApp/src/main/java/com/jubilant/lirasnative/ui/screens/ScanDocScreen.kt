package com.jubilant.lirasnative.ui.screens

import android.graphics.BitmapFactory
import android.graphics.pdf.PdfDocument
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
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import java.net.URLConnection
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanDocScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  session: SessionState,
  initialLeadId: String? = null,
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
  var selectedLeadId by remember(initialLeadId) { mutableStateOf<String?>(initialLeadId) }
  var smartWarning by remember { mutableStateOf<String?>(null) }

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
      val now = Instant.now().toString()
      val note = LeadNote(text = noteText, date = now, byUser = actor)
      runCatching {
        val lead = leadsRepository.getLead(leadId)
        val nextNotes = (lead.notes + note).takeLast(500)
        leadsRepository.updateLead(leadId, LeadUpdate(notes = nextNotes))
      }.onSuccess { onMutated() }
        .onFailure {
          RetryQueueStore.enqueueLeadAppendNote(context.applicationContext, leadId, note)
          RetrySyncScheduler.enqueueNow(context.applicationContext)
          Toast.makeText(context, "Saved offline — will sync when online.", Toast.LENGTH_LONG).show()
        }
    }
  }

  suspend fun uploadBytes(leadId: String, fileName: String, bytes: ByteArray, contentType: String) {
    leadsRepository.uploadLeadAttachment(
      leadId = leadId,
      fileName = fileName,
      bytes = bytes,
      contentType = contentType,
    )
    appendNote(leadId, "[ATTACHMENT]: Uploaded $fileName (Scan Doc)")
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
          smartWarning = smartCaptureWarning(contentType = contentType, bytes = bytes)
          uploadBytes(leadId = leadId, fileName = fileName, bytes = bytes, contentType = contentType)
          Toast.makeText(context, "Uploaded: $fileName", Toast.LENGTH_SHORT).show()
          onMutated()
        }.onFailure { ex ->
          error = ex.message ?: "Upload failed."
        }
        busy = false
      }
    }

  val stitchImages =
    rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
      val leadId = selectedLeadId
      if (uris.isNullOrEmpty() || leadId.isNullOrBlank()) return@rememberLauncherForActivityResult
      scope.launch {
        busy = true
        error = null
        runCatching {
          val pages =
            uris.mapNotNull { uri ->
              runCatching {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                  val raw = stream.readBytes()
                  val bitmap = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: return@use null
                  bitmap
                }
              }.getOrNull()
            }
          if (pages.isEmpty()) error("No readable images selected.")
          val pdfBytes = stitchImagesToPdf(pages)
          val ts = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
          val fileName = "scan_stitch_$ts.pdf"
          uploadBytes(
            leadId = leadId,
            fileName = fileName,
            bytes = pdfBytes,
            contentType = "application/pdf",
          )
          smartWarning = null
          Toast.makeText(context, "Uploaded stitched PDF: $fileName", Toast.LENGTH_SHORT).show()
          onMutated()
        }.onFailure { ex ->
          error = ex.message ?: "Stitch upload failed."
        }
        busy = false
      }
    }

  androidx.compose.runtime.LaunchedEffect(initialLeadId) {
    if (initialLeadId.isNullOrBlank()) return@LaunchedEffect
    // Auto-open document picker for the chosen lead (quick action flow).
    selectedLeadId = initialLeadId
    pickDoc.launch(arrayOf("application/pdf", "image/*"))
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
          "Pick a lead, then upload PDF/image, or stitch multiple images into one PDF. Smart checks warn on blurry scans.",
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

    smartWarning?.let { warning ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.10f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.30f)),
      ) {
        Text(
          warning,
          modifier = Modifier.padding(12.dp),
          color = MaterialTheme.colorScheme.onSurface,
          style = MaterialTheme.typography.bodySmall,
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
            Column(horizontalAlignment = Alignment.End) {
              TextButton(
                onClick = {
                  selectedLeadId = l.id
                  pickDoc.launch(arrayOf("application/pdf", "image/*"))
                },
                enabled = !busy,
              ) {
                Text("Upload")
              }
              TextButton(
                onClick = {
                  selectedLeadId = l.id
                  stitchImages.launch(arrayOf("image/*"))
                },
                enabled = !busy,
              ) {
                Text("Stitch PDF")
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
}

private fun smartCaptureWarning(contentType: String, bytes: ByteArray): String? {
  if (!contentType.startsWith("image/")) return null
  val bitmap = runCatching { BitmapFactory.decodeByteArray(bytes, 0, bytes.size) }.getOrNull() ?: return null
  val width = bitmap.width
  val height = bitmap.height
  val megapixels = (width.toLong() * height.toLong()) / 1_000_000.0
  val sharpness = estimateSharpness(bitmap)
  return when {
    megapixels < 1.0 -> "Scan quality warning: low resolution (${String.format(Locale.US, "%.2f", megapixels)} MP)."
    sharpness < 9.0 -> "Scan quality warning: image appears blurry; consider retaking before final submission."
    else -> null
  }
}

private fun estimateSharpness(bitmap: android.graphics.Bitmap): Double {
  val sampleW = bitmap.width.coerceAtMost(320)
  val sampleH = bitmap.height.coerceAtMost(320)
  val scaled = android.graphics.Bitmap.createScaledBitmap(bitmap, sampleW, sampleH, true)
  val pixels = IntArray(sampleW * sampleH)
  scaled.getPixels(pixels, 0, sampleW, 0, 0, sampleW, sampleH)

  var gradientSum = 0.0
  var count = 0
  for (y in 1 until sampleH - 1) {
    for (x in 1 until sampleW - 1) {
      val i = y * sampleW + x
      val c = luma(pixels[i])
      val rx = luma(pixels[i + 1])
      val by = luma(pixels[i + sampleW])
      gradientSum += kotlin.math.abs(c - rx) + kotlin.math.abs(c - by)
      count++
    }
  }
  return if (count == 0) 0.0 else gradientSum / count
}

private fun luma(pixel: Int): Double {
  val r = (pixel shr 16) and 0xFF
  val g = (pixel shr 8) and 0xFF
  val b = pixel and 0xFF
  return 0.299 * r + 0.587 * g + 0.114 * b
}

private fun stitchImagesToPdf(bitmaps: List<android.graphics.Bitmap>): ByteArray {
  val doc = PdfDocument()
  try {
    bitmaps.forEachIndexed { index, bitmap ->
      val maxW = 1080
      val scaledHeight = (bitmap.height.toFloat() * (maxW / bitmap.width.toFloat())).toInt().coerceAtLeast(1)
      val scaled = android.graphics.Bitmap.createScaledBitmap(bitmap, maxW, scaledHeight, true)
      val pageInfo = PdfDocument.PageInfo.Builder(maxW, scaledHeight, index + 1).create()
      val page = doc.startPage(pageInfo)
      page.canvas.drawBitmap(scaled, 0f, 0f, null)
      doc.finishPage(page)
    }
    val out = ByteArrayOutputStream()
    doc.writeTo(out)
    return out.toByteArray()
  } finally {
    doc.close()
  }
}
