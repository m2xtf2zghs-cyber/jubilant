package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import java.time.LocalDate
import java.util.Locale
import kotlinx.coroutines.launch

private enum class AnalyticsRange(
  val label: String,
) {
  Week("Week"),
  Month("Month"),
  All("All"),
}

@Composable
fun AnalyticsScreen(
  leadsRepository: LeadsRepository,
  mediators: List<Mediator>,
  onLeadClick: ((String) -> Unit)? = null,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  val today by rememberKolkataDateTicker()

  var range by remember { mutableStateOf(AnalyticsRange.Month) }
  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var leads by remember { mutableStateOf<List<Lead>>(emptyList()) }

  suspend fun load() {
    loading = true
    error = null
    try {
      leads = leadsRepository.listLeadsDetailed(limit = 1000)
    } catch (e: Exception) {
      error = e.message ?: "Couldn’t load analytics."
    }
    loading = false
  }

  LaunchedEffect(Unit) { load() }

  val startDate =
    remember(range, today) {
      when (range) {
        AnalyticsRange.Week -> today.minusDays(7)
        AnalyticsRange.Month -> today.minusMonths(1)
        AnalyticsRange.All -> LocalDate.MIN
      }
    }

  val filtered =
    remember(leads, startDate) {
      if (range == AnalyticsRange.All) leads
      else {
        leads.filter { l ->
          val created = isoToKolkataDate(l.createdAt) ?: return@filter false
          !created.isBefore(startDate)
        }
      }
    }

  val metrics =
    remember(filtered) {
      computeAnalytics(filtered)
    }

  val mediatorStats =
    remember(filtered, mediators, startDate, today) {
      computeMediatorStats(filtered, mediators, startDate, today)
    }

  val lossBreakdown =
    remember(filtered) {
      computeLossBreakdown(filtered)
    }

  val renewalData =
    remember(filtered, today) {
      computeRenewalData(filtered, today)
    }

  Column(modifier = modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    if (!error.isNullOrBlank()) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Text(
          text = error.orEmpty(),
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
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text("Range", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          IconButton(onClick = { scope.launch { load() } }, enabled = !loading) {
            Icon(Icons.Outlined.Refresh, contentDescription = "Reload")
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          AnalyticsRange.entries.forEach { r ->
            FilterChip(
              selected = range == r,
              onClick = { range = r },
              label = { Text(r.label) },
              colors =
                FilterChipDefaults.filterChipColors(
                  containerColor = MaterialTheme.colorScheme.surfaceVariant,
                  selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                  selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = range == r,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }

        Text(
          text = if (range == AnalyticsRange.All) "All-time data" else "${startDate} → ${today}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      MetricTile(label = "Leads", value = metrics.total.toString(), accent = MaterialTheme.colorScheme.secondary, modifier = Modifier.weight(1f))
      MetricTile(label = "Conversion", value = "${metrics.conversionRate}%", accent = Color(0xFF10B981), modifier = Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      MetricTile(label = "Closed volume", value = formatCompactInr(metrics.closedVolume), accent = Color(0xFF3B82F6), modifier = Modifier.weight(1f))
      MetricTile(label = "Pipeline", value = formatCompactInr(metrics.pipelineVolume), accent = Color(0xFFF59E0B), modifier = Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      MetricTile(label = "Rejected", value = metrics.rejected.toString(), accent = MaterialTheme.colorScheme.error, modifier = Modifier.weight(1f))
      MetricTile(label = "Avg deal", value = formatCompactInr(metrics.avgDealSize), accent = Color(0xFF8B5CF6), modifier = Modifier.weight(1f))
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Status distribution", style = MaterialTheme.typography.titleMedium)

        if (metrics.statusCounts.isEmpty()) {
          Text(
            "No data.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          metrics.statusCounts.entries.sortedByDescending { it.value }.take(12).forEach { (status, count) ->
            StatusRow(status = status, count = count)
          }
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Loss analysis (rejections)", style = MaterialTheme.typography.titleMedium)
        Text(
          "Common rejection reasons to improve submission quality.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (lossBreakdown.isEmpty()) {
          Text(
            "No rejection data available.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          lossBreakdown.take(10).forEach { (reason, count) ->
            StatusRow(status = reason, count = count)
          }
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Retention & next actions", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
          MetricTile(
            label = "Overdue",
            value = renewalData.overdue.size.toString(),
            accent = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f),
          )
          MetricTile(
            label = "Upcoming",
            value = renewalData.upcoming.size.toString(),
            accent = Color(0xFF10B981),
            modifier = Modifier.weight(1f),
          )
        }

        if (renewalData.overdue.isEmpty() && renewalData.upcoming.isEmpty()) {
          Text(
            "No renewals found.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          if (renewalData.overdue.isNotEmpty()) {
            Text("Overdue", style = MaterialTheme.typography.titleSmall)
            renewalData.overdue.take(8).forEach { item ->
              RenewalRow(item = item, onLeadClick = onLeadClick)
            }
          }
          if (renewalData.upcoming.isNotEmpty()) {
            Text("Upcoming", style = MaterialTheme.typography.titleSmall)
            renewalData.upcoming.take(8).forEach { item ->
              RenewalRow(item = item, onLeadClick = onLeadClick)
            }
          }
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Partner performance", style = MaterialTheme.typography.titleMedium)

        if (mediatorStats.isEmpty()) {
          Text(
            "No mediator data.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          mediatorStats.take(15).forEach { m ->
            MediatorStatCard(m)
            Spacer(Modifier.height(10.dp))
          }
          if (mediatorStats.size > 15) {
            Spacer(Modifier.height(6.dp))
            Text(
              "Showing top 15 by closed volume.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }
  }
}

private data class AnalyticsMetrics(
  val total: Int,
  val closed: Int,
  val active: Int,
  val rejected: Int,
  val conversionRate: String,
  val totalVolume: Long,
  val closedVolume: Long,
  val pipelineVolume: Long,
  val avgDealSize: Long,
  val statusCounts: Map<String, Int>,
)

private fun computeAnalytics(leads: List<Lead>): AnalyticsMetrics {
  val closedStatuses = setOf("Payment Done", "Deal Closed")
  val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")

  val total = leads.size
  val closedLeads = leads.filter { (it.status ?: "").trim() in closedStatuses }
  val rejectedLeads = leads.filter { (it.status ?: "").trim() in rejectedStatuses }
  val activeLeads = leads.filterNot { (it.status ?: "").trim() in closedStatuses || (it.status ?: "").trim() in rejectedStatuses }

  val totalVolume = leads.sumOf { it.loanAmount ?: 0L }
  val closedVolume = closedLeads.sumOf { it.loanAmount ?: 0L }
  val pipelineVolume = activeLeads.sumOf { it.loanAmount ?: 0L }

  val conversion = if (total > 0) (closedLeads.size.toDouble() / total.toDouble()) * 100.0 else 0.0
  val avgDeal = if (closedLeads.isNotEmpty()) (closedVolume / closedLeads.size) else 0L

  val statusCounts =
    leads
      .map { (it.status ?: "Unknown").trim().ifBlank { "Unknown" } }
      .groupingBy { it }
      .eachCount()

  return AnalyticsMetrics(
    total = total,
    closed = closedLeads.size,
    active = activeLeads.size,
    rejected = rejectedLeads.size,
    conversionRate = String.format(Locale.US, "%.1f", conversion),
    totalVolume = totalVolume,
    closedVolume = closedVolume,
    pipelineVolume = pipelineVolume,
    avgDealSize = avgDeal,
    statusCounts = statusCounts,
  )
}

private data class MediatorStat(
  val name: String,
  val totalLeads: Int,
  val closedLeads: Int,
  val closedVolume: Long,
  val conversionRate: String,
  val meetings: Int,
  val connects: Int,
)

private fun computeMediatorStats(
  leads: List<Lead>,
  mediators: List<Mediator>,
  start: LocalDate,
  end: LocalDate,
): List<MediatorStat> {
  val closedStatuses = setOf("Payment Done", "Deal Closed")

  return mediators
    .map { m ->
      val mLeads = leads.filter { it.mediatorId == m.id }
      val mClosed = mLeads.filter { (it.status ?: "").trim() in closedStatuses }
      val volume = mClosed.sumOf { it.loanAmount ?: 0L }
      val conversion = if (mLeads.isNotEmpty()) (mClosed.size.toDouble() / mLeads.size.toDouble()) * 100.0 else 0.0

      val history =
        m.followUpHistory.filter { entry ->
          val d = runCatching { LocalDate.parse(entry.date.take(10)) }.getOrNull() ?: return@filter false
          if (start == LocalDate.MIN) true else (!d.isBefore(start) && !d.isAfter(end))
        }
      val meetings = history.count { (it.type ?: "").equals("meeting", ignoreCase = true) }
      val connects = history.size - meetings

      MediatorStat(
        name = m.name,
        totalLeads = mLeads.size,
        closedLeads = mClosed.size,
        closedVolume = volume,
        conversionRate = String.format(Locale.US, "%.0f", conversion),
        meetings = meetings,
        connects = connects,
      )
    }
    .sortedByDescending { it.closedVolume }
}

private data class RenewalItem(
  val leadId: String,
  val name: String,
  val company: String?,
  val followUp: LocalDate,
  val lastNote: String?,
)

private data class RenewalData(
  val upcoming: List<RenewalItem>,
  val overdue: List<RenewalItem>,
)

private fun computeRenewalData(leads: List<Lead>, today: LocalDate): RenewalData {
  val items =
    leads
      .filter { (it.status ?: "").trim() == "Payment Done" }
      .mapNotNull { l ->
        val date = isoToKolkataDate(l.nextFollowUp) ?: return@mapNotNull null
        val lastNote = l.notes.lastOrNull()?.text
        RenewalItem(
          leadId = l.id,
          name = l.name,
          company = l.company,
          followUp = date,
          lastNote = lastNote,
        )
      }
      .sortedBy { it.followUp }

  val overdue = items.filter { it.followUp.isBefore(today) }
  val upcoming = items.filterNot { it.followUp.isBefore(today) }
  return RenewalData(upcoming = upcoming, overdue = overdue)
}

private fun computeLossBreakdown(leads: List<Lead>): List<Pair<String, Int>> {
  val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
  val rejected = leads.filter { (it.status ?: "").trim() in rejectedStatuses }
  if (rejected.isEmpty()) return emptyList()

  return rejected
    .map { extractRejectionReason(it) }
    .groupingBy { it }
    .eachCount()
    .entries
    .sortedByDescending { it.value }
    .map { it.key to it.value }
}

private fun extractRejectionReason(lead: Lead): String {
  lead.rejectionDetails?.reason?.trim()?.takeIf { it.isNotBlank() }?.let { return it }

  val status = (lead.status ?: "").trim()
  val noteText =
    lead.notes
      .asReversed()
      .firstOrNull { n ->
        val t = n.text
        t.contains("REJECTION", ignoreCase = true) || t.contains("REASON", ignoreCase = true)
      }
      ?.text
      .orEmpty()

  if (noteText.contains("Reason=", ignoreCase = true)) {
    val match = Regex("Reason=([^|]+)", RegexOption.IGNORE_CASE).find(noteText)
    val raw = match?.groupValues?.getOrNull(1)?.trim().orEmpty()
    if (raw.isNotBlank()) return raw
  }

  if (noteText.contains("[REJECTION REASON]", ignoreCase = true)) {
    val raw = noteText.substringAfter("]:", "").trim()
    if (raw.isNotBlank()) return raw
  }

  if (noteText.contains("REASON:", ignoreCase = true)) {
    val raw = noteText.substringAfter("REASON:", "").trim()
    if (raw.isNotBlank()) return raw
  }

  if (status == "Lost to Competitor") return "Competitor"
  return "Unspecified"
}

@Composable
private fun MetricTile(
  label: String,
  value: String,
  accent: Color,
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
      Text(value, style = MaterialTheme.typography.titleLarge, color = accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}

@Composable
private fun RenewalRow(
  item: RenewalItem,
  onLeadClick: ((String) -> Unit)?,
) {
  val subtitle = listOfNotNull(item.company?.takeIf { it.isNotBlank() }, item.followUp.toString()).joinToString(" • ")
  Card(
    modifier =
      Modifier
        .fillMaxWidth()
        .then(
          if (onLeadClick != null) Modifier.clickable { onLeadClick(item.leadId) } else Modifier,
        ),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(item.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
      if (subtitle.isNotBlank()) {
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      item.lastNote?.takeIf { it.isNotBlank() }?.let { last ->
        Text(
          last,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

@Composable
private fun StatusRow(
  status: String,
  count: Int,
) {
  Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
    Text(status, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      shape = RoundedCornerShape(999.dp),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Text(
        count.toString(),
        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@Composable
private fun MediatorStatCard(stat: MediatorStat) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(stat.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        Text("${stat.conversionRate}%", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.secondary)
      }
      Text(
        "Leads: ${stat.totalLeads} • Closed: ${stat.closedLeads} • Volume: ${formatCompactInr(stat.closedVolume)}",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        "Engagement: ${stat.meetings} meetings • ${stat.connects} calls/messages",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}
