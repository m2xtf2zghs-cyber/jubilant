package com.jubilant.lirasnative.widgets

import android.content.Context
import android.content.Intent
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import com.jubilant.lirasnative.MainActivity
import com.jubilant.lirasnative.R

object RoleShortcutsManager {
  fun refresh(context: Context, role: String?) {
    val normalized = role?.trim()?.lowercase().orEmpty()
    val shortcuts =
      when (normalized) {
        "admin" -> adminShortcuts(context)
        "owner" -> ownerShortcuts(context)
        else -> staffShortcuts(context)
      }
    runCatching { ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts) }
  }

  private fun staffShortcuts(context: Context): List<ShortcutInfoCompat> {
    return listOf(
      shortcut(context, id = "staff_my_day", shortLabel = "My Day", longLabel = "Open My Day queue", route = "my_day"),
      shortcut(context, id = "staff_collections", shortLabel = "Collections", longLabel = "Open collections queue", route = "collections"),
      shortcut(context, id = "staff_pd", shortLabel = "PD", longLabel = "Open PD worklist", route = "pd_worklist"),
      shortcut(context, id = "staff_scan", shortLabel = "Scan Doc", longLabel = "Upload lead document", route = "scan_doc"),
    )
  }

  private fun adminShortcuts(context: Context): List<ShortcutInfoCompat> {
    return listOf(
      shortcut(context, id = "admin_reports", shortLabel = "Reports", longLabel = "Open reports", route = "reports"),
      shortcut(context, id = "admin_network", shortLabel = "Network", longLabel = "Open CRM network", route = "crm_network?tab=Partners"),
      shortcut(context, id = "admin_tools", shortLabel = "Admin", longLabel = "Open admin tools", route = "admin_access"),
      shortcut(context, id = "admin_pd", shortLabel = "PD", longLabel = "Open PD worklist", route = "pd_worklist"),
    )
  }

  private fun ownerShortcuts(context: Context): List<ShortcutInfoCompat> {
    return listOf(
      shortcut(context, id = "owner_loan_book", shortLabel = "Loan Book", longLabel = "Open loan book", route = "loan_book"),
      shortcut(context, id = "owner_reports", shortLabel = "Reports", longLabel = "Open reports", route = "reports"),
      shortcut(context, id = "owner_collections", shortLabel = "Collections", longLabel = "Open collections", route = "collections"),
      shortcut(context, id = "owner_network", shortLabel = "Network", longLabel = "Open CRM network", route = "crm_network?tab=Partners"),
    )
  }

  private fun shortcut(
    context: Context,
    id: String,
    shortLabel: String,
    longLabel: String,
    route: String,
  ): ShortcutInfoCompat {
    val intent =
      Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(MainActivity.EXTRA_NAV_ROUTE, route)
      }
    return ShortcutInfoCompat.Builder(context, id)
      .setShortLabel(shortLabel)
      .setLongLabel(longLabel)
      .setIcon(IconCompat.createWithResource(context, R.drawable.ic_launcher))
      .setIntent(intent)
      .build()
  }
}

