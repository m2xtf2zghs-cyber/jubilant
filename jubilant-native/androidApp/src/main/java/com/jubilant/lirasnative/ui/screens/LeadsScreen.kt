package com.jubilant.lirasnative.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.DashboardCustomize
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Today
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.ui.theme.Blue500
import com.jubilant.lirasnative.ui.theme.Danger500
import com.jubilant.lirasnative.ui.theme.Gold500
import com.jubilant.lirasnative.ui.theme.Slate400
import com.jubilant.lirasnative.ui.theme.Success500
import com.jubilant.lirasnative.ui.theme.Warning500
import java.text.DecimalFormat
import java.util.Locale

private enum class LeadsFilter(
  val label: String,
) {
  All("All"),
  Mine("Mine"),
  Watchlist("Watchlist"),
}

@Composable
fun LeadsTab(
  state: LeadsState,
  session: SessionState,
  mediators: List<Mediator>,
  query: String,
  onQueryChange: (String) -> Unit,
  onLeadClick: (id: String) -> Unit,
  onCreateLead: () -> Unit,
  onOpenKanban: () -> Unit,
  onOpenCalendar: () -> Unit,
  onUploadDoc: (leadId: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  var filter by rememberSaveable { mutableStateOf(LeadsFilter.All) }

  val filteredLeads by remember(state.leads, query) {
    derivedStateOf {
      val q = query.trim().lowercase(Locale.getDefault())
      if (q.isBlank()) state.leads
      else {
        state.leads.filter { l ->
          listOfNotNull(l.name, l.company, l.phone, l.location)
            .joinToString(" ")
            .lowercase(Locale.getDefault())
            .contains(q)
        }
          }
    }
  }

  val scopedLeads by remember(filteredLeads, filter, session.userId, session.isAdmin) {
    derivedStateOf {
      when (filter) {
        LeadsFilter.All -> filteredLeads
        LeadsFilter.Mine ->
          if (session.isAdmin && !session.userId.isNullOrBlank()) filteredLeads.filter { it.ownerId == session.userId }
          else filteredLeads
        LeadsFilter.Watchlist -> filteredLeads.filter { it.isHighPotential == true }
      }
    }
  }

  val mediatorsById = remember(mediators) { mediators.associateBy { it.id } }

  if (state.loading && state.leads.isEmpty()) {
    Row(
      modifier = modifier.fillMaxSize(),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      CircularProgressIndicator()
    }
    return
  }

  Column(modifier = modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    state.error?.let { msg ->
      Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(
          msg,
          modifier = Modifier.padding(12.dp),
          color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodyMedium,
        )
      }
    }

    LeadsSummaryRow(leads = state.leads)

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      FilterChip(
        selected = filter == LeadsFilter.All,
        onClick = { filter = LeadsFilter.All },
        label = { Text(LeadsFilter.All.label) },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
            selectedLabelColor = MaterialTheme.colorScheme.onBackground,
          ),
        border =
          FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = filter == LeadsFilter.All,
            borderColor = MaterialTheme.colorScheme.outlineVariant,
            selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
          ),
      )

      if (session.isAdmin) {
        FilterChip(
          selected = filter == LeadsFilter.Mine,
          onClick = { filter = LeadsFilter.Mine },
          label = { Text(LeadsFilter.Mine.label) },
          colors =
            FilterChipDefaults.filterChipColors(
              containerColor = MaterialTheme.colorScheme.surfaceVariant,
              selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
              selectedLabelColor = MaterialTheme.colorScheme.onBackground,
            ),
          border =
            FilterChipDefaults.filterChipBorder(
              enabled = true,
              selected = filter == LeadsFilter.Mine,
              borderColor = MaterialTheme.colorScheme.outlineVariant,
              selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
            ),
        )
      }

      FilterChip(
        selected = filter == LeadsFilter.Watchlist,
        onClick = { filter = LeadsFilter.Watchlist },
        label = { Text(LeadsFilter.Watchlist.label) },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
            selectedLabelColor = MaterialTheme.colorScheme.onBackground,
          ),
        border =
          FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = filter == LeadsFilter.Watchlist,
            borderColor = MaterialTheme.colorScheme.outlineVariant,
            selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
          ),
      )
    }

    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
      Text("View:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      FilterChip(
        selected = true,
        onClick = {},
        label = { Text("List") },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
            selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
            selectedLabelColor = MaterialTheme.colorScheme.onBackground,
          ),
        border =
          FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = true,
            borderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
            selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
          ),
      )
      FilterChip(
        selected = false,
        onClick = onOpenKanban,
        label = { Text("Kanban") },
        leadingIcon = { Icon(Icons.Outlined.DashboardCustomize, contentDescription = null) },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
            selectedLabelColor = MaterialTheme.colorScheme.onBackground,
          ),
        border =
          FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = false,
            borderColor = MaterialTheme.colorScheme.outlineVariant,
            selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
          ),
      )
      FilterChip(
        selected = false,
        onClick = onOpenCalendar,
        label = { Text("Calendar") },
        leadingIcon = { Icon(Icons.Outlined.Today, contentDescription = null) },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
            selectedLabelColor = MaterialTheme.colorScheme.onBackground,
          ),
        border =
          FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = false,
            borderColor = MaterialTheme.colorScheme.outlineVariant,
            selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
          ),
      )
    }

    OutlinedTextField(
      value = query,
      onValueChange = onQueryChange,
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
      placeholder = { Text("Search client / company / phone") },
      leadingIcon = { androidx.compose.material3.Icon(Icons.Outlined.Search, contentDescription = null) },
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

    LazyColumn(
      verticalArrangement = Arrangement.spacedBy(10.dp),
      modifier = Modifier.weight(1f, fill = true),
    ) {
      items(scopedLeads) { lead ->
        LeadCard(
          lead = lead,
          mediator = lead.mediatorId?.let { mediatorsById[it] },
          onClick = { onLeadClick(lead.id) },
          onUploadDoc = { onUploadDoc(lead.id) },
        )
      }
    }

    FloatingActionButton(
      onClick = onCreateLead,
      containerColor = MaterialTheme.colorScheme.secondary,
      contentColor = Color(0xFF0B1220),
      shape = RoundedCornerShape(18.dp),
      modifier = Modifier.align(Alignment.End),
    ) {
      androidx.compose.material3.Icon(Icons.Outlined.Add, contentDescription = "Add lead")
    }
  }
}

