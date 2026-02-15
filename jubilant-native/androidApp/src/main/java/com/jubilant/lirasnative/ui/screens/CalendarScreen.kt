package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.ui.theme.Gold500
import java.time.LocalDate
import java.time.YearMonth
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.isoToKolkataLocalDateTime
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll

@Composable
fun CalendarScreen(
  leads: List<LeadSummary>,
  onLeadClick: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val today by rememberKolkataDateTicker()
  var currentMonth by remember { mutableStateOf(YearMonth.of(today.year, today.month)) }
  var selectedDate by remember { mutableStateOf(today) }
  var filter by remember { mutableStateOf(DayLeadFilter.All) }

  LaunchedEffect(currentMonth) {
    val first = currentMonth.atDay(1)
    if (selectedDate.year != first.year || selectedDate.month != first.month) {
      selectedDate = first
    }
  }

  val leadsByDate =
    remember(leads) {
      leads
        .mapNotNull { l ->
          val d = isoToKolkataDate(l.nextFollowUp) ?: return@mapNotNull null
          d to l
        }
        .groupBy({ it.first }, { it.second })
    }

  val monthLabel =
    remember(currentMonth) {
      "${currentMonth.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${currentMonth.year}"
    }

  val screenScroll = rememberScrollState()
  Column(modifier = modifier.verticalScroll(screenScroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          IconButton(onClick = { currentMonth = currentMonth.minusMonths(1) }) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Prev month")
          }
          Text(
            text = monthLabel,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
          )
          IconButton(onClick = { currentMonth = currentMonth.plusMonths(1) }) {
            Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = "Next month")
          }
        }

        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween,
        ) {
          Text(
            text = "Tap a date to see the day plan.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Text(
            text = "Today",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.secondary,
            modifier =
              Modifier
                .clickable {
                  currentMonth = YearMonth.of(today.year, today.month)
                  selectedDate = today
                }
                .padding(horizontal = 8.dp, vertical = 6.dp),
          )
        }

        CalendarGrid(
          month = currentMonth,
          today = today,
          selected = selectedDate,
          leadsByDate = leadsByDate,
          onSelect = { selectedDate = it },
        )
      }
    }

    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(
            text = "Scheduled • ${formatDayLabel(selectedDate)}",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.weight(1f),
          )
          if (selectedDate != today) {
            Text(
              text = "Jump to today",
              style = MaterialTheme.typography.labelLarge,
              color = MaterialTheme.colorScheme.secondary,
              modifier =
                Modifier
                  .clickable {
                    currentMonth = YearMonth.of(today.year, today.month)
                    selectedDate = today
                  }
                  .padding(horizontal = 8.dp, vertical = 6.dp),
            )
          }
        }

        val dayLeads = leadsByDate[selectedDate].orEmpty()

        if (dayLeads.isNotEmpty()) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            DayLeadFilter.entries.forEach { f ->
              FilterChip(
                selected = filter == f,
                onClick = { filter = f },
                label = { Text(f.label) },
                colors =
                  FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                    selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                  ),
                border =
                  FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = filter == f,
                    borderColor = MaterialTheme.colorScheme.outlineVariant,
                    selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                  ),
              )
            }
          }
        }

        val filteredDayLeads =
          remember(dayLeads, filter) {
            dayLeads
              .asSequence()
              .filter { matchesFilter(it, filter) }
              .sortedWith(
                compareBy<LeadSummary>(
                  { lead ->
                    isoToKolkataLocalDateTime(lead.nextFollowUp)?.toLocalTime()?.toSecondOfDay() ?: Int.MAX_VALUE
                  },
                  { it.name.lowercase() },
                ),
              )
              .toList()
          }

        if (filteredDayLeads.isEmpty()) {
          Text(
            text = if (dayLeads.isEmpty()) "No follow-ups scheduled." else "No items for this filter.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          Text(
            text = "Items: ${filteredDayLeads.size}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          filteredDayLeads.take(60).forEachIndexed { idx, lead ->
            if (idx > 0) Spacer(Modifier.height(10.dp))
            CalendarLeadRow(
              lead = lead,
              time = isoToKolkataLocalDateTime(lead.nextFollowUp)?.toLocalTime(),
              onClick = { onLeadClick(lead.id) },
            )
          }
          if (filteredDayLeads.size > 60) {
            Spacer(Modifier.height(8.dp))
            Text(
              text = "Showing first 60 of ${filteredDayLeads.size} items.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }
  }
}

private enum class DayLeadFilter(
  val label: String,
) {
  All("All"),
  Meetings("Meetings"),
  FollowUps("Follow-ups"),
  Issues("Issues"),
  Closed("Closed"),
  Rejected("Rejected"),
}

private fun matchesFilter(lead: LeadSummary, filter: DayLeadFilter): Boolean {
  val s = lead.status?.trim().orEmpty()
  if (filter == DayLeadFilter.All) return true

  return when (filter) {
    DayLeadFilter.Meetings -> s == "Meeting Scheduled"
    DayLeadFilter.FollowUps -> s == "Follow-Up Required" || s == "Partner Follow-Up"
    DayLeadFilter.Issues ->
      s == "Interest Rate Issue" ||
        s == "Statements Not Received" ||
        s == "Contact Details Not Received" ||
        s == "No Appointment"
    DayLeadFilter.Closed -> s == "Payment Done" || s == "Deal Closed"
    DayLeadFilter.Rejected -> s == "Not Eligible" || s == "Not Reliable" || s == "Lost to Competitor" || s == "Not Interested (Temp)"
    DayLeadFilter.All -> true
  }
}

private val DAY_LABEL_FMT: DateTimeFormatter =
  DateTimeFormatter.ofPattern("EEE, d MMM yyyy", Locale("en", "IN"))

private val TIME_FMT: DateTimeFormatter =
  DateTimeFormatter.ofPattern("h:mm a", Locale("en", "IN"))

private fun formatDayLabel(date: LocalDate): String = DAY_LABEL_FMT.format(date)

@Composable
private fun CalendarLeadRow(
  lead: LeadSummary,
  time: LocalTime?,
  onClick: () -> Unit,
) {
  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    shape = RoundedCornerShape(16.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(lead.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f), maxLines = 1)
          val amt = lead.loanAmount ?: 0L
          if (amt > 0L) {
            Text(formatCompactInr(amt), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }

        val sub =
          listOfNotNull(
              lead.company?.takeIf { it.isNotBlank() },
              lead.location?.takeIf { it.isNotBlank() },
            )
            .joinToString(" • ")
        if (sub.isNotBlank()) {
          Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
      }

      Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        LeadStatusPill(status = lead.status)
        if (time != null) {
          Text(TIME_FMT.format(time), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
    }
  }
}

@Composable
private fun CalendarGrid(
  month: YearMonth,
  today: LocalDate,
  selected: LocalDate,
  leadsByDate: Map<LocalDate, List<LeadSummary>>,
  onSelect: (LocalDate) -> Unit,
) {
  val first = month.atDay(1)
  val daysInMonth = month.lengthOfMonth()
  val offsetSundayFirst = first.dayOfWeek.value % 7 // Sun=0, Mon=1,...Sat=6

  val totalCells = offsetSundayFirst + daysInMonth
  val rows = ((totalCells + 6) / 7).coerceAtLeast(5)

  val dayLabels = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      dayLabels.forEach { d ->
        Text(
          text = d,
          modifier = Modifier.weight(1f),
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          textAlign = TextAlign.Center,
        )
      }
    }

    var cell = 0
    repeat(rows) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        repeat(7) {
          val dayIndex = cell - offsetSundayFirst + 1
          val date = if (dayIndex in 1..daysInMonth) month.atDay(dayIndex) else null
          val count = date?.let { leadsByDate[it]?.size ?: 0 } ?: 0
          CalendarCell(
            date = date,
            isToday = date == today,
            isSelected = date == selected,
            badgeCount = count,
            onClick = { if (date != null) onSelect(date) },
            modifier = Modifier.weight(1f),
          )
          cell++
        }
      }
    }
  }
}

