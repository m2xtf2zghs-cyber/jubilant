package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContactPage
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.QuestionAnswer
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.ui.components.ActionTile
import com.jubilant.lirasnative.ui.components.SectionHeader

@Composable
fun MoreTab(
  session: SessionState,
  onOpenUnderwriting: () -> Unit,
  onOpenStatementAutopilot: () -> Unit,
  onOpenPd: () -> Unit,
  onOpenCollections: () -> Unit,
  onOpenReports: () -> Unit,
  onOpenCrmNetwork: () -> Unit,
  onOpenSettings: () -> Unit,
  onOpenAdminAccess: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    SectionHeader(
      title = "More",
      subtitle = "Underwriting, PD, reports, CRM network, and settings.",
    )

    ActionTile(
      label = "Underwriting",
      subtitle = "Run bank/GST/ITR checks and view credit memo",
      icon = { Icon(Icons.Outlined.Gavel, contentDescription = null) },
      onClick = onOpenUnderwriting,
    )

    ActionTile(
      label = "Statement Autopilot",
      subtitle = "Strict transaction capture + reconciliation",
      icon = { Icon(Icons.Outlined.Description, contentDescription = null) },
      onClick = onOpenStatementAutopilot,
    )

    ActionTile(
      label = "PD",
      subtitle = "Personal Discussion + dynamic doubts",
      icon = { Icon(Icons.Outlined.QuestionAnswer, contentDescription = null) },
      onClick = onOpenPd,
    )

    ActionTile(
      label = "Collections",
      subtitle = "Today’s collections + quick updates",
      icon = { Icon(Icons.Outlined.FactCheck, contentDescription = null) },
      onClick = onOpenCollections,
    )

    ActionTile(
      label = "Reports",
      subtitle = "Monthly / quarterly exports + summaries",
      icon = { Icon(Icons.Outlined.Description, contentDescription = null) },
      onClick = onOpenReports,
    )

    ActionTile(
      label = "CRM / Network",
      subtitle = "Partners, mediators, tasks, activities",
      icon = { Icon(Icons.Outlined.ContactPage, contentDescription = null) },
      onClick = onOpenCrmNetwork,
    )

    ActionTile(
      label = "Settings",
      subtitle = "Security, backups, reminders, tools",
      icon = { Icon(Icons.Outlined.Settings, contentDescription = null) },
      onClick = onOpenSettings,
    )

    if (session.isAdmin) {
      Spacer(Modifier.size(6.dp))
      Text("Admin", style = MaterialTheme.typography.titleMedium)
      ActionTile(
        label = "Admin tools",
        subtitle = "Staff & access controls",
        icon = { Icon(Icons.Outlined.ManageAccounts, contentDescription = null) },
        onClick = onOpenAdminAccess,
      )
    }
  }
}
