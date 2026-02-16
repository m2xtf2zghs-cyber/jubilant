package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.QuestionAnswer
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.ui.components.FintechCard
import com.jubilant.lirasnative.ui.components.SectionHeader

@Composable
fun PdHubScreen(
  onOpenUnderwriting: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    SectionHeader(
      title = "PD",
      subtitle = "Personal Discussion (PD) is created per underwriting run. Start from Underwriting to proceed to PD.",
    )

    FintechCard(modifier = Modifier.fillMaxWidth()) {
      Text(
        text = "How PD works",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurface,
      )
      Text(
        text =
          "1) Run underwriting (Bank/GST/ITR)\n" +
            "2) Review decision snapshot\n" +
            "3) Proceed to PD\n" +
            "4) Resolve dynamic doubts (if any) and save",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }

    Button(
      onClick = onOpenUnderwriting,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Icon(Icons.Outlined.Gavel, contentDescription = null)
      Spacer(Modifier.size(10.dp))
      Text("Open Underwriting")
    }

    FintechCard(modifier = Modifier.fillMaxWidth()) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(Icons.Outlined.QuestionAnswer, contentDescription = null)
        Text(
          text = "Tip: PD will show Auto‑Generated Doubts at the top based on underwriting flags (bank/GST/ITR).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
  }
}
