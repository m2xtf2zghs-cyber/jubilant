package com.jubilant.lirasnative.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import com.jubilant.lirasnative.MainActivity
import com.jubilant.lirasnative.R
import com.jubilant.lirasnative.ui.util.KEY_SESSION_ROLE
import com.jubilant.lirasnative.ui.util.PREFS_NAME

class QuickActionsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val role = prefs.getString(KEY_SESSION_ROLE, "")?.trim()?.lowercase().orEmpty()

    appWidgetIds.forEach { widgetId ->
      val views = RemoteViews(context.packageName, R.layout.widget_quick_actions)

      val actions = actionsForRole(role)
      views.setTextViewText(R.id.action_new_lead, actions[0].label)
      views.setTextViewText(R.id.action_my_day, actions[1].label)
      views.setTextViewText(R.id.action_eod, actions[2].label)
      views.setTextViewText(R.id.action_scan_doc, actions[3].label)

      views.setOnClickPendingIntent(R.id.action_new_lead, routeIntent(context, actions[0].route, requestCode = 101))
      views.setOnClickPendingIntent(R.id.action_my_day, routeIntent(context, actions[1].route, requestCode = 102))
      views.setOnClickPendingIntent(R.id.action_eod, routeIntent(context, actions[2].route, requestCode = 103))
      views.setOnClickPendingIntent(R.id.action_scan_doc, routeIntent(context, actions[3].route, requestCode = 104))

      // Tap the header to open the app (dashboard).
      views.setOnClickPendingIntent(R.id.widget_root, routeIntent(context, "dashboard", requestCode = 105))

      appWidgetManager.updateAppWidget(widgetId, views)
    }
  }

  private fun routeIntent(context: Context, route: String, requestCode: Int): PendingIntent {
    val intent =
      Intent(context, MainActivity::class.java).apply {
        putExtra(MainActivity.EXTRA_NAV_ROUTE, route)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }

    val flags =
      PendingIntent.FLAG_UPDATE_CURRENT or
        if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0

    return PendingIntent.getActivity(context, requestCode, intent, flags)
  }

  private fun actionsForRole(role: String): List<WidgetAction> {
    return when (role) {
      "admin" -> listOf(
        WidgetAction("Reports", "reports"),
        WidgetAction("Network", "crm_network?tab=Partners"),
        WidgetAction("Admin", "admin_access"),
        WidgetAction("PD", "pd_worklist"),
      )
      "owner" -> listOf(
        WidgetAction("Loan Book", "loan_book"),
        WidgetAction("Reports", "reports"),
        WidgetAction("Collections", "collections"),
        WidgetAction("Network", "crm_network?tab=Partners"),
      )
      else -> listOf(
        WidgetAction("New Lead", "lead_new"),
        WidgetAction("My Day", "my_day"),
        WidgetAction("PD", "pd_worklist"),
        WidgetAction("Scan Doc", "scan_doc"),
      )
    }
  }

  data class WidgetAction(
    val label: String,
    val route: String,
  )

  companion object {
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val provider = android.content.ComponentName(context, QuickActionsWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(provider)
      if (ids.isNotEmpty()) {
        Intent(context, QuickActionsWidgetProvider::class.java).also { intent ->
          intent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
          intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
          context.sendBroadcast(intent)
        }
      }
    }
  }
}
