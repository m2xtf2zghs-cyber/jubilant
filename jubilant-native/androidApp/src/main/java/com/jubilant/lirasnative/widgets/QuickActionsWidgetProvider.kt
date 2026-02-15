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

class QuickActionsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    appWidgetIds.forEach { widgetId ->
      val views = RemoteViews(context.packageName, R.layout.widget_quick_actions)

      views.setOnClickPendingIntent(R.id.action_new_lead, routeIntent(context, "lead_new", requestCode = 101))
      views.setOnClickPendingIntent(R.id.action_my_day, routeIntent(context, "my_day", requestCode = 102))
      views.setOnClickPendingIntent(R.id.action_eod, routeIntent(context, "eod", requestCode = 103))
      views.setOnClickPendingIntent(R.id.action_scan_doc, routeIntent(context, "scan_doc", requestCode = 104))

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
}

