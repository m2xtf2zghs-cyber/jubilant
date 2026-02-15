package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadCreateInput
import com.jubilant.lirasnative.shared.supabase.LeadNote
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.LoanDetails
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.LoanFrequency
import com.jubilant.lirasnative.ui.util.calculateInterestRatePercent
import com.jubilant.lirasnative.ui.util.followUpAt50PctTerm
import com.jubilant.lirasnative.ui.util.formatTenureShort
import com.jubilant.lirasnative.ui.util.frequencyTenureLabel
import com.jubilant.lirasnative.ui.util.showDatePicker
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.launch

private enum class LeadEntryType(
  val label: String,
) {
  New("New"),
  Renewal("Renewal / Existing"),
}

@Composable
fun LeadFormScreen(
  leadsRepository: LeadsRepository,
  mediators: List<Mediator>,
  leadId: String?,
  onCancel: () -> Unit,
  onSaved: (Lead) -> Unit,
) {
  val scope = rememberCoroutineScope()
  val context = LocalContext.current

  var loading by remember { mutableStateOf(leadId != null) }
  var busy by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }

  var name by remember { mutableStateOf("") }
  var phone by remember { mutableStateOf("") }
  var company by remember { mutableStateOf("") }
  var location by remember { mutableStateOf("") }
  var loanAmount by remember { mutableStateOf("") }

  var mediatorExpanded by remember { mutableStateOf(false) }
  var mediatorId by remember { mutableStateOf<String?>(null) }

  var entryType by remember { mutableStateOf(LeadEntryType.New) }
  var principal by remember { mutableStateOf("100000") }
  var interest by remember { mutableStateOf("0") }
  var commission by remember { mutableStateOf("0") }
  var tenureMonths by remember { mutableStateOf("12") }
  var frequency by remember { mutableStateOf(LoanFrequency.Monthly) }
  var paymentDate by remember { mutableStateOf(LocalDate.now(KOLKATA_ZONE)) }

  LaunchedEffect(leadId) {
    if (leadId == null) return@LaunchedEffect
    loading = true
    error = null
    val lead =
      runCatching { leadsRepository.getLead(leadId) }
        .onFailure { error = it.message ?: "Couldn’t load lead." }
        .getOrNull()
    if (lead != null) {
      name = lead.name
      phone = lead.phone.orEmpty()
      company = lead.company.orEmpty()
      location = lead.location.orEmpty()
      loanAmount = (lead.loanAmount ?: 0L).takeIf { it > 0 }?.toString().orEmpty()
      mediatorId = lead.mediatorId
    }
    loading = false
  }

  val mediatorName =
    mediatorId?.let { id -> mediators.firstOrNull { it.id == id }?.name }
      ?: "Direct / None"

  fun save() {
    val n = name.trim()
    if (n.isEmpty()) {
      error = "Client name is required."
      return
    }

    scope.launch {
      busy = true
      error = null

      val amt = loanAmount.trim().toLongOrNull()
      val nextFollowUp =
        if (leadId == null) {
          LocalDate.now(KOLKATA_ZONE).plusDays(1).atStartOfDay(KOLKATA_ZONE).toInstant().toString()
        } else {
          null
        }

      val result =
        if (leadId == null) {
          val now = java.time.Instant.now().toString()
          if (entryType == LeadEntryType.Renewal) {
            val given = principal.trim().toLongOrNull() ?: 0L
            val i = interest.trim().toLongOrNull() ?: 0L
            val c = commission.trim().toLongOrNull() ?: 0L
            val m = tenureMonths.trim().toIntOrNull()?.coerceAtLeast(1) ?: 12
            val p = (given + i).coerceAtLeast(0L)
            val rateValue = calculateInterestRatePercent(given = given.toDouble(), interest = i.toDouble(), weeks = m.toDouble(), frequency = frequency)
            val rate = String.format("%.2f", rateValue)

            val payIso = paymentDate.atStartOfDay(KOLKATA_ZONE).toInstant().toString()
            val fuDate = followUpAt50PctTerm(paymentDate, m, frequency)
            val fuIso = fuDate.atStartOfDay(KOLKATA_ZONE).toInstant().toString()
            val note =
              "[RENEWAL ADDED]: Given ₹$given. Upfront Interest ₹$i. Principal ₹$p. Net Cash Out ₹$p. Payment date: $paymentDate. Terms: ${formatTenureShort(m, frequency)} (${frequency.label}) @ $rate% rate. Comm: ₹$c. Follow-up set for 50% term."

            leadsRepository.createLead(
              LeadCreateInput(
                name = n,
                phone = phone.trim().takeIf { it.isNotBlank() },
                company = company.trim().takeIf { it.isNotBlank() },
                location = location.trim().takeIf { it.isNotBlank() },
                status = "Payment Done",
                loanAmount = p,
                nextFollowUp = fuIso,
                mediatorId = mediatorId,
                loanDetails =
                  LoanDetails(
                    principal = p,
                    interest = i,
                    // Business rule: Net cash out is Principal (= Given + Upfront interest).
                    netDisbursed = p,
                    tenure = m,
                    frequency = frequency.label,
                    rate = rate,
                    paymentDate = payIso,
                    commissionAmount = c,
                  ),
                notes = listOf(LeadNote(text = note, date = now)),
              ),
            )
          } else {
            leadsRepository.createLead(
              LeadCreateInput(
                name = n,
                phone = phone.trim().takeIf { it.isNotBlank() },
                company = company.trim().takeIf { it.isNotBlank() },
                location = location.trim().takeIf { it.isNotBlank() },
                status = "New",
                loanAmount = amt,
                nextFollowUp = nextFollowUp,
                mediatorId = mediatorId,
                notes = listOf(LeadNote(text = "Lead created", date = now)),
              ),
            )
          }
        } else {
          leadsRepository.updateLead(
            leadId,
            LeadUpdate(
              name = n,
              phone = phone.trim().takeIf { it.isNotBlank() },
              company = company.trim().takeIf { it.isNotBlank() },
              location = location.trim().takeIf { it.isNotBlank() },
              loanAmount = amt,
              mediatorId = mediatorId,
            ),
          )
        }

      if (result != null) {
        onSaved(result)
      }
      busy = false
    }
  }

  if (loading) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(24.dp),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      CircularProgressIndicator()
    }
    return
  }

  val scroll = rememberScrollState()
  Column(modifier = Modifier.fillMaxWidth().verticalScroll(scroll).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
    ) {
      Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (leadId == null) "Add lead" else "Edit lead", style = MaterialTheme.typography.titleLarge)

        if (leadId == null) {
          Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            LeadEntryType.entries.forEach { t ->
              FilterChip(
                selected = entryType == t,
                onClick = { entryType = t },
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
                    selected = entryType == t,
                    borderColor = MaterialTheme.colorScheme.outlineVariant,
                    selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                  ),
              )
            }
          }
        }

        if (!error.isNullOrBlank()) {
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

        val tfColors =
          TextFieldDefaults.colors(
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
            unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
            focusedTextColor = MaterialTheme.colorScheme.onSurface,
            unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
            focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
            unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
          )

        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Client name") }, singleLine = true, colors = tfColors)
        OutlinedTextField(value = company, onValueChange = { company = it }, label = { Text("Company") }, singleLine = true, colors = tfColors)
        OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), colors = tfColors)
        OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Location") }, singleLine = true, colors = tfColors)

        if (leadId != null || entryType == LeadEntryType.New) {
          OutlinedTextField(value = loanAmount, onValueChange = { loanAmount = it }, label = { Text("Loan amount (₹)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = tfColors)
        } else {
          Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
          ) {
            Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
              Text("Renewal terms", style = MaterialTheme.typography.titleMedium)

              Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                LoanFrequency.entries.forEach { f ->
                  FilterChip(
                    selected = frequency == f,
                    onClick = { frequency = f },
                    label = { Text(f.label) },
                    colors =
                      FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                        selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                      ),
                    border =
                      FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = frequency == f,
                        borderColor = MaterialTheme.colorScheme.outlineVariant,
                        selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                      ),
                  )
                }
              }

              OutlinedTextField(value = principal, onValueChange = { principal = it }, label = { Text("Given amount") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = tfColors)
              OutlinedTextField(value = interest, onValueChange = { interest = it }, label = { Text("Upfront interest") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = tfColors)
              OutlinedTextField(value = commission, onValueChange = { commission = it }, label = { Text("Commission (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = tfColors)
              OutlinedTextField(value = tenureMonths, onValueChange = { tenureMonths = it }, label = { Text(frequencyTenureLabel(frequency)) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = tfColors)

              val computedPrincipal =
                remember(principal, interest) {
                  val g = principal.trim().toLongOrNull() ?: 0L
                  val i = interest.trim().toLongOrNull() ?: 0L
                  (g + i).coerceAtLeast(0L)
                }
              Text(
                "Principal (Given + interest): ₹$computedPrincipal",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )

              val rateValue =
                remember(principal, interest, tenureMonths, frequency) {
                  val givenNum = principal.trim().toDoubleOrNull() ?: 0.0
                  val interestNum = interest.trim().toDoubleOrNull() ?: 0.0
                  val weeksNum = tenureMonths.trim().toDoubleOrNull() ?: 0.0
                  calculateInterestRatePercent(given = givenNum, interest = interestNum, weeks = weeksNum, frequency = frequency)
                }
              Text(
                "Our interest rate: ${String.format("%.2f", rateValue)}%",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )

              Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Payment date: $paymentDate", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                Button(
                  onClick = {
                    showDatePicker(context = context, initial = paymentDate) { d -> paymentDate = d }
                  },
                ) {
                  Text("Pick")
                }
              }
            }
          }
        }

        Column {
          OutlinedTextField(
            readOnly = true,
            value = mediatorName,
            onValueChange = {},
            label = { Text("Mediator") },
            trailingIcon = {
              IconButton(onClick = { mediatorExpanded = !mediatorExpanded }) {
                Icon(Icons.Outlined.ArrowDropDown, contentDescription = null)
              }
            },
            modifier = Modifier.fillMaxWidth(),
            colors = tfColors,
          )

          DropdownMenu(expanded = mediatorExpanded, onDismissRequest = { mediatorExpanded = false }) {
            DropdownMenuItem(
              text = { Text("Direct / None") },
              onClick = {
                mediatorId = null
                mediatorExpanded = false
              },
            )
            mediators.forEach { m ->
              DropdownMenuItem(
                text = { Text(m.name) },
                onClick = {
                  mediatorId = m.id
                  mediatorExpanded = false
                },
              )
            }
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          TextButton(onClick = onCancel, enabled = !busy, modifier = Modifier.weight(1f)) { Text("Cancel") }
          Button(onClick = { save() }, enabled = !busy, modifier = Modifier.weight(1f)) {
            if (busy) {
              CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
              Spacer(Modifier.width(10.dp))
            } else {
              Icon(Icons.Outlined.Save, contentDescription = null)
              Spacer(Modifier.width(10.dp))
            }
            Text("Save")
          }
        }
      }
    }
  }
}
