package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import android.widget.Toast
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.isoToKolkataLocalDateTime
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.launch

@Composable
fun MyDayScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  session: SessionState,
  onMutated: () -> Unit,
  onLeadClick: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val ctx = LocalContext.current
  val scope = rememberCoroutineScope()
  val today by rememberKolkataDateTicker()
  val actor = remember(session.userId, session.myProfile) { session.myProfile?.email ?: session.userId ?: "unknown" }

  fun appendNote(leadId: String, noteText: String) {
    scope.launch {
      runCatching {
        val lead = leadsRepository.getLead(leadId)
        val now = Instant.now().toString()
        val nextNotes =
          (lead.notes + LeadNote(text = noteText, date = now, byUser = actor))
            .takeLast(500)
        leadsRepository.updateLead(leadId, LeadUpdate(notes = nextNotes))
      }
        .onSuccess { onMutated() }
        .onFailure { Toast.makeText(ctx, it.message ?: "Couldn’t log action.", Toast.LENGTH_LONG).show() }
    }
  }

  val actionable =
    remember(leads) {
      val closedStatuses = setOf("Payment Done", "Deal Closed")
      val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
      leads.filterNot { (it.status ?: "").trim() in closedStatuses || (it.status ?: "").trim() in rejectedStatuses }
    }

  val overdue =
    remember(actionable, today) {
      actionable
        .filter { isoToKolkataDate(it.nextFollowUp)?.isBefore(today) == true }
        .sortedWith(
          compareBy<LeadSummary>(
            { isoToKolkataDate(it.nextFollowUp) ?: LocalDate.MIN },
            { it.name.lowercase() },
          ),
        )
    }

  val dueToday =
    remember(actionable, today) {
      actionable
        .filter { isoToKolkataDate(it.nextFollowUp)?.isEqual(today) == true }
        .sortedWith(
          compareBy<LeadSummary>(
            { isoToKolkataLocalDateTime(it.nextFollowUp)?.toLocalTime()?.toSecondOfDay() ?: Int.MAX_VALUE },
            { it.name.lowercase() },
          ),
        )
    }

  val meetingsToday =
    remember(actionable, today) {
      actionable
        .filter { (it.status ?: "").trim() == "Meeting Scheduled" && isoToKolkataDate(it.nextFollowUp)?.isEqual(today) == true }
        .sortedWith(
          compareBy<LeadSummary>(
            { isoToKolkataLocalDateTime(it.nextFollowUp)?.toLocalTime()?.toSecondOfDay() ?: Int.MAX_VALUE },
            { it.name.lowercase() },
          ),
        )
    }

  val scroll = rememberScrollState()
  Column(modifier = modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      StatMini(label = "Overdue", value = overdue.size.toString(), modifier = Modifier.weight(1f))
      StatMini(label = "Due today", value = dueToday.size.toString(), modifier = Modifier.weight(1f))
      StatMini(label = "Meetings", value = meetingsToday.size.toString(), modifier = Modifier.weight(1f))
    }

    SectionCard(
      title = "Overdue (must update)",
      subtitle = "These follow-ups are past due.",
      emptyText = "No overdue items.",
      items = overdue.take(60),
      onLeadClick = onLeadClick,
      onCall = { lead ->
        val phone = lead.phone?.trim().orEmpty()
        if (phone.isNotBlank()) {
          ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
          appendNote(lead.id, "[CALL]: Dialed client (My Day)")
        }
      },
      onWhatsApp = { lead ->
        val phone = lead.phone?.trim().orEmpty()
        if (phone.isNotBlank()) {
          ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phone")))
          appendNote(lead.id, "[WHATSAPP]: Opened chat (My Day)")
        }
      },
      onAddCalendar = { lead ->
        launchCalendarInsert(ctx, lead, fallbackDate = today)
        appendNote(lead.id, "[CALENDAR]: Opened insert (My Day)")
      },
      accentIcon = { Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
    )

    SectionCard(
      title = "Due today",
      subtitle = "Today’s scheduled follow-ups and actions.",
      emptyText = "No actions scheduled for today.",
      items = dueToday.take(60),
      onLeadClick = onLeadClick,
      onCall = { lead ->
        val phone = lead.phone?.trim().orEmpty()
        if (phone.isNotBlank()) {
          ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
          appendNote(lead.id, "[CALL]: Dialed client (My Day)")
        }
      },
      onWhatsApp = { lead ->
        val phone = lead.phone?.trim().orEmpty()
        if (phone.isNotBlank()) {
          ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phone")))
          appendNote(lead.id, "[WHATSAPP]: Opened chat (My Day)")
        }
      },
      onAddCalendar = { lead ->
        launchCalendarInsert(ctx, lead, fallbackDate = today)
        appendNote(lead.id, "[CALENDAR]: Opened insert (My Day)")
      },
    )
  }
}

