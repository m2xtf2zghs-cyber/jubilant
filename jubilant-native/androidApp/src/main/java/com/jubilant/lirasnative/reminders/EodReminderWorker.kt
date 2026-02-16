package com.jubilant.lirasnative.reminders

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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
    ReminderNotifications.ensureChannel(appContext)

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
      NotificationCompat.Builder(appContext, ReminderNotifications.CHANNEL_ID)
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

  companion object {
    const val NOTIFICATION_ID = 1001
  }
}
