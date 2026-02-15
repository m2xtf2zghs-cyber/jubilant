package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.Calculate
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SettingsHubScreen(
  session: SessionState,
  onOpenSecurity: () -> Unit,
  onOpenDataTools: () -> Unit,
  onOpenCalculator: () -> Unit,
  onOpenReminders: () -> Unit,
  onOpenScanDoc: () -> Unit,
  onOpenAdminAccess: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Text("Settings", style = MaterialTheme.typography.titleMedium)
    Text(
      "Privacy, backups and device tools.",
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    SettingsRow(
      title = "Security & privacy",
      subtitle = "Biometric lock + screenshot blocking",
      icon = { Icon(Icons.Outlined.Security, contentDescription = null) },
      onClick = onOpenSecurity,
    )
    SettingsRow(
      title = "Backup & CSV",
      subtitle = "Export/import data (safe transfer)",
      icon = { Icon(Icons.Outlined.Backup, contentDescription = null) },
      onClick = onOpenDataTools,
    )
    SettingsRow(
      title = "Reminders",
      subtitle = "Daily notifications for EOD",
      icon = { Icon(Icons.Outlined.NotificationsActive, contentDescription = null) },
      onClick = onOpenReminders,
    )
    SettingsRow(
      title = "Interest calculator",
      subtitle = "Monthly / weekly / bi-weekly / bi-monthly",
      icon = { Icon(Icons.Outlined.Calculate, contentDescription = null) },
      onClick = onOpenCalculator,
    )
    SettingsRow(
      title = "Scan / upload doc",
      subtitle = "Upload PDF / image to a lead",
      icon = { Icon(Icons.Outlined.UploadFile, contentDescription = null) },
      onClick = onOpenScanDoc,
    )

    if (session.isAdmin) {
      Spacer(Modifier.size(8.dp))
      Text("Admin", style = MaterialTheme.typography.titleMedium)
      SettingsRow(
        title = "Staff & access",
        subtitle = "Create users, roles, password resets",
        icon = { Icon(Icons.Outlined.Security, contentDescription = null) },
        onClick = onOpenAdminAccess,
      )
    }
  }
}

@Composable
private fun SettingsRow(
  title: String,
  subtitle: String,
  icon: @Composable () -> Unit,
  onClick: () -> Unit,
) {
  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(14.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      icon()
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

