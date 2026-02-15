package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import com.jubilant.lirasnative.shared.supabase.LeadSummary

@Composable
internal fun LeadMiniRow(
  lead: LeadSummary,
  onClick: () -> Unit,
) {
  val next = lead.nextFollowUp?.let(::formatShortDate).orEmpty()

  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
  ) {
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(lead.name, style = MaterialTheme.typography.titleSmall)
      val sub =
        listOfNotNull(lead.company?.takeIf { it.isNotBlank() }, lead.location?.takeIf { it.isNotBlank() }).joinToString(" • ")
      if (sub.isNotBlank()) {
        Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
    Column(horizontalAlignment = Alignment.End) {
      LeadStatusPill(status = lead.status)
      if (next.isNotBlank()) {
        Spacer(Modifier.height(6.dp))
        Text("Next: $next", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

