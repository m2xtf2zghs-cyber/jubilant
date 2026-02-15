package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Assessment
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Handshake
import androidx.compose.material.icons.outlined.MeetingRoom
import androidx.compose.material.icons.outlined.Undo
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.MediatorsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorFollowUpEntry
import com.jubilant.lirasnative.shared.supabase.MediatorUpdate
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.launch
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.PdfSection
import com.jubilant.lirasnative.ui.util.createSimplePdf
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.nowKolkataDate
import com.jubilant.lirasnative.ui.util.sharePdf

@Composable
fun MediatorDetailScreen(
  mediator: Mediator,
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  mediatorsRepository: MediatorsRepository,
  onLeadClick: (id: String) -> Unit,
  onDeleted: () -> Unit,
  onMutated: () -> Unit,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()

  var busy by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }

  var showEdit by remember { mutableStateOf(false) }
  var showDelete by remember { mutableStateOf(false) }
  var editName by remember(mediator.id, mediator.updatedAt) { mutableStateOf(mediator.name) }
  var editPhone by remember(mediator.id, mediator.updatedAt) { mutableStateOf(mediator.phone.orEmpty()) }

  val today = nowKolkataDate().toString()
  val history = mediator.followUpHistory
  val doneEntry = history.firstOrNull { it.date == today }
  val isDoneToday = doneEntry != null

  val mediatorLeads = remember(leads, mediator.id) { leads.filter { it.mediatorId == mediator.id } }

  var reportBusy by remember { mutableStateOf(false) }
  var reportError by remember { mutableStateOf<String?>(null) }
  var detailedLoading by remember { mutableStateOf(false) }
  var detailedLeads by remember { mutableStateOf<List<Lead>>(emptyList()) }

  suspend fun ensureDetailedLeads(): List<Lead> {
    if (detailedLeads.isNotEmpty()) return detailedLeads
    detailedLoading = true
    reportError = null
    return try {
      val items = leadsRepository.listLeadsDetailed(limit = 1500)
      detailedLeads = items
      items
    } catch (e: Exception) {
      reportError = e.message ?: "Couldn’t load lead details for reports."
      emptyList()
    } finally {
      detailedLoading = false
    }
  }

  fun updateFollowUp(type: String?) {
    val now = LocalTime.now(KOLKATA_ZONE).format(DateTimeFormatter.ofPattern("hh:mm a"))
    val nextHistory =
      if (type == null) {
        history.filterNot { it.date == today }
      } else {
        val entry = MediatorFollowUpEntry(date = today, time = now, type = type)
        val without = history.filterNot { it.date == today }
        without + entry
      }

    scope.launch {
      busy = true
      error = null
      runCatching {
        mediatorsRepository.updateMediator(
          mediator.id,
          MediatorUpdate(followUpHistory = nextHistory),
        )
      }
        .onFailure { error = it.message ?: "Update failed." }
        .onSuccess { onMutated() }
      busy = false
    }
  }

  Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    error?.let {
      Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(it, modifier = Modifier.padding(12.dp), color = MaterialTheme.colorScheme.error)
      }
    }

    reportError?.let {
      Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(it, modifier = Modifier.padding(12.dp), color = MaterialTheme.colorScheme.error)
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Icon(Icons.Outlined.Handshake, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
          ) {
            Text(
              mediator.name,
              style = MaterialTheme.typography.titleLarge,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.weight(1f),
            )
            if (!mediator.phone.isNullOrBlank()) {
              Text(
                mediator.phone!!,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
              )
            }
          }
        }

        if (!mediator.phone.isNullOrBlank()) {
          Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
          ) {
            TextButton(
              onClick = {
                context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${mediator.phone}")))
                updateFollowUp("call")
              },
              enabled = !busy,
              modifier = Modifier.weight(1f),
            ) {
              Icon(Icons.Outlined.Call, contentDescription = null)
              Spacer(Modifier.width(6.dp))
              Text("Call", maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            TextButton(
              onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${mediator.phone}")))
                updateFollowUp("whatsapp")
              },
              enabled = !busy,
              modifier = Modifier.weight(1f),
            ) {
              Icon(Icons.Outlined.Chat, contentDescription = null)
              Spacer(Modifier.width(6.dp))
              Text("WA", maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            TextButton(
              onClick = { updateFollowUp("meeting") },
              enabled = !busy,
              modifier = Modifier.weight(1f),
            ) {
              Icon(Icons.Outlined.MeetingRoom, contentDescription = null)
              Spacer(Modifier.width(6.dp))
              Text("Meet", maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          TextButton(onClick = { showEdit = true }, enabled = !busy) {
            Icon(Icons.Outlined.Edit, contentDescription = null)
            Spacer(Modifier.width(6.dp))
            Text("Edit")
          }
          TextButton(onClick = { showDelete = true }, enabled = !busy) {
            Icon(Icons.Outlined.DeleteOutline, contentDescription = null)
            Spacer(Modifier.width(6.dp))
            Text("Delete")
          }
        }

        if (busy) {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Text("Updating…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        } else {
          if (isDoneToday) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
              Text(
                "Logged today: ${doneEntry?.time ?: "--"} • ${doneEntry?.type ?: ""}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
              TextButton(onClick = { updateFollowUp(null) }) {
                Icon(Icons.Outlined.Undo, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("Undo")
              }
            }
          } else {
            Text(
              "No engagement logged today.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Outlined.Assessment, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text("Reports (PDF)", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        }
        Text(
          "Export professional partner reports for this mediator.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (detailedLoading || reportBusy) {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Text("Preparing…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }

        fun runReport(
          fileNamePrefix: String,
          title: String,
          sections: (today: LocalDate, leads: List<Lead>) -> List<PdfSection>,
        ) {
          if (reportBusy) return
          reportBusy = true
          reportError = null
          scope.launch {
            try {
              val all = ensureDetailedLeads()
              val mLeads = all.filter { it.mediatorId == mediator.id }
              val todayDate = nowKolkataDate()
              val file =
                createSimplePdf(
	                  context = context,
	                  fileNamePrefix = "${fileNamePrefix}_${mediator.id}",
	                  title = title,
	                  subtitle = "${mediator.name}${mediator.phone?.let { " • $it" } ?: ""} • $todayDate",
	                  sections = sections(todayDate, mLeads),
	                )
              sharePdf(context, file, chooserTitle = "Share PDF")
            } catch (e: Exception) {
              reportError = e.message ?: "Report export failed."
            }
            reportBusy = false
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          TextButton(
            onClick = {
              runReport(
                fileNamePrefix = "mediator_pending",
                title = "Jubilant Capital • Partner Action Report",
              ) { todayDate, mLeads ->
                buildMediatorPendingSections(today = todayDate, mediator = mediator, leads = mLeads)
              }
            },
            enabled = !reportBusy,
            modifier = Modifier.weight(1f),
          ) {
            Text("Pending")
          }
          TextButton(
            onClick = {
              runReport(
                fileNamePrefix = "mediator_briefing",
                title = "Jubilant Capital • Daily Briefing",
              ) { todayDate, mLeads ->
                buildMediatorBriefingSections(today = todayDate, mediator = mediator, leads = mLeads)
              }
            },
            enabled = !reportBusy,
            modifier = Modifier.weight(1f),
          ) {
            Text("Briefing")
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          TextButton(
            onClick = {
              runReport(
                fileNamePrefix = "mediator_rejections",
                title = "Jubilant Capital • Rejection Audit",
              ) { todayDate, mLeads ->
                buildMediatorRejectionSections(today = todayDate, mediator = mediator, leads = mLeads)
              }
            },
            enabled = !reportBusy,
            modifier = Modifier.weight(1f),
          ) {
            Text("Reject audit")
          }
          TextButton(
            onClick = {
              runReport(
                fileNamePrefix = "mediator_analysis",
                title = "Jubilant Capital • Partner Analysis",
              ) { todayDate, mLeads ->
                buildMediatorFullAnalysisSections(today = todayDate, mediator = mediator, leads = mLeads)
              }
            },
            enabled = !reportBusy,
            modifier = Modifier.weight(1f),
          ) {
            Text("Full analysis")
          }
        }
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Outlined.Groups, contentDescription = null)
          Spacer(Modifier.width(10.dp))
          Text("Leads (${mediatorLeads.size})", style = MaterialTheme.typography.titleMedium)
        }
        if (mediatorLeads.isEmpty()) {
          Text("No leads linked to this mediator yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(mediatorLeads.take(30)) { l ->
              LeadMiniCard(l, onClick = { onLeadClick(l.id) })
            }
          }
        }
      }
    }

    if (showEdit) {
      AlertDialog(
        onDismissRequest = { showEdit = false },
        title = { Text("Edit mediator") },
        text = {
          Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
              value = editName,
              onValueChange = { editName = it },
              label = { Text("Name") },
              singleLine = true,
              modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
              value = editPhone,
              onValueChange = { editPhone = it },
              label = { Text("Phone") },
              singleLine = true,
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
              modifier = Modifier.fillMaxWidth(),
            )
          }
        },
        confirmButton = {
          TextButton(
            onClick = {
              val nextName = editName.trim()
              if (nextName.isBlank()) {
                error = "Mediator name is required."
                return@TextButton
              }
              scope.launch {
                busy = true
                error = null
                runCatching {
                  mediatorsRepository.updateMediator(
                    mediator.id,
                    MediatorUpdate(
                      name = nextName,
                      phone = editPhone.trim().takeIf { it.isNotBlank() },
                    ),
                  )
                }
                  .onFailure { error = it.message ?: "Update failed." }
                  .onSuccess {
                    showEdit = false
                    onMutated()
                  }
                busy = false
              }
            },
            enabled = !busy,
          ) {
            Text("Save")
          }
        },
        dismissButton = {
          TextButton(onClick = { showEdit = false }, enabled = !busy) {
            Text("Cancel")
          }
        },
      )
    }

    if (showDelete) {
      AlertDialog(
        onDismissRequest = { showDelete = false },
        title = { Text("Delete mediator?") },
        text = {
          Text(
            "This will remove the mediator. If leads are linked, we’ll try to unlink them first.",
            style = MaterialTheme.typography.bodyMedium,
          )
        },
        confirmButton = {
          TextButton(
            onClick = {
              scope.launch {
                busy = true
                error = null
                var deleted = false
                val first = runCatching { mediatorsRepository.deleteMediator(mediator.id) }
                if (first.isSuccess) {
                  deleted = true
                } else {
                  // Attempt to unlink leads then retry delete.
                  val unlink = runCatching { leadsRepository.clearMediatorFromLeads(mediator.id) }
                  if (unlink.isFailure) {
                    error = unlink.exceptionOrNull()?.message ?: "Couldn’t unlink mediator from leads."
                  } else {
                    val second = runCatching { mediatorsRepository.deleteMediator(mediator.id) }
                    if (second.isSuccess) {
                      deleted = true
                    } else {
                      error = second.exceptionOrNull()?.message ?: "Delete failed."
                    }
                  }
                }

                if (deleted) {
                  showDelete = false
                  onMutated()
                  onDeleted()
                }
                busy = false
              }
            },
            enabled = !busy,
          ) {
            Text("Delete", color = MaterialTheme.colorScheme.error)
          }
        },
        dismissButton = {
          TextButton(onClick = { showDelete = false }, enabled = !busy) {
            Text("Cancel")
          }
        },
      )
    }
  }
}

@Composable
private fun LeadMiniCard(
  lead: LeadSummary,
  onClick: () -> Unit,
) {
  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(lead.name, style = MaterialTheme.typography.titleSmall)
      val sub = listOfNotNull(lead.company?.takeIf { it.isNotBlank() }, lead.location?.takeIf { it.isNotBlank() }).joinToString(" • ")
      if (sub.isNotBlank()) Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        LeadStatusPill(status = lead.status)
        val next = lead.nextFollowUp?.let(::formatShortDate).orEmpty()
        if (next.isNotBlank()) Text("Next: $next", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

private fun buildMediatorPendingSections(
  today: LocalDate,
  mediator: Mediator,
  leads: List<Lead>,
): List<PdfSection> {
  val closed = setOf("Payment Done", "Deal Closed")
  val rejected = setOf("Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)")
  val pending =
    leads
      .filter { (it.status ?: "").trim() !in closed && (it.status ?: "").trim() !in rejected }
      .sortedBy { isoToKolkataDate(it.createdAt) ?: LocalDate.MIN }

  val volume = pending.sumOf { it.loanAmount ?: 0L }
  val critical =
    pending.count { l ->
      val created = isoToKolkataDate(l.createdAt) ?: return@count false
      ChronoUnit.DAYS.between(created, today) > 15
    }

  val summary =
    listOf(
      "Date: $today",
      "Mediator: ${mediator.name}",
      "Pending cases: ${pending.size}",
      "Pipeline value: ${formatCompactInr(volume)}",
      "Stagnant (>15 days): $critical",
    )

  val lines =
    if (pending.isEmpty()) listOf("No pending leads.")
    else pending.take(120).map { l ->
      val status = (l.status ?: "Unknown").trim().ifBlank { "Unknown" }
      val amt = formatCompactInr(l.loanAmount ?: 0L)
      val age =
        isoToKolkataDate(l.createdAt)?.let { d -> ChronoUnit.DAYS.between(d, today).toString() } ?: "--"
      val last = l.notes.lastOrNull()?.text?.replace("\n", " ")?.take(140).orEmpty()
      "${l.name} | $status | Age: ${age}d | $amt | $last"
    }

  return listOf(
    PdfSection("Summary", summary),
    PdfSection("Pending leads", lines),
  )
}

private fun buildMediatorBriefingSections(
  today: LocalDate,
  mediator: Mediator,
  leads: List<Lead>,
): List<PdfSection> {
  val statuses =
    setOf(
      "Meeting Scheduled",
      "Follow-Up Required",
      "Interest Rate Issue",
      "No Appointment",
      "Payment Done",
      "Statements Not Received",
      "Contact Details Not Received",
      "Not Eligible",
    )

  val items =
    leads
      .filter { l ->
        val s = (l.status ?: "").trim()
        val updatedToday = isoToKolkataDate(l.updatedAt) == today
        s in statuses || updatedToday
      }
      .sortedBy { (it.status ?: "").trim() }

  val summary =
    listOf(
      "Date: $today",
      "Mediator: ${mediator.name}",
      "Active items: ${items.size}",
    )

  val lines =
    if (items.isEmpty()) listOf("No briefing items for today.")
    else items.take(160).map { l ->
      val status = (l.status ?: "Unknown").trim().ifBlank { "Unknown" }
      val last = l.notes.lastOrNull()?.text?.replace("\n", " ")?.take(160).orEmpty()
      "${l.name} | $status | $last"
    }

  return listOf(
    PdfSection("Summary", summary),
    PdfSection("Briefing", lines),
  )
}

private fun buildMediatorRejectionSections(
  today: LocalDate,
  mediator: Mediator,
  leads: List<Lead>,
): List<PdfSection> {
  val rejected = setOf("Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)")
  val items =
    leads
      .filter { (it.status ?: "").trim() in rejected }
      .sortedByDescending { isoToKolkataDate(it.updatedAt) ?: LocalDate.MIN }

  val summary =
    listOf(
      "Date: $today",
      "Mediator: ${mediator.name}",
      "Rejected cases: ${items.size}",
    )

  val lines =
    if (items.isEmpty()) listOf("No rejected leads found.")
    else items.take(200).map { l ->
      val status = (l.status ?: "Rejected").trim()
      val reason = l.rejectionDetails?.reason ?: l.notes.lastOrNull { it.text.contains("REJECTION", true) }?.text ?: "—"
      "${l.name} | $status | ${reason.replace("\n", " ").take(170)}"
    }

  return listOf(
    PdfSection("Summary", summary),
    PdfSection("Rejections", lines),
  )
}

private fun buildMediatorFullAnalysisSections(
  today: LocalDate,
  mediator: Mediator,
  leads: List<Lead>,
): List<PdfSection> {
  val closed = setOf("Payment Done", "Deal Closed")
  val rejected = setOf("Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)")

  val total = leads.size
  val closedLeads = leads.filter { (it.status ?: "").trim() in closed }
  val rejectedLeads = leads.filter { (it.status ?: "").trim() in rejected }
  val active = (total - closedLeads.size - rejectedLeads.size).coerceAtLeast(0)

  val closedVolume = closedLeads.sumOf { it.loanAmount ?: 0L }
  val totalVolume = leads.sumOf { it.loanAmount ?: 0L }
  val conversion = if (total == 0) 0.0 else (closedLeads.size.toDouble() / total.toDouble()) * 100.0
  val conversionPct = String.format(java.util.Locale.US, "%.1f", conversion)

  val summary =
    listOf(
      "Date: $today",
      "Mediator: ${mediator.name}",
      "Total leads: $total",
      "Closed: ${closedLeads.size}",
      "Active: $active",
      "Rejected: ${rejectedLeads.size}",
      "Conversion: $conversionPct%",
      "Total volume: ${formatCompactInr(totalVolume)}",
      "Closed volume: ${formatCompactInr(closedVolume)}",
      "Engagement: ${mediator.followUpHistory.size} total connects",
    )

  val statusCounts =
    leads
      .groupBy { (it.status ?: "Unknown").trim().ifBlank { "Unknown" } }
      .mapValues { (_, v) -> v.size }
      .entries
      .sortedByDescending { it.value }
      .take(12)
      .map { (s, c) -> "$s: $c" }

  val highlights =
    listOf(
      "Top statuses: ${if (statusCounts.isEmpty()) "—" else statusCounts.joinToString(" • ")}",
    )

  return listOf(
    PdfSection("Summary", summary),
    PdfSection("Highlights", highlights),
  )
}
