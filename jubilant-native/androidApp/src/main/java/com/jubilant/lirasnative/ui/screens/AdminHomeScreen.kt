package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.AssignmentTurnedIn
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import com.jubilant.lirasnative.di.PdRepository
import com.jubilant.lirasnative.di.UnderwritingRepository
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.ui.components.ActionTile
import com.jubilant.lirasnative.ui.components.SectionHeader
import com.jubilant.lirasnative.ui.theme.Danger500
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.nowKolkataDate
import kotlinx.coroutines.launch

@Composable
fun AdminHomeScreen(
  leads: List<LeadSummary>,
  underwritingRepository: UnderwritingRepository,
  pdRepository: PdRepository,
  ownerModeEnabled: Boolean,
  onToggleOwnerMode: (Boolean) -> Unit,
  onOpenUnderwriting: () -> Unit,
  onOpenPdWorklist: () -> Unit,
  onOpenReports: () -> Unit,
  onOpenAdminTools: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  val today = remember { nowKolkataDate() }

  var underwritingRunsToday by remember { mutableStateOf<Int?>(null) }
  var criticalDoubts by remember { mutableStateOf<Int?>(null) }

  LaunchedEffect(Unit) {
    scope.launch {
      runCatching {
        val apps = underwritingRepository.listRecentApplications(limit = 200)
        val runsToday = apps.count { isoToKolkataDate(it.createdAt)?.isEqual(today) == true }
        val sessions = pdRepository.listSessions(limit = 300)
        val critical =
          if (sessions.isEmpty()) 0 else {
            pdRepository.listQuestionsForSessions(
              pdSessionIds = sessions.map { it.id },
              severity = "Immediate Action",
              statuses = listOf("Pending"),
              limit = 500,
            ).size
          }
        runsToday to critical
      }.onSuccess { (runs, crit) ->
        underwritingRunsToday = runs
        criticalDoubts = crit
      }
    }
  }

  val overdueCount =
    remember(leads) {
      leads.count { l -> isoToKolkataDate(l.nextFollowUp)?.isBefore(today) == true }
    }

  val pendingUpdates =
    remember(leads) {
      leads.count { l -> isoToKolkataDate(l.updatedAt) != today }
    }

  val pipelineCounts =
    remember(leads) {
      leads.groupingBy { (it.status ?: "Unknown").trim().ifBlank { "Unknown" } }.eachCount()
    }

  val staffLoads =
    remember(leads) {
      leads
        .groupBy { (it.assignedStaff ?: "").trim().ifBlank { "Unassigned" } }
        .mapValues { (_, items) -> items.size }
        .toList()
        .sortedByDescending { it.second }
        .take(8)
    }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    SectionHeader(
      title = "Admin home",
      subtitle = "Pipeline, underwriting queue, staff load, and critical alerts.",
      action = {
        FilterChip(
          selected = ownerModeEnabled,
          onClick = { onToggleOwnerMode(!ownerModeEnabled) },
          label = { Text(if (ownerModeEnabled) "Owner view" else "Admin view") },
          colors =
            FilterChipDefaults.filterChipColors(
              containerColor = MaterialTheme.colorScheme.surfaceVariant,
              selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
              selectedLabelColor = MaterialTheme.colorScheme.onBackground,
            ),
          border =
            FilterChipDefaults.filterChipBorder(
              enabled = true,
              selected = ownerModeEnabled,
              borderColor = MaterialTheme.colorScheme.outlineVariant,
              selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
            ),
        )
      },
    )

    ActionTile(
      label = "Underwriting",
      subtitle = "Runs today: ${underwritingRunsToday ?: "—"}",
      icon = { Icon(Icons.Outlined.Gavel, contentDescription = null) },
      onClick = onOpenUnderwriting,
    )

    ActionTile(
      label = "PD worklist",
      subtitle = "Immediate doubts: ${criticalDoubts ?: "—"}",
      icon = { Icon(Icons.Outlined.AssignmentTurnedIn, contentDescription = null) },
      onClick = onOpenPdWorklist,
    )

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      ActionTile(
        label = "Reports",
        subtitle = "Exports and summaries",
        icon = { Icon(Icons.Outlined.Description, contentDescription = null) },
        onClick = onOpenReports,
        modifier = Modifier.weight(1f),
      )
      ActionTile(
        label = "Admin tools",
        subtitle = "Staff & access controls",
        icon = { Icon(Icons.Outlined.AdminPanelSettings, contentDescription = null) },
        onClick = onOpenAdminTools,
        modifier = Modifier.weight(1f),
      )
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Alerts", style = MaterialTheme.typography.titleMedium)
        Text(
          "Overdue follow-ups: $overdueCount • Pending updates today: $pendingUpdates",
          style = MaterialTheme.typography.bodySmall,
          color = if (overdueCount > 0) Danger500 else MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Pipeline snapshot", style = MaterialTheme.typography.titleMedium)
        val keys =
          listOf(
            "New",
            "Meeting Scheduled",
            "Follow-Up Required",
            "Partner Follow-Up",
            "Interest Rate Issue",
            "Payment Done",
            "Deal Closed",
          )
        keys.forEach { k ->
          val v = pipelineCounts[k] ?: 0
          Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(k, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
            Text(v.toString(), style = MaterialTheme.typography.bodyMedium)
          }
        }
      }
    }

    if (staffLoads.isNotEmpty()) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Staff load (assigned leads)", style = MaterialTheme.typography.titleMedium)
          staffLoads.forEach { (staff, count) ->
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
              Text(staff, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
              Spacer(Modifier.width(10.dp))
              Text(count.toString(), style = MaterialTheme.typography.bodyMedium)
            }
          }
        }
      }
    }
  }
}

