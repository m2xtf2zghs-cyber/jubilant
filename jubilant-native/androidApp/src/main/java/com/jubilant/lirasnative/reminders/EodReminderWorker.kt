package com.jubilant.lirasnative.reminders

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jubilant.lirasnative.MainActivity
import com.jubilant.lirasnative.R

class EodReminderWorker(
  private val appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    ensureChannel()

    val intent =
      Intent(appContext, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }

    val pendingIntent =
      PendingIntent.getActivity(
        appContext,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val notification =
      NotificationCompat.Builder(appContext, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_launcher)
        .setContentTitle("Jubilant Capital • End of Day")
        .setContentText("Review pending updates and export your daily report.")
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .build()

    NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID, notification)
    return Result.success()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = nm.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "Reminders",
        NotificationManager.IMPORTANCE_DEFAULT,
      ).apply {
        description = "Daily reminders for follow-ups and end-of-day clearance."
      }

    nm.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "reminders"
    const val NOTIFICATION_ID = 1001
  }
}

