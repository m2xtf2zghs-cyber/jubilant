package com.jubilant.lirasnative.reminders

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import java.time.Duration
import java.time.LocalDateTime
import java.util.concurrent.TimeUnit

object ReminderScheduler {
  private const val WORK_EOD = "eod_reminder"

  fun scheduleDailyEodReminder(context: Context, hour: Int = 18, minute: Int = 0) {
    val now = LocalDateTime.now(KOLKATA_ZONE)
    var next = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
    if (!next.isAfter(now)) next = next.plusDays(1)

    val delayMs = Duration.between(now, next).toMillis().coerceAtLeast(0L)

    val request =
      PeriodicWorkRequestBuilder<EodReminderWorker>(24, TimeUnit.HOURS)
        .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      WORK_EOD,
      ExistingPeriodicWorkPolicy.UPDATE,
      request,
    )
  }

  fun cancelDailyEodReminder(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_EOD)
  }
}

