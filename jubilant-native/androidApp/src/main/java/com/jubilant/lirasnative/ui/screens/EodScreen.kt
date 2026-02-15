package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PictureAsPdf
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorFollowUpEntry
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.ui.util.PdfSection
import com.jubilant.lirasnative.ui.util.createSimplePdf
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import com.jubilant.lirasnative.ui.util.sharePdf
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale
import kotlinx.coroutines.launch

private enum class EodTab(
  val label: String,
) {
  Clearance("Clearance"),
  Daily("Daily report"),
}

@Composable
fun EodScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  mediators: List<Mediator>,
  session: SessionState,
  onLeadClick: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  val ctx = androidx.compose.ui.platform.LocalContext.current
  val today by rememberKolkataDateTicker()

  var tab by remember { mutableStateOf(EodTab.Clearance) }
  var exporting by remember { mutableStateOf(false) }

  // ---- Clearance list (fast, derived from summaries) ----
  val closedStatuses = remember { setOf("Payment Done", "Deal Closed") }
  val rejectedStatuses = remember { setOf("Not Eligible", "Not Reliable", "Lost to Competitor") }

  val pending =
    remember(leads) {
      leads
        .filter { l ->
          val s = l.status?.trim().orEmpty()
          s.isBlank() || (s !in closedStatuses && s !in rejectedStatuses)
        }
        .filter { l ->
          val d = isoToKolkataDate(l.updatedAt)
          d == null || d != today
        }
        .sortedWith(compareBy<LeadSummary>({ it.status ?: "" }, { it.name.lowercase() }))
    }

  // ---- Daily activity (loads detailed leads on demand) ----
  var dailyLoading by remember { mutableStateOf(false) }
  var dailyError by remember { mutableStateOf<String?>(null) }
  var detailedLeads by remember { mutableStateOf<List<Lead>>(emptyList()) }

  LaunchedEffect(tab) {
    if (tab != EodTab.Daily) return@LaunchedEffect
    if (detailedLeads.isNotEmpty() || dailyLoading) return@LaunchedEffect
    dailyLoading = true
    dailyError = null
    try {
      detailedLeads = leadsRepository.listLeadsDetailed(limit = 1000)
    } catch (e: Exception) {
      dailyError = e.message ?: "Couldn’t load daily activity."
    }
    dailyLoading = false
  }

  val daily =
    remember(detailedLeads, mediators, session.profiles) {
      computeDailyActivity(today = today, leads = detailedLeads, mediators = mediators, session = session)
    }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("End of day", style = MaterialTheme.typography.titleMedium)
        Text(
          "Day boundary uses India time (Asia/Kolkata).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          EodTab.entries.forEach { t ->
            FilterChip(
              selected = tab == t,
              onClick = { tab = t },
              label = { Text(t.label) },
              colors =
                FilterChipDefaults.filterChipColors(
                  containerColor = MaterialTheme.colorScheme.surfaceVariant,
                  selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                  selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = tab == t,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }

        OutlinedButton(
          onClick = {
            if (exporting) return@OutlinedButton
            exporting = true
            scope.launch {
              runCatching {
                val sections =
                  when (tab) {
                    EodTab.Clearance -> eodClearanceSections(today = today, pending = pending)
                    EodTab.Daily -> dailyActivitySections(today = today, daily = daily)
                  }
                val file =
                  createSimplePdf(
                    context = ctx,
                    fileNamePrefix = if (tab == EodTab.Clearance) "eod_clearance" else "daily_activity",
                    title = "Jubilant Capital • ${if (tab == EodTab.Clearance) "EOD Clearance" else "Daily Activity"}",
                    subtitle = "Date: $today",
                    sections = sections,
                  )
                sharePdf(ctx, file, chooserTitle = "Share PDF")
              }
              exporting = false
            }
          },
          enabled = !exporting,
          modifier = Modifier.fillMaxWidth(),
        ) {
          Icon(Icons.Outlined.PictureAsPdf, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text(if (exporting) "Preparing PDF…" else "Export PDF")
        }
      }
    }

    when (tab) {
      EodTab.Clearance -> ClearanceBody(pending = pending, onLeadClick = onLeadClick)
      EodTab.Daily ->
        DailyBody(
          loading = dailyLoading,
          error = dailyError,
          daily = daily,
        )
    }
  }
}

