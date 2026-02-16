package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.PdRepository
import com.jubilant.lirasnative.di.UnderwritingRepository
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.PdGeneratedQuestionRow
import com.jubilant.lirasnative.shared.supabase.PdSessionRow
import com.jubilant.lirasnative.shared.supabase.UnderwritingApplicationListItem
import com.jubilant.lirasnative.ui.components.SectionHeader
import com.jubilant.lirasnative.ui.theme.Danger500
import kotlinx.coroutines.launch

enum class PdWorklistTab(val label: String) {
  PdPending("PD pending"),
  CriticalDoubts("Immediate doubts"),
}

@Composable
fun PdWorklistScreen(
  leads: List<LeadSummary>,
  underwritingRepository: UnderwritingRepository,
  pdRepository: PdRepository,
  initialTab: PdWorklistTab = PdWorklistTab.PdPending,
  onOpenPd: (applicationId: String, leadId: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  var tab by rememberSaveable { mutableStateOf(initialTab) }

  var loading by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }

  var apps by remember { mutableStateOf<List<UnderwritingApplicationListItem>>(emptyList()) }
  var sessions by remember { mutableStateOf<List<PdSessionRow>>(emptyList()) }
  var criticalQuestions by remember { mutableStateOf<List<PdGeneratedQuestionRow>>(emptyList()) }

  val leadsById = remember(leads) { leads.associateBy { it.id } }

  fun refresh() {
    scope.launch {
      loading = true
      error = null
      runCatching {
        val recentApps = underwritingRepository.listRecentApplications(limit = 250).filter { !it.leadId.isNullOrBlank() }
        val sess = pdRepository.listSessions(limit = 500)
        val qs =
          if (sess.isEmpty()) emptyList()
          else pdRepository.listQuestionsForSessions(
            pdSessionIds = sess.map { it.id },
            severity = "Immediate Action",
            statuses = listOf("Pending"),
            limit = 500,
          )
        Triple(recentApps, sess, qs)
      }
        .onSuccess { (a, s, q) ->
          apps = a
          sessions = s
          criticalQuestions = q
        }
        .onFailure { ex -> error = ex.message ?: "Couldn’t load PD worklist." }
      loading = false
    }
  }

  LaunchedEffect(Unit) { refresh() }

  val sessionByAppId = remember(sessions) { sessions.associateBy { it.applicationId } }

  val pdPending =
    remember(apps, sessionByAppId) {
      apps.filter { app ->
        val s = sessionByAppId[app.id]
        s == null || !s.status.equals("completed", ignoreCase = true)
      }
    }

  val criticalBySession =
    remember(criticalQuestions) {
      criticalQuestions.groupBy { it.pdSessionId }
    }

  val criticalSessions =
    remember(criticalBySession, sessions, apps) {
      val appById = apps.associateBy { it.id }
      sessions.mapNotNull { s ->
        val qs = criticalBySession[s.id].orEmpty()
        if (qs.isEmpty()) return@mapNotNull null
        val leadId = appById[s.applicationId]?.leadId ?: return@mapNotNull null
        CriticalDoubtGroup(
          pdSessionId = s.id,
          applicationId = s.applicationId,
          leadId = leadId,
          leadName = leadsById[leadId]?.name ?: "Lead $leadId",
          count = qs.size,
        )
      }.sortedByDescending { it.count }
    }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    SectionHeader(
      title = "PD worklist",
      subtitle = "Pending PD sessions and critical doubts (Immediate Action).",
      action = {
        TextButton(onClick = { refresh() }, enabled = !loading) { Text("Refresh") }
      },
    )

    if (error != null) {
      Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(
          error!!,
          modifier = Modifier.padding(12.dp),
          color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodyMedium,
        )
      }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      PdWorklistTab.entries.forEach { t ->
        FilterChip(
          selected = tab == t,
          onClick = { tab = t },
          label = { Text(t.label) },
          leadingIcon =
            if (t == PdWorklistTab.PdPending) {
              { Icon(Icons.Outlined.FactCheck, contentDescription = null) }
            } else {
              { Icon(Icons.Outlined.WarningAmber, contentDescription = null) }
            },
          colors =
            FilterChipDefaults.filterChipColors(
              containerColor = MaterialTheme.colorScheme.surfaceVariant,
              selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
              selectedLabelColor = MaterialTheme.colorScheme.onBackground,
              selectedLeadingIconColor = MaterialTheme.colorScheme.onBackground,
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

    if (loading && apps.isEmpty() && sessions.isEmpty()) {
      Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.Center) {
        CircularProgressIndicator()
      }
      return
    }

    Card(
      modifier = Modifier.fillMaxWidth().weight(1f, fill = true),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val listLabel =
          when (tab) {
            PdWorklistTab.PdPending -> "PD pending (${pdPending.size})"
            PdWorklistTab.CriticalDoubts -> "Immediate doubts (${criticalSessions.size})"
          }
        Text(listLabel, style = MaterialTheme.typography.titleMedium)

        val isEmpty =
          when (tab) {
            PdWorklistTab.PdPending -> pdPending.isEmpty()
            PdWorklistTab.CriticalDoubts -> criticalSessions.isEmpty()
          }

        if (isEmpty) {
          Text(
            "Nothing pending right now.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when (tab) {
              PdWorklistTab.PdPending -> {
                items(pdPending.take(200)) { app ->
                  val leadId = app.leadId.orEmpty()
                  val lead = leadsById[leadId]
                  WorklistRow(
                    title = lead?.name ?: "Lead $leadId",
                    subtitle = lead?.company?.takeIf { it.isNotBlank() } ?: "Underwriting run: ${app.bankName.ifBlank { "Bank" }}",
                    meta = "Application: ${app.id.take(8)}",
                    onOpen = { onOpenPd(app.id, leadId) },
                  )
                }
              }

              PdWorklistTab.CriticalDoubts -> {
                items(criticalSessions.take(200)) { g ->
                  WorklistRow(
                    title = g.leadName,
                    subtitle = "Immediate Action doubts: ${g.count}",
                    meta = "Application: ${g.applicationId.take(8)}",
                    metaColor = Danger500,
                    onOpen = { onOpenPd(g.applicationId, g.leadId) },
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

private data class CriticalDoubtGroup(
  val pdSessionId: String,
  val applicationId: String,
  val leadId: String,
  val leadName: String,
  val count: Int,
)

@Composable
private fun WorklistRow(
  title: String,
  subtitle: String,
  meta: String,
  metaColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurfaceVariant,
  onOpen: () -> Unit,
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(meta, style = MaterialTheme.typography.bodySmall, color = metaColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      TextButton(onClick = onOpen) { Text("Open") }
    }
  }
}