@Composable
private fun StatMini(
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
    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(value, style = MaterialTheme.typography.titleLarge)
    }
  }
}

@Composable
private fun SectionCard(
  title: String,
  subtitle: String,
  emptyText: String,
  items: List<LeadSummary>,
  onLeadClick: (String) -> Unit,
  onCall: (LeadSummary) -> Unit,
  onWhatsApp: (LeadSummary) -> Unit,
  onAddCalendar: (LeadSummary) -> Unit,
  accentIcon: (@Composable () -> Unit)? = null,
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        accentIcon?.invoke()
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(title, style = MaterialTheme.typography.titleMedium)
          Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }

      if (items.isEmpty()) {
        Text(emptyText, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        items.forEachIndexed { idx, lead ->
          if (idx > 0) Spacer(Modifier.height(10.dp))
          MyDayLeadRow(
            lead = lead,
            onClick = { onLeadClick(lead.id) },
            onCall = lead.phone?.takeIf { it.isNotBlank() }?.let { { onCall(lead) } },
            onWhatsApp = lead.phone?.takeIf { it.isNotBlank() }?.let { { onWhatsApp(lead) } },
            onAddCalendar = { onAddCalendar(lead) },
          )
        }
      }
    }
  }
}

@Composable
private fun MyDayLeadRow(
  lead: LeadSummary,
  onClick: () -> Unit,
  onCall: (() -> Unit)?,
  onWhatsApp: (() -> Unit)?,
  onAddCalendar: () -> Unit,
) {
  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(lead.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
          val amt = lead.loanAmount ?: 0L
          if (amt > 0L) Text(formatCompactInr(amt), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        val sub =
          listOfNotNull(
              lead.company?.takeIf { it.isNotBlank() },
              lead.location?.takeIf { it.isNotBlank() },
            )
            .joinToString(" • ")
        if (sub.isNotBlank()) {
          Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
      }

      Column(horizontalAlignment = Alignment.End) {
        LeadStatusPill(status = lead.status)
        val time = isoToKolkataLocalDateTime(lead.nextFollowUp)?.toLocalTime()
        if (time != null) {
          Spacer(Modifier.height(6.dp))
          Text(time.toString(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onAddCalendar) {
          Icon(Icons.Outlined.CalendarMonth, contentDescription = "Add to calendar")
        }
        IconButton(onClick = { onCall?.invoke() }, enabled = onCall != null) {
          Icon(Icons.Outlined.Call, contentDescription = "Call")
        }
        IconButton(onClick = { onWhatsApp?.invoke() }, enabled = onWhatsApp != null) {
          Icon(Icons.Outlined.Chat, contentDescription = "WhatsApp")
        }
      }
    }
  }
}

private fun launchCalendarInsert(
  context: android.content.Context,
  lead: LeadSummary,
  fallbackDate: LocalDate,
) {
  val dt = isoToKolkataLocalDateTime(lead.nextFollowUp)
  val start =
    (dt ?: fallbackDate.atTime(11, 0))
      .atZone(KOLKATA_ZONE)
      .toInstant()
      .toEpochMilli()
  val end = start + 30 * 60 * 1000L

  val title = "Follow-up: ${lead.name}"
	  val desc =
	    buildString {
	      if (!lead.company.isNullOrBlank()) append("Company: ${lead.company}\n")
	      if (!lead.location.isNullOrBlank()) append("Location: ${lead.location}\n")
	      if (!lead.phone.isNullOrBlank()) append("Phone: ${lead.phone}\n")
	      val amt = lead.loanAmount
	      if (amt != null && amt > 0L) append("Amount: ${formatCompactInr(amt)}\n")
	      if (!lead.status.isNullOrBlank()) append("Status: ${lead.status}\n")
	    }.trim()

  val intent =
    Intent(Intent.ACTION_INSERT)
      .setData(CalendarContract.Events.CONTENT_URI)
      .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
      .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
      .putExtra(CalendarContract.Events.TITLE, title)
      .putExtra(CalendarContract.Events.DESCRIPTION, desc)

  context.startActivity(intent)
}
