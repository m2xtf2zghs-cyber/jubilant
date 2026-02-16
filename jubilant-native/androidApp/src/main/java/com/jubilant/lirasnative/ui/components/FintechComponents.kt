package com.jubilant.lirasnative.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val ScreenPadding = 16.dp
private val CardPadding = 16.dp

@Composable
fun SectionHeader(
  title: String,
  subtitle: String? = null,
  modifier: Modifier = Modifier,
  action: (@Composable () -> Unit)? = null,
) {
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
      Text(
        text = title,
        style = MaterialTheme.typography.titleLarge,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.weight(1f),
      )
      if (action != null) action()
    }
    if (!subtitle.isNullOrBlank()) {
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
  }
}

@Composable
fun FintechCard(
  modifier: Modifier = Modifier,
  contentPadding: Dp = CardPadding,
  containerColor: Color = MaterialTheme.colorScheme.surface,
  content: @Composable ColumnScope.() -> Unit,
) {
  Card(
    modifier = modifier,
    colors = CardDefaults.cardColors(containerColor = containerColor),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(contentPadding),
      verticalArrangement = Arrangement.spacedBy(10.dp),
      content = content,
    )
  }
}

@Composable
fun StatCard(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  accent: Color? = null,
  onClick: (() -> Unit)? = null,
) {
  val clickableModifier = if (onClick != null) modifier.clickable(onClick = onClick) else modifier
  FintechCard(modifier = clickableModifier, contentPadding = 14.dp) {
    Text(
      text = label,
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Text(
      text = value,
      style = MaterialTheme.typography.headlineSmall,
      color = accent ?: MaterialTheme.colorScheme.onSurface,
    )
  }
}

@Composable
fun ActionTile(
  label: String,
  subtitle: String,
  icon: @Composable () -> Unit,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  FintechCard(
    modifier = modifier.clickable(onClick = onClick),
    contentPadding = 14.dp,
    containerColor = MaterialTheme.colorScheme.surface,
  ) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      modifier = Modifier.fillMaxWidth(),
    ) {
      icon()
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      Icon(
        imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@Composable
fun ScreenSection(
  modifier: Modifier = Modifier,
  content: @Composable ColumnScope.() -> Unit,
) {
  Column(
    modifier = modifier.fillMaxWidth().padding(horizontal = ScreenPadding),
    verticalArrangement = Arrangement.spacedBy(16.dp),
    content = content,
  )
}
