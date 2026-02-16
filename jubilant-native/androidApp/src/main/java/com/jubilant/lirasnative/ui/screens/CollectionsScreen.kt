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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
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
import com.jubilant.lirasnative.ui.util.PREFS_NAME
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import java.time.Instant
import java.time.LocalDate
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
  val today by rememberKolkataDateTicker()
  val ctx = LocalContext.current
  val scope = rememberCoroutineScope()
  val prefs = remember { ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
  val todayKey = remember(today) { today.toString() }
  val actor = remember(session.userId, session.myProfile) { session.myProfile?.email ?: session.userId ?: "unknown" }
  var checkInBusyLeadId by remember { mutableStateOf<String?>(null) }
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
        Toast.makeText(ctx, "Location permission is needed for visit check-in.", Toast.LENGTH_SHORT).show()
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

  fun normalizePhone(raw: String?): String {
    val digits = raw.orEmpty().filter { it.isDigit() }
    if (digits.isBlank()) return ""
    return if (digits.length > 10) digits.takeLast(10) else digits
  }

  fun openDial(phone: String?) {
    val digits = normalizePhone(phone)
    if (digits.isBlank()) return
    runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))) }
      .onFailure { Toast.makeText(ctx, "Couldn’t open dialer.", Toast.LENGTH_SHORT).show() }
  }

  fun checkInNow(lead: LeadSummary) {
    if (!hasLocationPermission) {
      permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
      return
    }
    if (checkInBusyLeadId != null) return
    checkInBusyLeadId = lead.id
    scope.launch {
      val location = resolveBestKnownLocation(ctx)
      if (location == null) {
        checkInBusyLeadId = null
        Toast.makeText(ctx, "Couldn’t fetch location. Try again in a few seconds.", Toast.LENGTH_SHORT).show()
        return@launch
      }
      val lat = String.format(Locale.US, "%.6f", location.latitude)
      val lon = String.format(Locale.US, "%.6f", location.longitude)
      val mapLink = "https://maps.google.com/?q=$lat,$lon"
      val note =
        LeadNote(
          text = "[COLLECTIONS_CHECKIN] $todayKey by $actor at $lat,$lon ($mapLink)",
          date = Instant.now().toString(),
          byUser = actor,
        )

      runCatching {
        val full = leadsRepository.getLead(lead.id)
        val nextNotes = (full.notes + note).takeLast(500)
        leadsRepository.updateLead(lead.id, LeadUpdate(notes = nextNotes))
      }.onSuccess {
        prefs.edit().putBoolean("checkin_${todayKey}_${lead.id}", true).apply()
        onMutated()
        Toast.makeText(ctx, "Check-in saved.", Toast.LENGTH_SHORT).show()
      }.onFailure {
        RetryQueueStore.enqueueLeadAppendNote(ctx.applicationContext, lead.id, note)
        RetrySyncScheduler.enqueueNow(ctx.applicationContext)
        prefs.edit().putBoolean("checkin_${todayKey}_${lead.id}", true).apply()
        Toast.makeText(ctx, "Check-in saved offline — will sync.", Toast.LENGTH_LONG).show()
      }

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
          "Action-focused views. Tap a lead to update or call.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          CollectionsFilter.entries.forEach { t ->
            val count =
              when (t) {
                CollectionsFilter.Today -> dueToday.size
                CollectionsFilter.Overdue -> overdue.size
                CollectionsFilter.Renewals -> renewals.size
                CollectionsFilter.Clearance -> clearance.size
              }
            FilterChip(
              selected = filter == t,
              onClick = { filter = t },
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
            "Leads that have no update today. Clear them to cut loose ends.",
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
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val title =
          when (filter) {
            CollectionsFilter.Today -> "Due today"
            CollectionsFilter.Overdue -> "Overdue"
            CollectionsFilter.Renewals -> "Renewal watch"
            CollectionsFilter.Clearance -> "Pending updates"
          }
        Text(title, style = MaterialTheme.typography.titleMedium)

        if (list.isEmpty()) {
          Text(
            "No items here.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(list.take(120)) { lead ->
              val checkedInToday = prefs.getBoolean("checkin_${todayKey}_${lead.id}", false)
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
                      ).joinToString(" • ")
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
                        "Checked in",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.secondary,
                      )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                      IconButton(onClick = { openDial(lead.phone) }) {
                        Icon(Icons.Outlined.Call, contentDescription = "Call")
                      }
                      IconButton(
                        onClick = { checkInNow(lead) },
                        enabled = checkInBusyLeadId != lead.id,
                      ) {
                        Icon(Icons.Outlined.Place, contentDescription = "Geo check-in")
                      }
                      IconButton(onClick = { onLeadClick(lead.id) }) {
                        Icon(Icons.Outlined.Edit, contentDescription = "Update / Notes")
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
  }
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
