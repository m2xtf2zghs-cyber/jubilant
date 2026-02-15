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
import androidx.compose.material.icons.outlined.Assessment
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.Calculate
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ContactPage
import androidx.compose.material.icons.outlined.DashboardCustomize
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Today
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
fun MoreTab(
  session: SessionState,
  onOpenKanban: () -> Unit,
  onOpenCalendar: () -> Unit,
  onOpenLoanBook: () -> Unit,
  onOpenAnalytics: () -> Unit,
  onOpenReports: () -> Unit,
  onOpenCrmNetwork: () -> Unit,
  onOpenSettings: () -> Unit,
  onOpenUnderwriting: () -> Unit,
  onOpenEod: () -> Unit,
  onOpenCalculator: () -> Unit,
  onOpenDataTools: () -> Unit,
  onOpenMyDay: () -> Unit,
  onOpenReminders: () -> Unit,
  onOpenScanDoc: () -> Unit,
  onOpenSecurity: () -> Unit,
  onOpenAdminAccess: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Text(
      text = "Core",
      style = MaterialTheme.typography.titleMedium,
      color = MaterialTheme.colorScheme.onBackground,
    )

    ModuleRow(
      title = "Reports",
      subtitle = "Monthly / quarterly / PDFs",
      icon = { Icon(Icons.Outlined.Description, contentDescription = null) },
      onClick = onOpenReports,
    )
    ModuleRow(
      title = "CRM / Network",
      subtitle = "Partners, mediators, tasks, activities",
      icon = { Icon(Icons.Outlined.ContactPage, contentDescription = null) },
      onClick = onOpenCrmNetwork,
    )
    ModuleRow(
      title = "Settings",
      subtitle = "Security, backups, reminders, tools",
      icon = { Icon(Icons.Outlined.Settings, contentDescription = null) },
      onClick = onOpenSettings,
    )

    if (session.isAdmin) {
      ModuleRow(
        title = "Admin tools",
        subtitle = "Staff & access controls",
        icon = { Icon(Icons.Outlined.ManageAccounts, contentDescription = null) },
        onClick = onOpenAdminAccess,
      )
    }

    Spacer(Modifier.size(8.dp))

    Text(
      text = "Operations",
      style = MaterialTheme.typography.titleMedium,
      color = MaterialTheme.colorScheme.onBackground,
    )

    ModuleRow(
      title = "Underwriting",
      subtitle = "Hardcoded rules + recovery intelligence",
      icon = { Icon(Icons.Outlined.Gavel, contentDescription = null) },
      onClick = onOpenUnderwriting,
    )
    ModuleRow(
      title = "End of day",
      subtitle = "Clear pending updates + export",
      icon = { Icon(Icons.Outlined.FactCheck, contentDescription = null) },
      onClick = onOpenEod,
    )
    ModuleRow(
      title = "Loan book",
      subtitle = "Closed deals register + totals",
      icon = { Icon(Icons.Outlined.MenuBook, contentDescription = null) },
      onClick = onOpenLoanBook,
    )
    ModuleRow(
      title = "Analytics",
      subtitle = "Conversion, pipeline health, partner stats",
      icon = { Icon(Icons.Outlined.Assessment, contentDescription = null) },
      onClick = onOpenAnalytics,
    )

    Spacer(Modifier.size(8.dp))

    Text(
      text = "Views",
      style = MaterialTheme.typography.titleMedium,
      color = MaterialTheme.colorScheme.onBackground,
    )

    ModuleRow(
      title = "Kanban board",
      subtitle = "Pipeline by status (fast scanning)",
      icon = { Icon(Icons.Outlined.DashboardCustomize, contentDescription = null) },
      onClick = onOpenKanban,
    )
    ModuleRow(
      title = "Calendar",
      subtitle = "Follow-ups and meetings by date",
      icon = { Icon(Icons.Outlined.CalendarMonth, contentDescription = null) },
      onClick = onOpenCalendar,
    )

    Spacer(Modifier.size(8.dp))

    Text(
      text = "Tools",
      style = MaterialTheme.typography.titleMedium,
      color = MaterialTheme.colorScheme.onBackground,
    )

    ModuleRow(
      title = "My Day",
      subtitle = "Today’s tasks + quick actions",
      icon = { Icon(Icons.Outlined.Today, contentDescription = null) },
      onClick = onOpenMyDay,
    )
    ModuleRow(
      title = "Reminders",
      subtitle = "Daily notifications for EOD",
      icon = { Icon(Icons.Outlined.NotificationsActive, contentDescription = null) },
      onClick = onOpenReminders,
    )
    ModuleRow(
      title = "Scan / upload doc",
      subtitle = "Upload PDF / image to a lead",
      icon = { Icon(Icons.Outlined.UploadFile, contentDescription = null) },
      onClick = onOpenScanDoc,
    )
    ModuleRow(
      title = "Interest calculator",
      subtitle = "Monthly / weekly / bi-weekly / bi-monthly",
      icon = { Icon(Icons.Outlined.Calculate, contentDescription = null) },
      onClick = onOpenCalculator,
    )
    ModuleRow(
      title = "Backup & CSV",
      subtitle = "Export/import data (safe transfer)",
      icon = { Icon(Icons.Outlined.Backup, contentDescription = null) },
      onClick = onOpenDataTools,
    )
    ModuleRow(
      title = "Security & privacy",
      subtitle = "Biometric lock + screenshot blocking",
      icon = { Icon(Icons.Outlined.Security, contentDescription = null) },
      onClick = onOpenSecurity,
    )
  }
}

@Composable
private fun ModuleRow(
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