@Composable
private fun CalendarCell(
  date: LocalDate?,
  isToday: Boolean,
  isSelected: Boolean,
  badgeCount: Int,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val baseBg =
    when {
      isSelected -> MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f)
      isToday -> Gold500.copy(alpha = 0.12f)
      else -> Color.Transparent
    }
  val border =
    when {
      isSelected -> MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)
      isToday -> Gold500.copy(alpha = 0.28f)
      else -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)
    }

  Box(
    modifier =
      modifier
        .padding(2.dp)
        .height(44.dp)
        .clickable(enabled = date != null, onClick = onClick),
    contentAlignment = Alignment.Center,
  ) {
    Card(
      colors = CardDefaults.cardColors(containerColor = baseBg),
      border = BorderStroke(1.dp, border),
      shape = RoundedCornerShape(12.dp),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      modifier = Modifier.fillMaxWidth().height(44.dp),
    ) {
      Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth().height(44.dp)) {
        Text(
          text = date?.dayOfMonth?.toString() ?: "",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onBackground,
        )

        if (badgeCount > 0 && date != null) {
          Box(
            modifier = Modifier.align(Alignment.TopEnd).padding(6.dp),
          ) {
            Card(
              colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondary),
              border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)),
              shape = RoundedCornerShape(999.dp),
              elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
              Text(
                text = badgeCount.coerceAtMost(99).toString(),
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSecondary,
              )
            }
          }
        }
      }
    }
  }
}
