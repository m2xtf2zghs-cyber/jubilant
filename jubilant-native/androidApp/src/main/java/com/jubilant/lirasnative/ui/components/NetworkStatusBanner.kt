package com.jubilant.lirasnative.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.ui.util.NetworkStatus

@Composable
fun NetworkStatusBanner(
  status: NetworkStatus,
  lastUpdatedLabel: String?,
  pendingSyncCount: Int,
  onSyncNow: (() -> Unit)?,
  modifier: Modifier = Modifier,
) {
  val (bg, border, dot, label) =
    when (status) {
      NetworkStatus.Online -> {
        val dot = Color(0xFF16A34A)
        Quad(
          bg = MaterialTheme.colorScheme.surface,
          border = MaterialTheme.colorScheme.outlineVariant,
          dot = dot,
          label = "Online",
        )
      }

      NetworkStatus.PoorNetwork -> {
        val dot = Color(0xFFF59E0B)
        Quad(
          bg = dot.copy(alpha = 0.10f),
          border = dot.copy(alpha = 0.30f),
          dot = dot,
          label = "Poor network",
        )
      }

      NetworkStatus.Offline -> {
        val dot = Color(0xFFEF4444)
        Quad(
          bg = dot.copy(alpha = 0.10f),
          border = dot.copy(alpha = 0.30f),
          dot = dot,
          label = "Offline",
        )
      }
    }

  val metaParts = buildList {
    if (!lastUpdatedLabel.isNullOrBlank()) add("Updated $lastUpdatedLabel")
    if (pendingSyncCount > 0) add("$pendingSyncCount queued")
  }
  val meta = metaParts.joinToString(" • ")

  Card(
    modifier = modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = bg),
    border = BorderStroke(1.dp, border),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Card(
        shape = CircleShape,
        colors = CardDefaults.cardColors(containerColor = dot),
        border = BorderStroke(0.dp, Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = Modifier.size(10.dp),
      ) {}

      Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onBackground)

      if (meta.isNotBlank()) {
        Spacer(Modifier.width(4.dp))
        Text(meta, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }

      Spacer(Modifier.weight(1f))

      if (pendingSyncCount > 0 && onSyncNow != null) {
        TextButton(onClick = onSyncNow) { Text("Sync") }
      }
    }
  }
}

private data class Quad(
  val bg: Color,
  val border: Color,
  val dot: Color,
  val label: String,
)