@Composable
private fun LeadsSummaryRow(leads: List<LeadSummary>) {
  val closedStatuses = setOf("Payment Done", "Deal Closed")
  val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
  val total = leads.size
  val closed = leads.count { (it.status ?: "") in closedStatuses }
  val rejected = leads.count { (it.status ?: "") in rejectedStatuses }
  val active = (total - closed - rejected).coerceAtLeast(0)

  Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
    SummaryChip(
      label = "Total",
      value = total.toString(),
      accent = MaterialTheme.colorScheme.secondary,
      modifier = Modifier.weight(1f),
    )
    SummaryChip(
      label = "Active",
      value = active.toString(),
      accent = Blue500,
      modifier = Modifier.weight(1f),
    )
    SummaryChip(
      label = "Closed",
      value = closed.toString(),
      accent = Success500,
      modifier = Modifier.weight(1f),
    )
  }
}

@Composable
private fun SummaryChip(
  label: String,
  value: String,
  accent: Color,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier,
    shape = RoundedCornerShape(18.dp),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(value, style = MaterialTheme.typography.titleLarge, color = accent)
    }
  }
}

@Composable
private fun LeadCard(
  lead: LeadSummary,
  mediator: Mediator?,
  onClick: () -> Unit,
  onUploadDoc: () -> Unit,
) {
  val ctx = LocalContext.current
  val stripe = statusStripeColor(lead.status)
  val score = calculateLeadScore(lead)
  val scoreAccent = scoreColor(score)
  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(modifier = Modifier.fillMaxWidth()) {
      Box(modifier = Modifier.width(4.dp).fillMaxHeight().background(stripe))
      Column(modifier = Modifier.padding(14.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text(lead.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          if (lead.isHighPotential == true) {
            androidx.compose.material3.Icon(
              Icons.Outlined.Star,
              contentDescription = null,
              tint = Gold500,
              modifier = Modifier.padding(end = 8.dp),
            )
          }
          Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val amt = lead.loanAmount ?: 0L
            if (amt > 0) {
              Text(
                text = formatCompactInr(amt),
                style = MaterialTheme.typography.titleMedium,
                color = Gold500,
              )
            }
            ScoreBadge(score = score, accent = scoreAccent)
          }
        }

        val subtitle =
          listOfNotNull(
              lead.company?.takeIf { it.isNotBlank() },
              lead.location?.takeIf { it.isNotBlank() },
            )
            .joinToString(" • ")
        if (subtitle.isNotBlank()) {
          Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
          LeadStatusPill(status = lead.status)
          val next = lead.nextFollowUp?.let(::formatShortDate).orEmpty()
          if (next.isNotBlank()) {
            Text(
              text = "Next: $next",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          val updated = (lead.updatedAt ?: lead.createdAt).orEmpty().let { it.takeIf { it.isNotBlank() }?.let(::formatShortDate).orEmpty() }
          if (updated.isNotBlank()) {
            Text(
              text = "Updated: $updated",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }

        val status = (lead.status ?: "").trim()
        val isActive =
          status.isBlank() ||
            (status !in setOf("Payment Done", "Deal Closed") && status !in setOf("Not Eligible", "Not Reliable", "Lost to Competitor"))
        if (isActive) {
          val clientPhone = lead.phone?.filter { it.isDigit() }.orEmpty()
          val mediatorPhone = mediator?.phone?.filter { it.isDigit() }.orEmpty()

          Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            IconButton(
              onClick = {
                if (clientPhone.isBlank()) return@IconButton
                runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$clientPhone"))) }
                  .onFailure { Toast.makeText(ctx, "Couldn’t open dialer.", Toast.LENGTH_SHORT).show() }
              },
              enabled = clientPhone.isNotBlank(),
            ) {
              Icon(Icons.Outlined.Call, contentDescription = "Call client")
            }

            IconButton(
              onClick = {
                if (clientPhone.isBlank()) return@IconButton
                val msg = "Hello ${lead.name}, regarding your loan requirement: Any updates for us today?"
                val url = "https://wa.me/$clientPhone?text=${Uri.encode(msg)}"
                runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                  .onFailure { Toast.makeText(ctx, "Couldn’t open WhatsApp.", Toast.LENGTH_SHORT).show() }
              },
              enabled = clientPhone.isNotBlank(),
            ) {
              Icon(Icons.Outlined.Chat, contentDescription = "WhatsApp client")
            }

            IconButton(
              onClick = {
                if (mediatorPhone.isBlank()) return@IconButton
                val mediatorName = mediator?.name ?: "Partner"
                val msg = "Hello $mediatorName, regarding your client ${lead.name}: Is there any update on the requirement today?"
                val url = "https://wa.me/$mediatorPhone?text=${Uri.encode(msg)}"
                runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                  .onFailure { Toast.makeText(ctx, "Couldn’t open WhatsApp.", Toast.LENGTH_SHORT).show() }
              },
              enabled = mediatorPhone.isNotBlank(),
            ) {
              Icon(Icons.Outlined.Groups, contentDescription = "WhatsApp partner")
            }

            Spacer(Modifier.weight(1f))

            IconButton(onClick = onUploadDoc) {
              Icon(Icons.Outlined.UploadFile, contentDescription = "Upload document")
            }
          }
        }
      }
    }
  }
}

@Composable
private fun ScoreBadge(
  score: Int,
  accent: Color,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier,
    colors = CardDefaults.cardColors(containerColor = accent.copy(alpha = 0.14f)),
    border = BorderStroke(1.dp, accent.copy(alpha = 0.35f)),
    shape = RoundedCornerShape(999.dp),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Text(
      text = score.toString(),
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
      style = MaterialTheme.typography.labelLarge,
      color = accent,
    )
  }
}

@Composable
internal fun LeadStatusPill(status: String?) {
  val s = status?.trim().orEmpty()
  if (s.isBlank()) return

  val stripe = statusStripeColor(s)
  val bg = stripe.copy(alpha = 0.14f)
  val border = stripe.copy(alpha = 0.35f)

  Card(
    colors = CardDefaults.cardColors(containerColor = bg),
    border = BorderStroke(1.dp, border),
    shape = RoundedCornerShape(999.dp),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Text(
      text = s,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = MaterialTheme.typography.labelMedium,
      color = stripe,
    )
  }
}

internal fun statusStripeColor(status: String?): Color {
  return when (status?.trim()) {
    "Payment Done", "Deal Closed" -> Success500
    "Meeting Scheduled" -> Color(0xFF8B5CF6)
    "Follow-Up Required" -> Blue500
    "Partner Follow-Up" -> Color(0xFFEC4899)
    "Interest Rate Issue" -> Warning500
    "No Appointment" -> Warning500
    "Not Eligible", "Not Reliable", "Lost to Competitor" -> Danger500
    "New" -> Blue500
    else -> Slate400
  }
}

private fun calculateLeadScore(lead: LeadSummary): Int {
  val status = (lead.status ?: "").trim()
  if (status == "Payment Done" || status == "Deal Closed") return 100
  if (status == "Not Eligible" || status == "Not Reliable") return 0

  var score = 0
  if (lead.isHighPotential == true) score += 30
  if (lead.documents?.kyc == true) score += 15
  if (lead.documents?.itr == true) score += 15
  if (lead.documents?.bank == true) score += 15
  if ((lead.company ?: "").trim().length > 3) score += 10
  if (!lead.phone.isNullOrBlank()) score += 15
  return score.coerceIn(0, 100)
}

private fun scoreColor(score: Int): Color =
  when {
    score >= 75 -> Success500
    score >= 40 -> Warning500
    else -> Danger500
  }

internal fun formatShortDate(raw: String): String {
  val s = raw.trim()
  if (s.isEmpty()) return ""
  return if (s.length >= 10) s.substring(0, 10) else s
}

internal fun formatCompactInr(amount: Long): String {
  if (amount <= 0) return "₹0"

  val abs = amount.toDouble()
  val df2 = DecimalFormat("0.00")
  val df1 = DecimalFormat("0.0")

  return when {
    abs >= 10_000_000 -> "₹${df2.format(abs / 10_000_000)} Cr"
    abs >= 100_000 -> "₹${df2.format(abs / 100_000)} L"
    abs >= 1_000 -> "₹${df1.format(abs / 1_000)} K"
    else -> "₹$amount"
  }
}
