package com.jubilant.lirasnative.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.LoanDetails
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTicker
import com.jubilant.lirasnative.ui.util.showDatePicker
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale
import kotlinx.coroutines.launch

@Composable
fun LoanBookScreen(
  leadsRepository: LeadsRepository,
  mediators: List<Mediator>,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  val ctx = LocalContext.current
  val today by rememberKolkataDateTicker()
  var start by remember { mutableStateOf(today.withDayOfMonth(1)) }
  var end by remember { mutableStateOf(today) }

  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var leads by remember { mutableStateOf<List<Lead>>(emptyList()) }

  var editing by remember { mutableStateOf<Lead?>(null) }
  var commissionDraft by remember { mutableStateOf("") }
  var editBusy by remember { mutableStateOf(false) }
  var editError by remember { mutableStateOf<String?>(null) }

  suspend fun load() {
    loading = true
    error = null
    try {
      leads = leadsRepository.listLeadsDetailed(limit = 1000)
    } catch (e: Exception) {
      error = e.message ?: "Couldn’t load loan book data."
    }
    loading = false
  }

  LaunchedEffect(Unit) { load() }

  val mediatorNames =
    remember(mediators) {
      mediators.associate { it.id to it.name }
    }

  val closed =
    remember(leads, start, end) {
      val closedStatuses = setOf("Payment Done", "Deal Closed")
      leads
        .filter { (it.status ?: "").trim() in closedStatuses }
        .mapNotNull { l ->
          val payDate =
            isoToKolkataDate(l.loanDetails?.paymentDate)
              ?: isoToKolkataDate(l.createdAt)
              ?: isoToKolkataDate(l.updatedAt)
          if (payDate == null) return@mapNotNull null
          if (payDate.isBefore(start) || payDate.isAfter(end)) return@mapNotNull null
          l to payDate
        }
        .sortedByDescending { (_, d) -> d }
    }

  val totals =
    remember(closed) {
      var principal = 0L
      var interest = 0L
      var commission = 0L
      closed.forEach { (l, _) ->
        val p = l.loanDetails?.principal ?: l.loanAmount ?: 0L
        val i = l.loanDetails?.interest ?: 0L
        val c = l.loanDetails?.commissionAmount ?: 0L
        principal += p
        interest += i
        commission += c
      }
      val profit = interest - commission
      Totals(principal = principal, interest = interest, commission = commission, profit = profit)
    }

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

    LoanBookFilters(
      start = start,
      end = end,
      loading = loading,
      onPickStart = { start = it },
      onPickEnd = { end = it },
      onReload = { scope.launch { load() } },
    )

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      SummaryTile(label = "Deals", value = closed.size.toString(), modifier = Modifier.weight(1f))
      SummaryTile(label = "Principal", value = formatInr(totals.principal), modifier = Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
      SummaryTile(label = "Interest", value = formatInr(totals.interest), modifier = Modifier.weight(1f))
      SummaryTile(label = "Profit", value = formatInr(totals.profit), modifier = Modifier.weight(1f))
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Disbursement register", style = MaterialTheme.typography.titleMedium)

        if (loading && closed.isEmpty()) {
          Text(
            "Loading…",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else if (closed.isEmpty()) {
          Text(
            "No disbursements found in this date range.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(closed) { (lead, payDate) ->
              LoanBookRow(
                lead = lead,
                paymentDate = payDate,
                mediatorName = lead.mediatorId?.let { mediatorNames[it] } ?: "Direct",
                onEditCommission = {
                  editing = lead
                  commissionDraft = (lead.loanDetails?.commissionAmount ?: 0L).toString()
                  editError = null
                },
              )
            }
          }
          Spacer(Modifier.height(4.dp))
        }
      }
    }
  }

  val editLead = editing
  if (editLead != null) {
    AlertDialog(
      onDismissRequest = { if (!editBusy) editing = null },
      title = { Text("Edit commission") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(
            "${editLead.name} • ${editLead.company.orEmpty()}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          OutlinedTextField(
            value = commissionDraft,
            onValueChange = { commissionDraft = it },
            label = { Text("Commission amount (₹)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
          )
          if (!editError.isNullOrBlank()) {
            Text(
              editError.orEmpty(),
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.error,
            )
          }
        }
      },
      confirmButton = {
        Button(
          onClick = {
            val next = commissionDraft.trim().toLongOrNull()
            if (next == null || next < 0) {
              editError = "Enter a valid commission amount."
              return@Button
            }
            editBusy = true
            editError = null
            scope.launch {
              val result = runCatching {
                val current = editLead.loanDetails ?: LoanDetails()
                val updatedDetails = current.copy(commissionAmount = next)
                val now = java.time.Instant.now().toString()
                val note = LeadNote(text = "[TERMS]: Commission updated to ₹$next", date = now)
                leadsRepository.updateLead(
                  editLead.id,
                  LeadUpdate(
                    loanDetails = updatedDetails,
                    notes = (editLead.notes + note).takeLast(500),
                  ),
                )
              }
              result.onSuccess {
                editing = null
              }.onFailure { ex ->
                val current = editLead.loanDetails ?: LoanDetails()
                val updatedDetails = current.copy(commissionAmount = next)
                val now = java.time.Instant.now().toString()
                val note = LeadNote(text = "[TERMS]: Commission updated to ₹$next", date = now)

                RetryQueueStore.enqueueLeadUpdate(
                  ctx.applicationContext,
                  editLead.id,
                  LeadUpdate(loanDetails = updatedDetails),
                )
                RetryQueueStore.enqueueLeadAppendNote(ctx.applicationContext, editLead.id, note)
                RetrySyncScheduler.enqueueNow(ctx.applicationContext)
                Toast.makeText(ctx, "Saved offline — will sync when online.", Toast.LENGTH_LONG).show()
                editing = null
              }
              if (result.isSuccess) load()
              editBusy = false
            }
          },
          enabled = !editBusy,
        ) {
          Text(if (editBusy) "Saving…" else "Save")
        }
      },
      dismissButton = {
        TextButton(
          onClick = { if (!editBusy) editing = null },
          enabled = !editBusy,
        ) {
          Text("Cancel")
        }
      },
    )
  }
}