@Composable
private fun ClearanceBody(
  pending: List<LeadSummary>,
  onLeadClick: (String) -> Unit,
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Pending updates", style = MaterialTheme.typography.titleMedium)
      Text(
        "Leads that haven’t been updated today are shown here.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        "Pending: ${pending.size}",
        style = MaterialTheme.typography.titleLarge,
        color = MaterialTheme.colorScheme.secondary,
      )

      if (pending.isEmpty()) {
        Text("All caught up for today.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          items(pending.take(60)) { lead ->
            LeadMiniRow(lead = lead, onClick = { onLeadClick(lead.id) })
          }
        }
        if (pending.size > 60) {
          Spacer(Modifier.height(8.dp))
          Text(
            "Showing first 60 of ${pending.size}.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
    }
  }
}

@Composable
private fun DailyBody(
  loading: Boolean,
  error: String?,
  daily: DailyActivity,
) {
  if (!error.isNullOrBlank()) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Text(
        text = error,
        modifier = Modifier.padding(12.dp),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
      )
    }
  }

  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Daily activity", style = MaterialTheme.typography.titleMedium)

      if (loading) {
        Text("Loading…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        return@Column
      }

      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        StatTile(label = "Leads added", value = daily.leadsAdded.toString(), modifier = Modifier.weight(1f))
        StatTile(label = "Payments", value = daily.paymentsDone.toString(), modifier = Modifier.weight(1f))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        StatTile(label = "Client calls", value = daily.clientCalls.toString(), modifier = Modifier.weight(1f))
        StatTile(label = "Client WA", value = daily.clientWhatsapps.toString(), modifier = Modifier.weight(1f))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        StatTile(label = "Meetings", value = daily.meetingsScheduled.toString(), modifier = Modifier.weight(1f))
        StatTile(label = "Follow-ups", value = daily.followUps.toString(), modifier = Modifier.weight(1f))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        StatTile(label = "Visits", value = daily.commercialVisits.toString(), modifier = Modifier.weight(1f))
        StatTile(label = "Mediators", value = daily.mediatorsCollected.toString(), modifier = Modifier.weight(1f))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        StatTile(label = "Rejections", value = daily.rejections.toString(), modifier = Modifier.weight(1f))
        StatTile(label = "Partner connects", value = daily.partnerConnects.toString(), modifier = Modifier.weight(1f))
      }

      if (daily.byStaff.isNotEmpty()) {
        Spacer(Modifier.height(4.dp))
        Text("By staff", style = MaterialTheme.typography.titleSmall)
        daily.byStaff.take(12).forEach { row ->
          Text(
            "${row.staff}: +${row.leadsAdded} leads • ${row.clientCalls} calls • ${row.clientWhatsapps} WA • ${row.paymentsDone} pay • ${row.meetingsScheduled} mtg • ${row.followUps} FU • ${row.commercialVisits} visits • ${row.mediatorsCollected} mediators • ${row.rejections} rej • ${row.updates} updates",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }
      }

      if (daily.topUpdates.isNotEmpty()) {
        Spacer(Modifier.height(4.dp))
        Text("Today’s updates (sample)", style = MaterialTheme.typography.titleSmall)
        daily.topUpdates.take(12).forEach { row ->
          Text(
            "• $row",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }
      }
    }
  }
}

@Composable
private fun StatTile(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(value, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
    }
  }
}

private data class DailyActivity(
  val leadsAdded: Int,
  val clientCalls: Int,
  val clientWhatsapps: Int,
  val paymentsDone: Int,
  val meetingsScheduled: Int,
  val followUps: Int,
  val commercialVisits: Int,
  val mediatorsCollected: Int,
  val rejections: Int,
  val partnerConnects: Int,
  val partnerMeetings: Int,
  val byStaff: List<StaffDailyRow>,
  val topUpdates: List<String>,
)

private data class StaffDailyRow(
  val staff: String,
  val leadsAdded: Int,
  val clientCalls: Int,
  val clientWhatsapps: Int,
  val paymentsDone: Int,
  val meetingsScheduled: Int,
  val followUps: Int,
  val commercialVisits: Int,
  val mediatorsCollected: Int,
  val rejections: Int,
  val updates: Int,
)

