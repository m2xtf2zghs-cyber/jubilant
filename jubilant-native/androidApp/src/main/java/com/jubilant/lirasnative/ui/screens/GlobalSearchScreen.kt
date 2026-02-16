package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.ui.components.SectionHeader
import java.util.Locale

private data class NoteMatch(
  val leadId: String,
  val leadName: String,
  val note: LeadNote,
)

@Composable
fun GlobalSearchScreen(
  leads: List<LeadSummary>,
  mediators: List<Mediator>,
  leadsRepository: LeadsRepository,
  session: SessionState,
  onOpenLead: (id: String) -> Unit,
  onOpenMediator: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val ctx = LocalContext.current

  var query by rememberSaveable { mutableStateOf("") }
  var includeNotes by rememberSaveable { mutableStateOf(false) }

  var notesLoading by remember { mutableStateOf(false) }
  var notesError by remember { mutableStateOf<String?>(null) }
  var noteMatches by remember { mutableStateOf<List<NoteMatch>>(emptyList()) }

  val q = query.trim()
  val qLower = remember(q) { q.lowercase(Locale.getDefault()) }

  val closedStatuses = remember { setOf("Payment Done", "Deal Closed") }

  val leadMatches by remember(leads, qLower) {
    derivedStateOf {
      if (qLower.isBlank()) emptyList()
      else {
        leads
          .asSequence()
          .filter { l ->
            listOfNotNull(l.name, l.company, l.phone, l.location)
              .joinToString(" ")
              .lowercase(Locale.getDefault())
              .contains(qLower)
          }
          .filter { (it.status ?: "").trim() !in closedStatuses }
          .take(60)
          .toList()
      }
    }
  }

  val loanMatches by remember(leads, qLower, closedStatuses) {
    derivedStateOf {
      if (qLower.isBlank()) emptyList()
      else {
        leads
          .asSequence()
          .filter { l ->
            (l.status ?: "").trim() in closedStatuses &&
              listOfNotNull(l.id, l.name, l.company, l.phone)
                .joinToString(" ")
                .lowercase(Locale.getDefault())
                .contains(qLower)
          }
          .take(40)
          .toList()
      }
    }
  }

  val mediatorMatches by remember(mediators, qLower) {
    derivedStateOf {
      if (qLower.isBlank()) emptyList()
      else {
        mediators
          .asSequence()
          .filter { m ->
            listOfNotNull(m.name, m.phone, m.id)
              .joinToString(" ")
              .lowercase(Locale.getDefault())
              .contains(qLower)
          }
          .take(40)
          .toList()
      }
    }
  }

  LaunchedEffect(includeNotes, qLower) {
    if (!includeNotes) {
      noteMatches = emptyList()
      notesLoading = false
      notesError = null
      return@LaunchedEffect
    }
    if (qLower.length < 3) {
      noteMatches = emptyList()
      notesLoading = false
      notesError = null
      return@LaunchedEffect
    }

    notesLoading = true
    notesError = null
    runCatching {
      leadsRepository.listLeadsDetailed(limit = 1000)
    }
      .onSuccess { detailed ->
        noteMatches =
          detailed
            .asSequence()
            .flatMap { lead: Lead ->
              lead.notes
                .asSequence()
                .filter { it.text.lowercase(Locale.getDefault()).contains(qLower) }
                .map { n -> NoteMatch(leadId = lead.id, leadName = lead.name, note = n) }
            }
            .take(80)
            .toList()
      }
      .onFailure { ex -> notesError = ex.message ?: "Couldn’t search notes." }
    notesLoading = false
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

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    SectionHeader(
      title = "Search",
      subtitle = if (session.isStaff) "Search across your assigned data." else "Search leads, loans, mediators, and notes.",
    )

    OutlinedTextField(
      value = query,
      onValueChange = { query = it },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      placeholder = { Text("Search lead / phone / mediator / note…") },
      leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
      colors =
        TextFieldDefaults.colors(
          unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
          focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
          focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
          unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
          focusedTextColor = MaterialTheme.colorScheme.onSurface,
          unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
          focusedLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
          unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
          focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
          unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
    )

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      FilterChip(
        selected = includeNotes,
        onClick = { includeNotes = !includeNotes },
        label = { Text("Search notes") },
        leadingIcon = { Icon(Icons.Outlined.Notes, contentDescription = null) },
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
            selected = includeNotes,
            borderColor = MaterialTheme.colorScheme.outlineVariant,
            selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
          ),
      )

      if (includeNotes && qLower.length < 3) {
        Text("Type 3+ characters", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }

    LazyColumn(
      modifier = Modifier.fillMaxWidth().weight(1f, fill = true),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      if (qLower.isBlank()) {
        item {
          EmptyHintCard(text = "Start typing to search across leads, loans, mediators, and notes.")
        }
        return@LazyColumn
      }

      item { GroupHeader(title = "Leads", count = leadMatches.size) }
      if (leadMatches.isEmpty()) {
        item { EmptyHintCard(text = "No lead matches.") }
      } else {
        items(leadMatches) { lead ->
          ResultRow(
            title = lead.name,
            subtitle = listOfNotNull(lead.company, lead.location).filter { it.isNotBlank() }.joinToString(" • "),
            meta = (lead.status ?: "").ifBlank { "New" },
            onOpen = { onOpenLead(lead.id) },
            onCall = { openDial(lead.phone) },
          )
        }
      }

      item { GroupHeader(title = "Loans (closed)", count = loanMatches.size) }
      if (loanMatches.isEmpty()) {
        item { EmptyHintCard(text = "No loan matches.") }
      } else {
        items(loanMatches) { lead ->
          ResultRow(
            title = lead.name,
            subtitle = listOfNotNull(lead.company, lead.phone).filter { it.isNotBlank() }.joinToString(" • "),
            meta = lead.id.take(8),
            onOpen = { onOpenLead(lead.id) },
            onCall = { openDial(lead.phone) },
          )
        }
      }

      item { GroupHeader(title = "Mediators / Partners", count = mediatorMatches.size) }
      if (mediatorMatches.isEmpty()) {
        item { EmptyHintCard(text = "No mediator matches.") }
      } else {
        items(mediatorMatches) { m ->
          ResultRow(
            title = m.name,
            subtitle = normalizePhone(m.phone),
            meta = "Mediator",
            onOpen = { onOpenMediator(m.id) },
            onCall = { openDial(m.phone) },
            openIcon = Icons.Outlined.Groups,
          )
        }
      }

      if (includeNotes) {
        item { GroupHeader(title = "Notes", count = noteMatches.size) }
        when {
          notesLoading -> item { EmptyHintCard(text = "Searching notes…") }
          notesError != null -> item { ErrorHintCard(text = notesError!!) }
          noteMatches.isEmpty() -> item { EmptyHintCard(text = "No note matches.") }
          else -> {
            items(noteMatches) { m ->
              ResultRow(
                title = m.leadName,
                subtitle = m.note.text,
                meta = m.note.date.take(10),
                onOpen = { onOpenLead(m.leadId) },
                onCall = null,
                openIcon = Icons.Outlined.Notes,
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun GroupHeader(
  title: String,
  count: Int,
) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
    Text(count.toString(), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
  }
}

@Composable
private fun ResultRow(
  title: String,
  subtitle: String,
  meta: String,
  onOpen: () -> Unit,
  onCall: (() -> Unit)?,
  openIcon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Outlined.OpenInNew,
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (subtitle.isNotBlank()) {
          Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (meta.isNotBlank()) {
          Text(meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      if (onCall != null) {
        IconButton(onClick = onCall) {
          Icon(Icons.Outlined.Call, contentDescription = "Call")
        }
      } else {
        Spacer(Modifier.size(1.dp))
      }
      IconButton(onClick = onOpen) {
        Icon(openIcon, contentDescription = "Open")
      }
    }
  }
}

@Composable
private fun EmptyHintCard(text: String) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Text(
      text,
      modifier = Modifier.padding(12.dp),
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun ErrorHintCard(text: String) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.10f)),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Text(
      text,
      modifier = Modifier.padding(12.dp),
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.error,
    )
  }
}
