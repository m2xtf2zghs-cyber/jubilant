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
  private const val WORK_MORNING = "morning_actions"
  private const val WORK_MEETINGS = "upcoming_meetings"

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

  fun scheduleDailyMorningActions(context: Context, hour: Int = 9, minute: Int = 0) {
    val now = LocalDateTime.now(KOLKATA_ZONE)
    var next = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
    if (!next.isAfter(now)) next = next.plusDays(1)

    val delayMs = Duration.between(now, next).toMillis().coerceAtLeast(0L)

    val request =
      PeriodicWorkRequestBuilder<MorningActionsWorker>(24, TimeUnit.HOURS)
        .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      WORK_MORNING,
      ExistingPeriodicWorkPolicy.UPDATE,
      request,
    )
  }

  fun cancelDailyMorningActions(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_MORNING)
  }

  /**
   * Runs a lightweight periodic check for upcoming meetings.
   * Note: Uses WorkManager periodic scheduling (not exact alarms), so delivery may vary slightly.
   */
  fun scheduleUpcomingMeetingsWatcher(context: Context) {
    val request =
      PeriodicWorkRequestBuilder<UpcomingMeetingsWorker>(15, TimeUnit.MINUTES)
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      WORK_MEETINGS,
      ExistingPeriodicWorkPolicy.UPDATE,
      request,
    )
  }

  fun cancelUpcomingMeetingsWatcher(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_MEETINGS)
  }
}
