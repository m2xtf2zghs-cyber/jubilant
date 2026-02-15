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
import androidx.compose.material.icons.outlined.Refresh
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.ui.util.PdfSection
import com.jubilant.lirasnative.ui.util.createSimplePdf
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import com.jubilant.lirasnative.ui.util.sharePdf
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale
import kotlinx.coroutines.launch

private enum class ReportType(
  val label: String,
) {
  Monthly("Monthly"),
  Quarterly("Quarterly"),
  Professional("Professional"),
}

@Composable
fun ReportsScreen(
  leadsRepository: LeadsRepository,
  mediators: List<Mediator>,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  val ctx = androidx.compose.ui.platform.LocalContext.current
  val today by rememberKolkataDateTicker()

  var type by remember { mutableStateOf(ReportType.Monthly) }
  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var leads by remember { mutableStateOf<List<Lead>>(emptyList()) }
  var exporting by remember { mutableStateOf(false) }

  suspend fun load() {
    loading = true
    error = null
    try {
      leads = leadsRepository.listLeadsDetailed(limit = 1000)
    } catch (e: Exception) {
      error = e.message ?: "Couldn’t load report data."
    }
    loading = false
  }

  LaunchedEffect(Unit) { load() }

  val start =
    remember(type, today) {
      when (type) {
        ReportType.Monthly -> today.minusMonths(1)
        ReportType.Quarterly -> today.minusMonths(3)
        ReportType.Professional -> LocalDate.MIN
      }
    }

  val filtered =
    remember(leads, start, type) {
      if (type == ReportType.Professional) leads
      else {
        leads.filter { l ->
          val created = isoToKolkataDate(l.createdAt) ?: return@filter false
          !created.isBefore(start)
        }
      }
    }

  val report = remember(filtered) { computeReport(filtered) }

  val mediatorNames = remember(mediators) { mediators.associate { it.id to it.name } }
  val topMediators = remember(filtered, mediators) { computeTopMediators(filtered, mediatorNames) }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    error?.takeIf { it.isNotBlank() }?.let { msg ->
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

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text("Reports", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          IconButton(onClick = { scope.launch { load() } }, enabled = !loading) {
            Icon(Icons.Outlined.Refresh, contentDescription = "Reload")
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          ReportType.entries.forEach { t ->
            FilterChip(
              selected = type == t,
              onClick = { type = t },
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
                  selected = type == t,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }

        Text(
          text = if (type == ReportType.Professional) "All-time" else "${start} → ${today}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        OutlinedButton(
          onClick = {
            if (exporting) return@OutlinedButton
            exporting = true
            scope.launch {
              runCatching {
                val sections =
                  buildReportSections(
                    type = type,
                    start = start,
                    end = today,
                    report = report,
                    topPartners = topMediators,
                    mediatorNames = mediatorNames,
                  )
                val file =
                  createSimplePdf(
                    context = ctx,
                    fileNamePrefix = "report_${type.name.lowercase()}",
                    title = "Jubilant Capital • ${type.label} Report",
                    subtitle = if (type == ReportType.Professional) "All-time" else "Period: $start → $today",
                    sections = sections,
                  )
                sharePdf(ctx, file, chooserTitle = "Share PDF")
              }
              exporting = false
            }
          },
          enabled = !exporting && !loading,
          modifier = Modifier.fillMaxWidth(),
        ) {
          Icon(Icons.Outlined.PictureAsPdf, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text(if (exporting) "Preparing PDF…" else "Export PDF")
        }
      }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      ReportTile(label = "Leads", value = report.total.toString(), modifier = Modifier.weight(1f))
      ReportTile(label = "Conversion", value = "${report.conversionRate}%", modifier = Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      ReportTile(label = "Total volume", value = formatCompactInr(report.totalVolume), modifier = Modifier.weight(1f))
      ReportTile(label = "Closed volume", value = formatCompactInr(report.closedVolume), modifier = Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      ReportTile(label = "Interest earned", value = formatCompactInr(report.interestEarned), modifier = Modifier.weight(1f))
      ReportTile(label = "Avg deal", value = formatCompactInr(report.avgDealSize), modifier = Modifier.weight(1f))
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Top partners (by closed volume)", style = MaterialTheme.typography.titleMedium)
        if (topMediators.isEmpty()) {
          Text("No partner closings found.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          topMediators.take(10).forEach { row ->
            PartnerRow(row)
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
        Text("Confirmed disbursements", style = MaterialTheme.typography.titleMedium)
        if (report.closedLeads.isEmpty()) {
          Text("No closed deals in this period.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(report.closedLeads.take(25)) { l ->
              DisbursementRow(
                name = l.name,
                date = (isoToKolkataDate(l.loanDetails?.paymentDate) ?: isoToKolkataDate(l.createdAt) ?: today).toString(),
                who = l.mediatorId?.let { mediatorNames[it] } ?: "Direct",
                amount = formatInr(l.loanAmount ?: 0L),
              )
            }
          }
          if (report.closedLeads.size > 25) {
            Spacer(Modifier.height(6.dp))
            Text(
              "Showing first 25 of ${report.closedLeads.size}.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }
  }
}

private data class ReportData(
  val total: Int,
  val closed: Int,
  val rejected: Int,
  val active: Int,
  val conversionRate: String,
  val totalVolume: Long,
  val closedVolume: Long,
  val interestEarned: Long,
  val avgDealSize: Long,
  val closedLeads: List<Lead>,
)

private fun computeReport(leads: List<Lead>): ReportData {
  val closedStatuses = setOf("Payment Done", "Deal Closed")
  val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")

  val closed = leads.filter { (it.status ?: "").trim() in closedStatuses }
  val rejected = leads.filter { (it.status ?: "").trim() in rejectedStatuses }
  val active = leads.filterNot { (it.status ?: "").trim() in closedStatuses || (it.status ?: "").trim() in rejectedStatuses }

  val totalVolume = leads.sumOf { it.loanAmount ?: 0L }
  val closedVolume = closed.sumOf { it.loanAmount ?: 0L }
  val interest = closed.sumOf { it.loanDetails?.interest ?: 0L }
  val avgDeal = if (closed.isNotEmpty()) (closedVolume / closed.size) else 0L
  val conversion = if (leads.isNotEmpty()) (closed.size.toDouble() / leads.size.toDouble()) * 100.0 else 0.0

  return ReportData(
    total = leads.size,
    closed = closed.size,
    rejected = rejected.size,
    active = active.size,
    conversionRate = String.format(Locale.US, "%.1f", conversion),
    totalVolume = totalVolume,
    closedVolume = closedVolume,
    interestEarned = interest,
    avgDealSize = avgDeal,
    closedLeads = closed.sortedByDescending { isoToKolkataDate(it.loanDetails?.paymentDate) ?: LocalDate.MIN },
  )
}

private data class PartnerRowData(
  val name: String,
  val closedLeads: Int,
  val volume: Long,
  val conversionRate: String,
)

private fun computeTopMediators(
  leads: List<Lead>,
  mediatorNames: Map<String, String>,
): List<PartnerRowData> {
  val closedStatuses = setOf("Payment Done", "Deal Closed")

  val byMediator = leads.groupBy { it.mediatorId ?: "direct" }
  return byMediator
    .map { (id, items) ->
      val closed = items.filter { (it.status ?: "").trim() in closedStatuses }
      val volume = closed.sumOf { it.loanAmount ?: 0L }
      val conversion = if (items.isNotEmpty()) (closed.size.toDouble() / items.size.toDouble()) * 100.0 else 0.0
      PartnerRowData(
        name = if (id == "direct") "Direct" else mediatorNames[id] ?: "Unknown",
        closedLeads = closed.size,
        volume = volume,
        conversionRate = String.format(Locale.US, "%.0f", conversion),
      )
    }
    .sortedByDescending { it.volume }
}

@Composable
private fun ReportTile(
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
      Text(value, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground, maxLines = 1)
    }
  }
}

@Composable
private fun PartnerRow(row: PartnerRowData) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Text(row.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
        Text(
          "Closed: ${row.closedLeads} • Conv: ${row.conversionRate}%",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      Text(formatCompactInr(row.volume), style = MaterialTheme.typography.titleMedium)
    }
  }
}

@Composable
private fun DisbursementRow(
  name: String,
  date: String,
  who: String,
  amount: String,
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f), maxLines = 1)
        Text(amount, style = MaterialTheme.typography.titleMedium)
      }
      Text(
        "$date • $who",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
      )
    }
  }
}

private fun formatInr(amount: Long): String {
  val fmt = NumberFormat.getNumberInstance(Locale("en", "IN"))
  return "₹${fmt.format(amount)}"
}

private fun buildReportSections(
  type: ReportType,
  start: LocalDate,
  end: LocalDate,
  report: ReportData,
  topPartners: List<PartnerRowData>,
  mediatorNames: Map<String, String>,
): List<PdfSection> {
  val summary =
    listOfNotNull(
      "Report: ${type.label}",
      if (type == ReportType.Professional) null else "Period: $start → $end",
      "Leads: ${report.total}",
      "Active: ${report.active}",
      "Closed: ${report.closed}",
      "Rejected: ${report.rejected}",
      "Conversion: ${report.conversionRate}%",
      "Total volume: ${formatInr(report.totalVolume)}",
      "Closed volume: ${formatInr(report.closedVolume)}",
      "Interest earned: ${formatInr(report.interestEarned)}",
      "Avg deal size: ${formatInr(report.avgDealSize)}",
    )

  val partners =
    if (topPartners.isEmpty()) listOf("No partner closings in this period.")
    else topPartners.take(15).map { p ->
      "${p.name} | Closed: ${p.closedLeads} | Conv: ${p.conversionRate}% | Vol: ${formatInr(p.volume)}"
    }

  val disbursements =
    if (report.closedLeads.isEmpty()) listOf("No closed deals in this period.")
    else report.closedLeads.take(50).map { l ->
      val date = (isoToKolkataDate(l.loanDetails?.paymentDate) ?: isoToKolkataDate(l.createdAt) ?: LocalDate.MIN).toString()
      val who = l.mediatorId?.let { mediatorNames[it] } ?: "Direct"
      "${l.name} | $date | $who | ${formatInr(l.loanAmount ?: 0L)}"
    }

  return listOf(
    PdfSection("Summary", summary),
    PdfSection("Top partners", partners),
    PdfSection("Disbursements", disbursements),
  )
}
