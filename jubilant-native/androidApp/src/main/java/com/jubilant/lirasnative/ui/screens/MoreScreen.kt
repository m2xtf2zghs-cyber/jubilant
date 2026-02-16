package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.QuestionAnswer
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material.icons.outlined.Timeline
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
  onOpenStatementAutopilot: () -> Unit,
  onOpenPd: () -> Unit,
  onOpenCollections: () -> Unit,
  onOpenLoanBook: () -> Unit,
  onOpenReports: () -> Unit,
  onOpenNetwork: () -> Unit,
  onOpenTasks: () -> Unit,
  onOpenActivities: () -> Unit,
  onOpenSettings: () -> Unit,
  onOpenAdminAccess: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val scroll = rememberScrollState()
  Column(
    modifier = modifier.verticalScroll(scroll),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SectionHeader(
      title = "More",
      subtitle = "All operating modules in one place.",
    )

    ActionTile(
      label = "Statement Autopilot (Web)",
      subtitle = "Open Statement Autopilot in web app",
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
      label = "Loan Book",
      subtitle = "Portfolio and account-level loan visibility",
      icon = { Icon(Icons.Outlined.Book, contentDescription = null) },
      onClick = onOpenLoanBook,
    )

    ActionTile(
      label = "Reports",
      subtitle = "Monthly / quarterly exports + summaries",
      icon = { Icon(Icons.Outlined.FactCheck, contentDescription = null) },
      onClick = onOpenReports,
    )

    ActionTile(
      label = "Network",
      subtitle = "Partners + Mediators",
      icon = { Icon(Icons.Outlined.Groups, contentDescription = null) },
      onClick = onOpenNetwork,
    )

    ActionTile(
      label = "Tasks",
      subtitle = "My day queue and owner follow-ups",
      icon = { Icon(Icons.Outlined.TaskAlt, contentDescription = null) },
      onClick = onOpenTasks,
    )

    ActionTile(
      label = "Activities",
      subtitle = "Recent operations trail",
      icon = { Icon(Icons.Outlined.Timeline, contentDescription = null) },
      onClick = onOpenActivities,
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