private fun computeDailyActivity(
  today: LocalDate,
  leads: List<Lead>,
  mediators: List<Mediator>,
  session: SessionState,
): DailyActivity {
  val todayStr = today.toString()

  val profilesById = session.profiles.associateBy { it.userId }
  val profilesByEmail =
    session.profiles
      .mapNotNull { p -> p.email?.trim()?.takeIf { it.isNotBlank() }?.let { it.lowercase() to p } }
      .toMap()

  fun labelForUserId(userId: String?): String {
    if (userId.isNullOrBlank()) return "Unknown"
    val p = profilesById[userId]
    return p?.fullName?.takeIf { it.isNotBlank() }
      ?: p?.email?.takeIf { it.isNotBlank() }
      ?: userId
  }

  fun labelForEmail(email: String?): String {
    val e = email?.trim().orEmpty().lowercase()
    if (e.isBlank()) return "Unknown"
    val p = profilesByEmail[e]
    return p?.fullName?.takeIf { it.isNotBlank() }
      ?: p?.email?.takeIf { it.isNotBlank() }
      ?: email.orEmpty()
  }

  val createdToday = leads.count { isoToKolkataDate(it.createdAt) == today }
  val createdTodayBy =
    leads
      .filter { isoToKolkataDate(it.createdAt) == today }
      .groupingBy { labelForUserId(it.createdBy) }
      .eachCount()

  fun notesToday(lead: Lead): List<LeadNote> =
    lead.notes.filter { n -> isoToKolkataDate(n.date) == today }

  val notesTodayAll =
    leads.flatMap { l -> notesToday(l).map { n -> l to n } }

  val payments =
    leads.count { l ->
      val payByNote = notesToday(l).any { it.text.contains("[PAYMENT DONE]", ignoreCase = true) }
      val payByDate = isoToKolkataDate(l.loanDetails?.paymentDate) == today
      payByNote || payByDate
    }

  val paymentsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[PAYMENT DONE]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val meetings =
    leads.count { l ->
      notesToday(l).any { it.text.contains("Meeting Scheduled", ignoreCase = true) }
    }

  val meetingsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("Meeting Scheduled", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val calls =
    leads.count { l ->
      notesToday(l).any { it.text.contains("[CALL]", ignoreCase = true) }
    }

  val callsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[CALL]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val whatsapps =
    leads.count { l ->
      notesToday(l).any { it.text.contains("[WHATSAPP]", ignoreCase = true) }
    }

  val whatsappsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[WHATSAPP]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val followUps =
    leads.count { l ->
      notesToday(l).any { it.text.contains("[Follow-Up Update]", ignoreCase = true) }
    }

  val followUpsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[Follow-Up Update]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val commercialVisits =
    leads.count { l ->
      notesToday(l).any { it.text.contains("[Commercial Visit]", ignoreCase = true) }
    }

  val commercialVisitsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[Commercial Visit]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val mediatorsCollected =
    leads.count { l ->
      notesToday(l).any { it.text.contains("[MEDIATOR COLLECTED]", ignoreCase = true) }
    }

  val mediatorsCollectedBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[MEDIATOR COLLECTED]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val rejections =
    leads.count { l ->
      notesToday(l).any { it.text.contains("[REJECTION]", ignoreCase = true) }
    }

  val rejectionsBy =
    notesTodayAll
      .filter { (_, n) -> n.text.contains("[REJECTION]", ignoreCase = true) }
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val connectsAll =
    mediators.flatMap { it.followUpHistory }
      .filter { e -> e.date.take(10) == todayStr }

  val partnerMeetings = connectsAll.count { (it.type ?: "").equals("meeting", ignoreCase = true) }
  val partnerConnects = connectsAll.size

  val updates =
    leads
      .flatMap { l ->
        notesToday(l).map { n -> "${l.name}: ${n.text.replace("\n", " ").trim()}" }
      }
      .take(50)

  val updatesBy =
    notesTodayAll
      .groupingBy { (_, n) -> labelForEmail(n.byUser) }
      .eachCount()

  val staffKeys =
    (
      createdTodayBy.keys +
        callsBy.keys +
        whatsappsBy.keys +
        paymentsBy.keys +
        meetingsBy.keys +
        followUpsBy.keys +
        commercialVisitsBy.keys +
        mediatorsCollectedBy.keys +
        rejectionsBy.keys +
        updatesBy.keys
    )
      .toSet()
      .filter { it.isNotBlank() }

  val byStaff =
    staffKeys
      .sorted()
      .map { staff ->
        StaffDailyRow(
          staff = staff,
          leadsAdded = createdTodayBy[staff] ?: 0,
          clientCalls = callsBy[staff] ?: 0,
          clientWhatsapps = whatsappsBy[staff] ?: 0,
          paymentsDone = paymentsBy[staff] ?: 0,
          meetingsScheduled = meetingsBy[staff] ?: 0,
          followUps = followUpsBy[staff] ?: 0,
          commercialVisits = commercialVisitsBy[staff] ?: 0,
          mediatorsCollected = mediatorsCollectedBy[staff] ?: 0,
          rejections = rejectionsBy[staff] ?: 0,
          updates = updatesBy[staff] ?: 0,
        )
      }

  return DailyActivity(
    leadsAdded = createdToday,
    clientCalls = calls,
    clientWhatsapps = whatsapps,
    paymentsDone = payments,
    meetingsScheduled = meetings,
    followUps = followUps,
    commercialVisits = commercialVisits,
    mediatorsCollected = mediatorsCollected,
    rejections = rejections,
    partnerConnects = partnerConnects,
    partnerMeetings = partnerMeetings,
    byStaff = byStaff,
    topUpdates = updates,
  )
}

private fun eodClearanceSections(today: LocalDate, pending: List<LeadSummary>): List<PdfSection> {
  val lines =
    pending.map { l ->
      val status = (l.status ?: "Unknown").trim().ifBlank { "Unknown" }
      val next = isoToKolkataDate(l.nextFollowUp)?.toString() ?: (l.nextFollowUp?.take(10) ?: "")
      val amt = l.loanAmount ?: 0L
      "${l.name} | $status | Next: $next | ${formatInr(amt)}"
    }

  return listOf(
    PdfSection(
      title = "Summary",
      lines = listOf("Date: $today", "Pending leads: ${pending.size}"),
    ),
    PdfSection(
      title = "Pending leads",
      lines = if (lines.isEmpty()) listOf("None") else lines,
    ),
  )
}

private fun dailyActivitySections(today: LocalDate, daily: DailyActivity): List<PdfSection> {
  val summary =
    listOf(
      "Date: $today",
      "Leads added: ${daily.leadsAdded}",
      "Client calls: ${daily.clientCalls}",
      "Client WhatsApp: ${daily.clientWhatsapps}",
      "Payments done: ${daily.paymentsDone}",
      "Meetings scheduled: ${daily.meetingsScheduled}",
      "Follow-ups updated: ${daily.followUps}",
      "Commercial visits: ${daily.commercialVisits}",
      "Mediator contacts collected: ${daily.mediatorsCollected}",
      "Rejections: ${daily.rejections}",
      "Partner connects: ${daily.partnerConnects} (meetings: ${daily.partnerMeetings})",
    )

  val byStaff =
    if (daily.byStaff.isEmpty()) {
      listOf("No staff-attributed activity found (older notes may not include actor info).")
    } else {
      daily.byStaff.take(60).map { row ->
        "${row.staff} | Leads: ${row.leadsAdded} | Calls: ${row.clientCalls} | WA: ${row.clientWhatsapps} | Payments: ${row.paymentsDone} | Meetings: ${row.meetingsScheduled} | Follow-ups: ${row.followUps} | Visits: ${row.commercialVisits} | Mediators: ${row.mediatorsCollected} | Rejections: ${row.rejections} | Updates: ${row.updates}"
      }
    }

  return listOf(
    PdfSection("Summary", summary),
    PdfSection("By staff", byStaff),
    PdfSection("Sample updates", if (daily.topUpdates.isEmpty()) listOf("No updates recorded.") else daily.topUpdates.take(60)),
  )
}

private fun formatInr(amount: Long): String {
  val fmt = NumberFormat.getNumberInstance(Locale("en", "IN"))
  return "₹${fmt.format(amount)}"
}
