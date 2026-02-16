package com.jubilant.lirasnative.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Box

enum class PipelineStage(val label: String) {
  Lead("Lead"),
  Underwriting("UW"),
  PD("PD"),
  Approval("Approval"),
  Loan("Loan"),
}

@Composable
fun StatusPipelineBar(
  current: PipelineStage,
  modifier: Modifier = Modifier,
  activeColor: Color = MaterialTheme.colorScheme.secondary,
  inactiveColor: Color = MaterialTheme.colorScheme.outlineVariant,
) {
  val stages = PipelineStage.entries

  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      stages.forEachIndexed { idx, stage ->
        val reached = stage.ordinal <= current.ordinal
        val dotColor = if (reached) activeColor else inactiveColor
        val dotSize = if (stage == current) 12.dp else 10.dp

        Box(
          modifier =
            Modifier
              .size(dotSize)
              .background(dotColor, CircleShape),
        )

        if (idx < stages.lastIndex) {
          val connectorReached = stage.ordinal < current.ordinal
          Box(
            modifier =
              Modifier
                .height(2.dp)
                .weight(1f, fill = true)
                .background(if (connectorReached) activeColor else inactiveColor),
          )
        }
      }
    }

    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      stages.forEach { stage ->
        val reached = stage.ordinal <= current.ordinal
        val textColor =
          if (reached) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.onSurfaceVariant
        Text(
          text = stage.label,
          modifier = Modifier.weight(1f, fill = true),
          style = MaterialTheme.typography.labelSmall,
          color = textColor,
          textAlign = TextAlign.Center,
          maxLines = 1,
        )
      }
    }
  }
}

