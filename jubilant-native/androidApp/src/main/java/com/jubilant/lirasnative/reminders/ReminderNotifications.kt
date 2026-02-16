package com.jubilant.lirasnative.reminders

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

object ReminderNotifications {
  const val CHANNEL_ID = "reminders"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = nm.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "Reminders",
        NotificationManager.IMPORTANCE_DEFAULT,
      ).apply {
        description = "Reminders for follow-ups, meetings, and end-of-day clearance."
      }

    nm.createNotificationChannel(channel)
  }
}