@Composable
private fun LoanBookFilters(
  start: LocalDate,
  end: LocalDate,
  loading: Boolean,
  onPickStart: (LocalDate) -> Unit,
  onPickEnd: (LocalDate) -> Unit,
  onReload: () -> Unit,
) {
  val ctx = androidx.compose.ui.platform.LocalContext.current

  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text("Period", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        IconButton(
          onClick = onReload,
          enabled = !loading,
        ) {
          Icon(Icons.Outlined.Refresh, contentDescription = "Reload")
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        SummaryTile(
          label = "From",
          value = start.toString(),
          modifier = Modifier.weight(1f),
          onClick = { showDatePicker(ctx, initial = start, onSelected = onPickStart) },
        )
        SummaryTile(
          label = "To",
          value = end.toString(),
          modifier = Modifier.weight(1f),
          onClick = { showDatePicker(ctx, initial = end, onSelected = onPickEnd) },
        )
      }
    }
  }
}

@Composable
private fun SummaryTile(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
) {
  val click = onClick
  Card(
    modifier = modifier,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    onClick = click ?: {},
    enabled = click != null,
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(value, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
    }
  }
}

@Composable
private fun LoanBookRow(
  lead: Lead,
  paymentDate: LocalDate,
  mediatorName: String,
  onEditCommission: () -> Unit,
) {
  val p = lead.loanDetails?.principal ?: lead.loanAmount ?: 0L
  val i = lead.loanDetails?.interest ?: 0L
  val c = lead.loanDetails?.commissionAmount ?: 0L
  val profit = i - c

  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(lead.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        LeadStatusPill(status = lead.status)
      }
      Text(
        "Paid: $paymentDate • $mediatorName",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        StatInline(label = "Principal", value = formatInr(p), modifier = Modifier.weight(1f))
        StatInline(label = "Interest", value = formatInr(i), modifier = Modifier.weight(1f))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        StatInline(label = "Comm.", value = formatInr(c), modifier = Modifier.weight(1f))
        StatInline(label = "Profit", value = formatInr(profit), modifier = Modifier.weight(1f))
      }

      TextButton(onClick = onEditCommission) {
        Text("Edit commission")
      }
    }
  }
}

@Composable
private fun StatInline(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
    Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(value, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onBackground)
  }
}

private data class Totals(
  val principal: Long,
  val interest: Long,
  val commission: Long,
  val profit: Long,
)

private fun formatInr(amount: Long): String {
  val fmt = NumberFormat.getNumberInstance(Locale("en", "IN"))
  return "₹${fmt.format(amount)}"
}
