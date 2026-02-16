package com.jubilant.lirasnative.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.PREFS_NAME
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlinx.coroutines.launch

private enum class CollectionsFilter(
  val label: String,
) {
  Today("Today"),
  Overdue("Overdue"),
  Renewals("Renewals"),
  Clearance("Clearance"),
}

private enum class CollectionsViewMode(
  val label: String,
) {
  Queue("Queue"),
  Route("Route"),
  Timeline("Timeline"),
  Scorecard("Scorecard"),
  Heatmap("Heatmap"),
}

private data class CollectionsCluster(
  val key: String,
  val leads: List<LeadSummary>,
)

private data class VisitEvent(
  val atMs: Long,
  val leadId: String,
  val leadName: String,
  val eventType: String,
  val locationLabel: String,
  val travelMinutes: Long?,
)

@Composable
fun CollectionsTab(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  session: SessionState,
  onLeadClick: (id: String) -> Unit,
  onOpenEod: () -> Unit,
  onMutated: () -> Unit,
  modifier: Modifier = Modifier,
) {
  var filter by rememberSaveable { mutableStateOf(CollectionsFilter.Today) }
  var viewMode by rememberSaveable { mutableStateOf(CollectionsViewMode.Queue) }
  var bulkMode by rememberSaveable { mutableStateOf(false) }
  val today by rememberKolkataDateTicker()
  val ctx = LocalContext.current
  val scope = rememberCoroutineScope()
  val prefs = remember { ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
  val todayKey = remember(today) { today.toString() }
  val actor = remember(session.userId, session.myProfile) { session.myProfile?.email ?: session.userId ?: "unknown" }
  var checkInBusyLeadId by remember { mutableStateOf<String?>(null) }
  var selectedLeadIds by remember { mutableStateOf(setOf<String>()) }
  var timelineVersion by remember { mutableIntStateOf(0) }
  var routeStartedAtMs by remember(todayKey) { mutableLongStateOf(prefs.getLong(routeStartKey(todayKey), 0L)) }

  var hasLocationPermission by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED ||
          ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED,
      )
    }

  val permissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      hasLocationPermission = granted
      if (!granted) {
        Toast.makeText(ctx, "Location permission is needed for collections route logs.", Toast.LENGTH_SHORT).show()
      }
    }

  val closedStatuses = remember { setOf("Payment Done", "Deal Closed") }
  val rejectedStatuses = remember { setOf("Not Eligible", "Not Reliable", "Lost to Competitor") }

  val actionable =
    remember(leads) {
      leads.filterNot { (it.status ?: "").trim() in closedStatuses || (it.status ?: "").trim() in rejectedStatuses }
    }

  val dueToday by remember(actionable, today) {
    derivedStateOf { actionable.filter { isoToKolkataDate(it.nextFollowUp)?.isEqual(today) == true } }
  }

  val overdue by remember(actionable, today) {
    derivedStateOf { actionable.filter { isoToKolkataDate(it.nextFollowUp)?.isBefore(today) == true } }
  }

  val renewals by remember(leads, today) {
    derivedStateOf {
      leads.filter { (it.status ?: "").trim() == "Payment Done" }
        .filter { l ->
          val d = isoToKolkataDate(l.nextFollowUp) ?: return@filter false
          val days = ChronoUnit.DAYS.between(today, d)
          days in 0..30
        }
    }
  }

  val clearance by remember(actionable, today) {
    derivedStateOf { actionable.filter { isoToKolkataDate(it.updatedAt) != today } }
  }

  val list =
    when (filter) {
      CollectionsFilter.Today -> dueToday
      CollectionsFilter.Overdue -> overdue
      CollectionsFilter.Renewals -> renewals
      CollectionsFilter.Clearance -> clearance
    }

  val routeClusters = remember(list) {
    list
      .groupBy { localityClusterKey(it.location) }
      .map { (key, grouped) -> CollectionsCluster(key = key, leads = grouped) }
      .sortedByDescending { it.leads.size }
  }

  val heatmapClusters = remember(overdue) {
    overdue
      .groupBy { localityClusterKey(it.location) }
      .map { (key, grouped) -> CollectionsCluster(key = key, leads = grouped) }
      .sortedByDescending { it.leads.size }
  }

  val timelineEvents =
    remember(todayKey, timelineVersion) {
      loadVisitEvents(prefs, todayKey)
    }

  val calledCount = remember(list, todayKey) { list.count { prefs.getBoolean(callDoneKey(todayKey, it.id), false) } }
  val checkedInCount = remember(list, todayKey) { list.count { prefs.getBoolean(checkInDoneKey(todayKey, it.id), false) } }
  val checkedOutCount = remember(list, todayKey) { list.count { prefs.getBoolean(checkOutDoneKey(todayKey, it.id), false) } }
  val pendingVisitCount = remember(list, checkedOutCount) { (list.size - checkedOutCount).coerceAtLeast(0) }

  fun normalizePhone(raw: String?): String {
    val digits = raw.orEmpty().filter { it.isDigit() }
    if (digits.isBlank()) return ""
    return if (digits.length > 10) digits.takeLast(10) else digits
  }

  fun appendTimelineEvent(event: VisitEvent) {
    saveVisitEvent(prefs, todayKey, event)
    timelineVersion += 1
  }

  fun openDial(lead: LeadSummary) {
    val digits = normalizePhone(lead.phone)
    if (digits.isBlank()) return
    runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))) }
      .onSuccess {
        prefs.edit().putBoolean(callDoneKey(todayKey, lead.id), true).apply()
        appendTimelineEvent(
          VisitEvent(
            atMs = System.currentTimeMillis(),
            leadId = lead.id,
            leadName = lead.name,
            eventType = "CALL",
            locationLabel = lead.location.orEmpty(),
            travelMinutes = null,
          ),
        )
      }
      .onFailure { Toast.makeText(ctx, "Couldn’t open dialer.", Toast.LENGTH_SHORT).show() }
  }

  fun saveVisitNote(
    leadId: String,
    note: LeadNote,
    onSuccess: () -> Unit,
    onFailure: () -> Unit,
  ) {
    scope.launch {
      runCatching {
        val full = leadsRepository.getLead(leadId)
        val nextNotes = (full.notes + note).takeLast(500)
        leadsRepository.updateLead(leadId, LeadUpdate(notes = nextNotes))
      }.onSuccess {
        onSuccess()
        onMutated()
      }.onFailure {
        RetryQueueStore.enqueueLeadAppendNote(ctx.applicationContext, leadId, note)
        RetrySyncScheduler.enqueueNow(ctx.applicationContext)
        onFailure()
      }
      checkInBusyLeadId = null
    }
  }

  fun checkInNow(lead: LeadSummary) {
    if (!hasLocationPermission) {
      permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
      return
    }
    if (checkInBusyLeadId != null) return
    checkInBusyLeadId = lead.id

    val location = resolveBestKnownLocation(ctx)
    if (location == null) {
      checkInBusyLeadId = null
      Toast.makeText(ctx, "Couldn’t fetch location. Try again.", Toast.LENGTH_SHORT).show()
      return
    }

    val lat = String.format(Locale.US, "%.6f", location.latitude)
    val lon = String.format(Locale.US, "%.6f", location.longitude)
    val mapLink = "https://maps.google.com/?q=$lat,$lon"
    val nowMs = System.currentTimeMillis()

    val note =
      LeadNote(
        text = "[COLLECTIONS_CHECKIN] $todayKey by $actor at $lat,$lon ($mapLink)",
        date = Instant.ofEpochMilli(nowMs).toString(),
        byUser = actor,
      )

    saveVisitNote(
      leadId = lead.id,
      note = note,
      onSuccess = {
        prefs.edit()
          .putBoolean(checkInDoneKey(todayKey, lead.id), true)
          .putLong(checkInAtKey(todayKey, lead.id), nowMs)
          .apply()
        appendTimelineEvent(
          VisitEvent(
            atMs = nowMs,
            leadId = lead.id,
            leadName = lead.name,
            eventType = "CHECK_IN",
            locationLabel = "$lat,$lon",
            travelMinutes = null,
          ),
        )
        Toast.makeText(ctx, "Check-in saved.", Toast.LENGTH_SHORT).show()
      },
      onFailure = {
        prefs.edit()
          .putBoolean(checkInDoneKey(todayKey, lead.id), true)
          .putLong(checkInAtKey(todayKey, lead.id), nowMs)
          .apply()
        appendTimelineEvent(
          VisitEvent(
            atMs = nowMs,
            leadId = lead.id,
            leadName = lead.name,
            eventType = "CHECK_IN",
            locationLabel = "$lat,$lon",
            travelMinutes = null,
          ),
        )
        Toast.makeText(ctx, "Check-in saved offline. Sync queued.", Toast.LENGTH_LONG).show()
      },
    )
  }

  fun checkOutNow(lead: LeadSummary) {
    if (!hasLocationPermission) {
      permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
      return
    }
    if (checkInBusyLeadId != null) return
    checkInBusyLeadId = lead.id

    val location = resolveBestKnownLocation(ctx)
    if (location == null) {
      checkInBusyLeadId = null
      Toast.makeText(ctx, "Couldn’t fetch location. Try again.", Toast.LENGTH_SHORT).show()
      return
    }

    val lat = String.format(Locale.US, "%.6f", location.latitude)
    val lon = String.format(Locale.US, "%.6f", location.longitude)
    val mapLink = "https://maps.google.com/?q=$lat,$lon"
    val nowMs = System.currentTimeMillis()
    val checkInMs = prefs.getLong(checkInAtKey(todayKey, lead.id), 0L)
    val travelMinutes = if (checkInMs > 0L) ((nowMs - checkInMs) / 60_000L).coerceAtLeast(0L) else null

    val note =
      LeadNote(
        text =
          buildString {
            append("[COLLECTIONS_CHECKOUT] $todayKey by $actor at $lat,$lon ($mapLink)")
            if (travelMinutes != null) append(" travel_min=$travelMinutes")
          },
        date = Instant.ofEpochMilli(nowMs).toString(),
        byUser = actor,
      )

    saveVisitNote(
      leadId = lead.id,
      note = note,
      onSuccess = {
        prefs.edit().putBoolean(checkOutDoneKey(todayKey, lead.id), true).apply()
        appendTimelineEvent(
          VisitEvent(
            atMs = nowMs,
            leadId = lead.id,
            leadName = lead.name,
            eventType = "CHECK_OUT",
            locationLabel = "$lat,$lon",
            travelMinutes = travelMinutes,
          ),
        )
        Toast.makeText(ctx, "Check-out saved.", Toast.LENGTH_SHORT).show()
      },
      onFailure = {
        prefs.edit().putBoolean(checkOutDoneKey(todayKey, lead.id), true).apply()
        appendTimelineEvent(
          VisitEvent(
            atMs = nowMs,
            leadId = lead.id,
            leadName = lead.name,
            eventType = "CHECK_OUT",
            locationLabel = "$lat,$lon",
            travelMinutes = travelMinutes,
          ),
        )
        Toast.makeText(ctx, "Check-out saved offline. Sync queued.", Toast.LENGTH_LONG).show()
      },
    )
  }

  fun openClusterRoute(clusterLeads: List<LeadSummary>) {
    val addresses =
      clusterLeads
        .mapNotNull { it.location?.trim()?.takeIf { v -> v.isNotBlank() } }
        .distinct()
        .take(9)

    if (addresses.isEmpty()) {
      Toast.makeText(ctx, "No address data for this cluster.", Toast.LENGTH_SHORT).show()
      return
    }

    val url =
      if (addresses.size == 1) {
        "https://www.google.com/maps/search/?api=1&query=${Uri.encode(addresses.first())}"
      } else {
        val destination = Uri.encode(addresses.last())
        val waypoints = addresses.dropLast(1).joinToString("%7C") { Uri.encode(it) }
        "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=$destination&waypoints=$waypoints"
      }

    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
      .onFailure { Toast.makeText(ctx, "Couldn’t open maps route.", Toast.LENGTH_SHORT).show() }
  }

  fun runBulkMarkDone() {
    if (selectedLeadIds.isEmpty() || checkInBusyLeadId != null) return
    checkInBusyLeadId = "bulk"
    scope.launch {
      var success = 0
      var queued = 0
      selectedLeadIds.forEach { id ->
        val patch = LeadUpdate(status = "Deal Closed")
        runCatching { leadsRepository.updateLead(id, patch) }
          .onSuccess { success += 1 }
          .onFailure {
            RetryQueueStore.enqueueLeadUpdate(ctx.applicationContext, id, patch)
            queued += 1
          }
      }
      if (queued > 0) RetrySyncScheduler.enqueueNow(ctx.applicationContext)
      if (success > 0) onMutated()
      Toast.makeText(ctx, "Bulk update: $success done, $queued queued.", Toast.LENGTH_LONG).show()
      selectedLeadIds = emptySet()
      checkInBusyLeadId = null
    }
  }

  fun runBulkSnoozeOneDay() {
    if (selectedLeadIds.isEmpty() || checkInBusyLeadId != null) return
    checkInBusyLeadId = "bulk"
    scope.launch {
      val nextIso = today.plusDays(1).atTime(LocalTime.of(10, 0)).atZone(KOLKATA_ZONE).toInstant().toString()
      var success = 0
      var queued = 0
      selectedLeadIds.forEach { id ->
        val patch = LeadUpdate(nextFollowUp = nextIso)
        runCatching { leadsRepository.updateLead(id, patch) }
          .onSuccess { success += 1 }
          .onFailure {
            RetryQueueStore.enqueueLeadUpdate(ctx.applicationContext, id, patch)
            queued += 1
          }
      }
      if (queued > 0) RetrySyncScheduler.enqueueNow(ctx.applicationContext)
      if (success > 0) onMutated()
      Toast.makeText(ctx, "Bulk snooze: $success updated, $queued queued.", Toast.LENGTH_LONG).show()
      selectedLeadIds = emptySet()
      checkInBusyLeadId = null
    }
  }

  Column(modifier = modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Collections", style = MaterialTheme.typography.titleMedium)
        Text(
          "Queue + route planner + visit timeline + area heatmap.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          items(CollectionsFilter.entries) { t ->
            val count =
              when (t) {
                CollectionsFilter.Today -> dueToday.size
                CollectionsFilter.Overdue -> overdue.size
                CollectionsFilter.Renewals -> renewals.size
                CollectionsFilter.Clearance -> clearance.size
              }
            FilterChip(
              selected = filter == t,
              onClick = {
                filter = t
                selectedLeadIds = emptySet()
              },
              label = { Text("${t.label} ($count)") },
              colors =
                FilterChipDefaults.filterChipColors(
                  containerColor = MaterialTheme.colorScheme.surfaceVariant,
                  selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                  selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = filter == t,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
          items(CollectionsViewMode.entries) { mode ->
            FilterChip(
              selected = viewMode == mode,
              onClick = { viewMode = mode },
              label = { Text(mode.label) },
              colors =
                FilterChipDefaults.filterChipColors(
                  containerColor = MaterialTheme.colorScheme.surfaceVariant,
                  selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                  selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = viewMode == mode,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }
      }
    }

    if (filter == CollectionsFilter.Clearance) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.10f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.28f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("End of day clearance", style = MaterialTheme.typography.titleMedium)
          Text(
            "Leads with no update today. Clear them from EOD.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Button(
            onClick = onOpenEod,
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text("Open EOD")
          }
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth().weight(1f, fill = true),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      when (viewMode) {
        CollectionsViewMode.Queue -> {
          Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val title =
              when (filter) {
                CollectionsFilter.Today -> "Due today"
                CollectionsFilter.Overdue -> "Overdue"
                CollectionsFilter.Renewals -> "Renewal watch"
                CollectionsFilter.Clearance -> "Pending updates"
              }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
              Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
              OutlinedButton(
                onClick = {
                  bulkMode = !bulkMode
                  selectedLeadIds = emptySet()
                },
              ) {
                Text(if (bulkMode) "Close bulk" else "Bulk mode")
              }
            }

            if (bulkMode && selectedLeadIds.isNotEmpty()) {
              Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = { runBulkMarkDone() }, modifier = Modifier.weight(1f)) {
                  Text("Mark done (${selectedLeadIds.size})")
                }
                OutlinedButton(onClick = { runBulkSnoozeOneDay() }, modifier = Modifier.weight(1f)) {
                  Text("Snooze +1d")
                }
              }
            }

            if (list.isEmpty()) {
              Text(
                "No items here.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            } else {
              LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(list.take(120), key = { it.id }) { lead ->
                  val checkedInToday = prefs.getBoolean(checkInDoneKey(todayKey, lead.id), false)
                  val checkedOutToday = prefs.getBoolean(checkOutDoneKey(todayKey, lead.id), false)
                  val selected = lead.id in selectedLeadIds

                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Row(
                      modifier = Modifier.fillMaxWidth().padding(12.dp),
                      horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(lead.name, style = MaterialTheme.typography.titleMedium)
                        val sub =
                          listOfNotNull(
                            lead.company?.takeIf { it.isNotBlank() },
                            lead.location?.takeIf { it.isNotBlank() },
                          ).joinToString(" - ")
                        if (sub.isNotBlank()) {
                          Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                        }
                        val next = isoToKolkataDate(lead.nextFollowUp)
                        if (next != null) {
                          val days = ChronoUnit.DAYS.between(today, next)
                          val hint =
                            when {
                              days < 0 -> "Overdue by ${-days} day(s)"
                              days == 0L -> "Due today"
                              else -> "Due in $days day(s)"
                            }
                          Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                      }

                      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        LeadStatusPill(status = lead.status)
                        if (checkedInToday) {
                          Text(
                            if (checkedOutToday) "Visit done" else "Checked in",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary,
                          )
                        }
                        if (bulkMode) {
                          FilterChip(
                            selected = selected,
                            onClick = {
                              selectedLeadIds =
                                if (selected) selectedLeadIds - lead.id else selectedLeadIds + lead.id
                            },
                            label = { Text(if (selected) "Selected" else "Select") },
                          )
                        } else {
                          Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            IconButton(onClick = { openDial(lead) }) {
                              Icon(Icons.Outlined.Call, contentDescription = "Call")
                            }
                            IconButton(
                              onClick = { checkInNow(lead) },
                              enabled = checkInBusyLeadId != lead.id,
                            ) {
                              Icon(Icons.Outlined.Place, contentDescription = "Geo check-in")
                            }
                            IconButton(
                              onClick = { checkOutNow(lead) },
                              enabled = checkedInToday && checkInBusyLeadId != lead.id,
                            ) {
                              Icon(Icons.Outlined.CheckCircle, contentDescription = "Geo check-out")
                            }
                            IconButton(onClick = { onLeadClick(lead.id) }) {
                              Icon(Icons.Outlined.Edit, contentDescription = "Update / Notes")
                            }
                          }
                        }
                      }
                    }
                  }
                }
                if (list.size > 120) {
                  item {
                    Spacer(Modifier.height(2.dp))
                    Text(
                      "Showing first 120 items.",
                      style = MaterialTheme.typography.bodySmall,
                      color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                  }
                }
              }
            }
          }
        }

        CollectionsViewMode.Route -> {
          Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Route planner", style = MaterialTheme.typography.titleMedium)
            val routeStartedLabel = formatEventTime(routeStartedAtMs)
            Text(
              if (routeStartedAtMs > 0L) "Route started: $routeStartedLabel" else "Route not started for today.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
              Button(
                onClick = {
                  routeStartedAtMs = System.currentTimeMillis()
                  prefs.edit().putLong(routeStartKey(todayKey), routeStartedAtMs).apply()
                },
                modifier = Modifier.weight(1f),
              ) {
                Text(if (routeStartedAtMs > 0L) "Restart route" else "Start route")
              }
              OutlinedButton(
                onClick = {
                  routeStartedAtMs = 0L
                  prefs.edit().putLong(routeStartKey(todayKey), 0L).apply()
                },
                modifier = Modifier.weight(1f),
                enabled = routeStartedAtMs > 0L,
              ) {
                Text("Stop route")
              }
            }

            if (routeClusters.isEmpty()) {
              Text(
                "No route items for this filter.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            } else {
              LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                itemsIndexed(routeClusters, key = { _, c -> c.key }) { idx, cluster ->
                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                      Text("Stop ${idx + 1}: ${cluster.key}", style = MaterialTheme.typography.titleSmall)
                      Text(
                        "${cluster.leads.size} lead(s) in this cluster",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                      )
                      Text(
                        cluster.leads.take(3).joinToString(" • ") { it.name },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                      )
                      OutlinedButton(onClick = { openClusterRoute(cluster.leads) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Open route in maps")
                      }
                    }
                  }
                }
              }
            }
          }
        }

        CollectionsViewMode.Timeline -> {
          Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Visit timeline", style = MaterialTheme.typography.titleMedium)
            Text(
              "Check-in, check-out and call events for today.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (timelineEvents.isEmpty()) {
              Text(
                "No visit events logged for today.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            } else {
              LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(timelineEvents, key = { "${it.atMs}_${it.leadId}_${it.eventType}" }) { event ->
                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                      Text(event.leadName, style = MaterialTheme.typography.titleSmall)
                      Text(
                        "${eventTypeLabel(event.eventType)} • ${formatEventTime(event.atMs)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                      )
                      if (event.locationLabel.isNotBlank()) {
                        Text(
                          event.locationLabel,
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                      }
                      if (event.travelMinutes != null) {
                        Text(
                          "Travel/visit duration: ${event.travelMinutes} min",
                          style = MaterialTheme.typography.labelSmall,
                          color = MaterialTheme.colorScheme.secondary,
                        )
                      }
                    }
                  }
                }
              }
            }
          }
        }

        CollectionsViewMode.Scorecard -> {
          Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Workday scorecard", style = MaterialTheme.typography.titleMedium)
            Text(
              "Live productivity from this device for today's collections flow.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
              ScoreMetricCard(label = "Queue", value = list.size.toString(), modifier = Modifier.weight(1f))
              ScoreMetricCard(label = "Calls", value = calledCount.toString(), modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
              ScoreMetricCard(label = "Check-in", value = checkedInCount.toString(), modifier = Modifier.weight(1f))
              ScoreMetricCard(label = "Visit done", value = checkedOutCount.toString(), modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
              ScoreMetricCard(label = "Pending", value = pendingVisitCount.toString(), modifier = Modifier.weight(1f))
              val completion = if (list.isEmpty()) 0 else (checkedOutCount * 100 / list.size)
              ScoreMetricCard(label = "Completion", value = "$completion%", modifier = Modifier.weight(1f))
            }

            val routeLabel = if (routeStartedAtMs > 0L) formatEventTime(routeStartedAtMs) else "Not started"
            Text(
              "Attendance / route start: $routeLabel",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }

        CollectionsViewMode.Heatmap -> {
          Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Area heatmap", style = MaterialTheme.typography.titleMedium)
            Text(
              "Overdue density by pincode/locality (from lead location text).",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (heatmapClusters.isEmpty()) {
              Text(
                "No overdue locations right now.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            } else {
              LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(heatmapClusters, key = { it.key }) { cluster ->
                  val severity =
                    when {
                      cluster.leads.size >= 8 -> "High"
                      cluster.leads.size >= 4 -> "Medium"
                      else -> "Low"
                    }
                  val severityColor =
                    when (severity) {
                      "High" -> MaterialTheme.colorScheme.error
                      "Medium" -> MaterialTheme.colorScheme.tertiary
                      else -> MaterialTheme.colorScheme.secondary
                    }

                  Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                  ) {
                    Row(
                      modifier = Modifier.fillMaxWidth().padding(12.dp),
                      horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(cluster.key, style = MaterialTheme.typography.titleSmall)
                        Text(
                          "${cluster.leads.size} overdue lead(s)",
                          style = MaterialTheme.typography.bodySmall,
                          color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                      }
                      Text(
                        severity,
                        style = MaterialTheme.typography.titleSmall,
                        color = severityColor,
                      )
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun ScoreMetricCard(
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
    Column(
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(value, style = MaterialTheme.typography.titleMedium)
      Text(
        label,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

private fun localityClusterKey(location: String?): String {
  val cleaned = location?.trim().orEmpty()
  if (cleaned.isBlank()) return "Unknown area"

  val pin = PINCODE_RE.find(cleaned)?.value
  if (!pin.isNullOrBlank()) return "PIN $pin"

  val first = cleaned.split(",", "-", "/", "|").firstOrNull()?.trim().orEmpty()
  return if (first.isBlank()) cleaned.take(24) else first
}

private fun eventTypeLabel(raw: String): String =
  when (raw) {
    "CHECK_IN" -> "Check-in"
    "CHECK_OUT" -> "Check-out"
    "CALL" -> "Call"
    else -> raw
  }

private fun routeStartKey(todayKey: String): String = "collections_route_start_$todayKey"

private fun checkInDoneKey(todayKey: String, leadId: String): String = "checkin_${todayKey}_$leadId"

private fun checkOutDoneKey(todayKey: String, leadId: String): String = "checkout_${todayKey}_$leadId"

private fun checkInAtKey(todayKey: String, leadId: String): String = "checkin_at_${todayKey}_$leadId"

private fun callDoneKey(todayKey: String, leadId: String): String = "call_${todayKey}_$leadId"

private fun visitTimelineKey(todayKey: String): String = "collections_timeline_$todayKey"

private fun saveVisitEvent(
  prefs: android.content.SharedPreferences,
  todayKey: String,
  event: VisitEvent,
) {
  val safeLeadName = event.leadName.replace('|', ' ').replace('\n', ' ').trim()
  val safeLocation = event.locationLabel.replace('|', ' ').replace('\n', ' ').trim()
  val encoded =
    listOf(
      event.atMs.toString(),
      event.leadId,
      safeLeadName,
      event.eventType,
      safeLocation,
      event.travelMinutes?.toString().orEmpty(),
    ).joinToString("|")

  val key = visitTimelineKey(todayKey)
  val current = prefs.getString(key, "").orEmpty()
  val next = if (current.isBlank()) encoded else "$current\n$encoded"
  prefs.edit().putString(key, next.takeLast(120_000)).apply()
}

private fun loadVisitEvents(
  prefs: android.content.SharedPreferences,
  todayKey: String,
): List<VisitEvent> {
  val raw = prefs.getString(visitTimelineKey(todayKey), "").orEmpty()
  if (raw.isBlank()) return emptyList()

  return raw
    .lineSequence()
    .mapNotNull { line ->
      val parts = line.split("|")
      if (parts.size < 6) return@mapNotNull null
      val at = parts[0].toLongOrNull() ?: return@mapNotNull null
      val travel = parts[5].toLongOrNull()
      VisitEvent(
        atMs = at,
        leadId = parts[1],
        leadName = parts[2],
        eventType = parts[3],
        locationLabel = parts[4],
        travelMinutes = travel,
      )
    }
    .sortedByDescending { it.atMs }
    .toList()
}

private fun formatEventTime(atMs: Long): String {
  if (atMs <= 0L) return "--"
  return runCatching {
    Instant.ofEpochMilli(atMs).atZone(KOLKATA_ZONE).format(EVENT_TIME_FORMAT)
  }.getOrDefault("--")
}

private fun resolveBestKnownLocation(context: Context): Location? {
  val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
  val providers =
    manager.getProviders(true)
      .filter { it == LocationManager.GPS_PROVIDER || it == LocationManager.NETWORK_PROVIDER || it == LocationManager.PASSIVE_PROVIDER }

  val candidates =
    providers.mapNotNull { provider ->
      runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
    }

  return candidates.maxByOrNull { it.time }
}

private val EVENT_TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM, hh:mm a")
private val PINCODE_RE = Regex("\\b\\d{6}\\b")
