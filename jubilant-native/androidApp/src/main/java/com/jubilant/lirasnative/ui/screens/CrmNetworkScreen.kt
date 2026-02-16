package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.MeetingRoom
import androidx.compose.material.icons.outlined.Undo
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.di.MediatorsRepository
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorFollowUpEntry
import com.jubilant.lirasnative.shared.supabase.MediatorUpdate
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

private enum class CrmTab(
  val label: String,
) {
  Partners("Partners"),
  Mediators("Mediators"),
  Tasks("Tasks"),
  Activities("Activities"),
}

private enum class ActivityChipKind {
  Lead,
  Mediator,
}

private data class ActivityChipData(
  val key: String,
  val kind: ActivityChipKind,
  val id: String,
  val label: String,
)

@Composable
fun CrmNetworkScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  mediatorsState: MediatorsState,
  mediatorsRepository: MediatorsRepository,
  session: SessionState,
  onLeadClick: (id: String) -> Unit,
  onMediatorClick: (id: String) -> Unit,
  onCreateMediator: () -> Unit,
  onMutated: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val ctx = LocalContext.current
  val scope = rememberCoroutineScope()
  val today by rememberKolkataDateTicker()
  val todayKey = remember(today) { today.toString() }

  var tab by rememberSaveable { mutableStateOf(CrmTab.Partners) }

  val todaysPartnerConnect by remember(mediatorsState.mediators, todayKey) {
    derivedStateOf {
      mediatorsState.mediators.count { m -> m.followUpHistory.any { it.date == todayKey } }
    }
  }

  fun normalizePhone(raw: String?): String {
    val digits = raw.orEmpty().filter { it.isDigit() }
    if (digits.isBlank()) return ""
    return if (digits.length > 10) digits.takeLast(10) else digits
  }

  fun openDial(phone: String) {
    val digits = normalizePhone(phone)
    if (digits.isBlank()) return
    runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits"))) }
      .onFailure { Toast.makeText(ctx, "Couldn’t open dialer.", Toast.LENGTH_SHORT).show() }
  }

  fun openWhatsApp(phone: String, message: String) {
    val digits = normalizePhone(phone)
    if (digits.isBlank()) return
    val url = "https://wa.me/$digits?text=${Uri.encode(message)}"
    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
      .onFailure { Toast.makeText(ctx, "Couldn’t open WhatsApp.", Toast.LENGTH_SHORT).show() }
  }

  fun setPartnerConnect(m: Mediator, type: String?) {
    val now = LocalTime.now(KOLKATA_ZONE).format(DateTimeFormatter.ofPattern("hh:mm a"))
    val nextHistory =
      if (type == null) {
        m.followUpHistory.filterNot { it.date == todayKey }
      } else {
        val entry = MediatorFollowUpEntry(date = todayKey, time = now, type = type)
        val without = m.followUpHistory.filterNot { it.date == todayKey }
        without + entry
      }

    scope.launch {
      runCatching {
        val patch = MediatorUpdate(followUpHistory = nextHistory.takeLast(400))
        mediatorsRepository.updateMediator(m.id, patch)
      }
        .onFailure {
          val patch = MediatorUpdate(followUpHistory = nextHistory.takeLast(400))
          RetryQueueStore.enqueueMediatorUpdate(ctx.applicationContext, m.id, patch)
          RetrySyncScheduler.enqueueNow(ctx.applicationContext)
          Toast.makeText(ctx, "Queued — will sync when online.", Toast.LENGTH_LONG).show()
        }
        .onSuccess { onMutated() }
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
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Icon(Icons.Outlined.Groups, contentDescription = null)
          Text("CRM / Network", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          Text(
            "$todaysPartnerConnect connected today",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }

        LazyRow(
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          modifier = Modifier.fillMaxWidth().height(42.dp),
        ) {
          items(CrmTab.entries, key = { it.name }) { t ->
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
      }
    }

    when (tab) {
      CrmTab.Partners -> {
        PartnerConnectList(
          mediators = mediatorsState.mediators,
          todayKey = todayKey,
          onCall = { m ->
            val phone = m.phone.orEmpty()
            if (phone.isNotBlank()) openDial(phone)
            setPartnerConnect(m, "call")
          },
          onWhatsApp = { m ->
            val phone = m.phone.orEmpty()
            if (phone.isNotBlank()) {
              val msg =
                "Good Morning ${m.name}, hope you're doing well. Do we have any new cases or updates for today?"
              openWhatsApp(phone, msg)
            }
            setPartnerConnect(m, "whatsapp")
          },
          onMeeting = { m -> setPartnerConnect(m, "meeting") },
          onUndo = { m -> setPartnerConnect(m, null) },
          onOpenMediator = { onMediatorClick(it) },
          modifier = Modifier.weight(1f, fill = true),
        )
      }

      CrmTab.Mediators -> {
        MediatorsTab(
          state = mediatorsState,
          leads = leads,
          onMediatorClick = onMediatorClick,
          onCreateMediator = onCreateMediator,
          modifier = Modifier.weight(1f, fill = true),
        )
      }

      CrmTab.Tasks -> {
        MyDayScreen(
          leads = leads,
          leadsRepository = leadsRepository,
          session = session,
          onMutated = onMutated,
          onLeadClick = onLeadClick,
          modifier = Modifier.weight(1f, fill = true),
        )
      }

      CrmTab.Activities -> {
        ActivitiesPanel(
          leads = leads,
          mediators = mediatorsState.mediators,
          today = today,
          todayKey = todayKey,
          onLeadClick = onLeadClick,
          onMediatorClick = onMediatorClick,
          modifier = Modifier.weight(1f, fill = true),
        )
      }
    }
  }
}

@Composable
private fun PartnerConnectList(
  mediators: List<Mediator>,
  todayKey: String,
  onCall: (Mediator) -> Unit,
  onWhatsApp: (Mediator) -> Unit,
  onMeeting: (Mediator) -> Unit,
  onUndo: (Mediator) -> Unit,
  onOpenMediator: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier.fillMaxSize(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("Daily partner connect", style = MaterialTheme.typography.titleMedium)
      Text(
        "Tap Call / WhatsApp / Meeting to log engagement for today.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(mediators.sortedBy { it.name.lowercase() }) { m ->
          val todayEntry = m.followUpHistory.lastOrNull { it.date == todayKey }
          val isDone = todayEntry != null
          Card(
            modifier = Modifier.fillMaxWidth().clickable { onOpenMediator(m.id) },
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
          ) {
            Row(
              modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
              Column(modifier = Modifier.weight(1f)) {
                Text(m.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val meta =
                  if (isDone) "${todayEntry?.time ?: "--"} • ${todayEntry?.type ?: ""}"
                  else "Total connects: ${m.followUpHistory.size}"
                Text(meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              }
              if (isDone) {
                IconButton(onClick = { onUndo(m) }) { Icon(Icons.Outlined.Undo, contentDescription = "Undo") }
              } else {
                IconButton(onClick = { onCall(m) }, enabled = !m.phone.isNullOrBlank()) {
                  Icon(Icons.Outlined.Call, contentDescription = "Call")
                }
                IconButton(onClick = { onWhatsApp(m) }, enabled = !m.phone.isNullOrBlank()) {
                  Icon(Icons.Outlined.Chat, contentDescription = "WhatsApp")
                }
                IconButton(onClick = { onMeeting(m) }) { Icon(Icons.Outlined.MeetingRoom, contentDescription = "Meeting") }
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun ActivitiesPanel(
  leads: List<LeadSummary>,
  mediators: List<Mediator>,
  today: java.time.LocalDate,
  todayKey: String,
  onLeadClick: (String) -> Unit,
  onMediatorClick: (String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val updatedToday =
    remember(leads, today) {
      leads.filter { isoToKolkataDate(it.updatedAt) == today }.take(20)
    }
  val newToday =
    remember(leads, today) {
      leads.filter { isoToKolkataDate(it.createdAt) == today }.take(20)
    }
  val partnersDone =
    remember(mediators, todayKey) {
      mediators.filter { it.followUpHistory.any { h -> h.date == todayKey } }.take(24)
    }

  fun keywordForConnect(typeRaw: String?): String {
    val t = typeRaw?.trim()?.lowercase().orEmpty()
    return when (t) {
      "call" -> "CALL"
      "whatsapp" -> "WA"
      "meeting" -> "MEET"
      else -> t.uppercase().ifBlank { "DONE" }
    }
  }

  val chips =
    remember(newToday, updatedToday, partnersDone, todayKey) {
      buildList {
        newToday.forEach { l ->
          add(
            ActivityChipData(
              key = "new:${l.id}",
              kind = ActivityChipKind.Lead,
              id = l.id,
              label = "NEW ${l.name}",
            ),
          )
        }
        updatedToday.forEach { l ->
          val status = (l.status ?: "").trim()
          val suffix = if (status.isBlank()) "" else " • ${status.take(18)}"
          add(
            ActivityChipData(
              key = "upd:${l.id}",
              kind = ActivityChipKind.Lead,
              id = l.id,
              label = "UPD ${l.name}$suffix",
            ),
          )
        }
        partnersDone.forEach { m ->
          val typeKeyword = keywordForConnect(m.followUpHistory.lastOrNull { it.date == todayKey }?.type)
          add(
            ActivityChipData(
              key = "p:${m.id}",
              kind = ActivityChipKind.Mediator,
              id = m.id,
              label = "$typeKeyword ${m.name}",
            ),
          )
        }
      }.take(80)
    }

  Card(
    modifier = modifier.fillMaxSize(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
      Text("Today’s activity", style = MaterialTheme.typography.titleMedium)
      Text(
        "Tap a keyword to open the related lead/partner.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )

      if (chips.isEmpty()) {
        Text("No activity recorded today.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        LazyRow(
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          modifier = Modifier.fillMaxWidth().height(44.dp),
        ) {
          items(chips, key = { it.key }) { item ->
            FilterChip(
              selected = false,
              onClick = {
                when (item.kind) {
                  ActivityChipKind.Lead -> onLeadClick(item.id)
                  ActivityChipKind.Mediator -> onMediatorClick(item.id)
                }
              },
              label = { Text(item.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
              modifier = Modifier.height(36.dp),
              colors =
                FilterChipDefaults.filterChipColors(
                  containerColor = MaterialTheme.colorScheme.surfaceVariant,
                  labelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = false,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                ),
            )
          }
        }
      }
    }
  }
}
