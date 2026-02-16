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
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.LeadsCacheStore
import com.jubilant.lirasnative.ui.util.isoToKolkataDate
import java.time.LocalDate

class MorningActionsWorker(
  private val appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    ReminderNotifications.ensureChannel(appContext)

    val leads = LeadsCacheStore.load(appContext)
    if (leads.isEmpty()) return Result.success()

    val closedStatuses = setOf("Payment Done", "Deal Closed")
    val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")
    val today: LocalDate = LocalDate.now(KOLKATA_ZONE)

    val actionable =
      leads.filterNot { (it.status ?: "").trim() in closedStatuses || (it.status ?: "").trim() in rejectedStatuses }

    val followUpsToday = actionable.count { isoToKolkataDate(it.nextFollowUp)?.isEqual(today) == true }
    val overdue = actionable.count { isoToKolkataDate(it.nextFollowUp)?.isBefore(today) == true }
    val meetingsToday =
      actionable.count {
        (it.status ?: "").trim() == "Meeting Scheduled" && isoToKolkataDate(it.nextFollowUp)?.isEqual(today) == true
      }

    // Avoid noisy notifications when there’s nothing to act on.
    if (followUpsToday == 0 && overdue == 0 && meetingsToday == 0) return Result.success()

    val intent =
      Intent(appContext, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(MainActivity.EXTRA_NAV_ROUTE, "collections")
      }

    val pendingIntent =
      PendingIntent.getActivity(
        appContext,
        101,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val notification =
      NotificationCompat.Builder(appContext, ReminderNotifications.CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_launcher)
        .setContentTitle("Jubilant Capital • Today’s actions")
        .setContentText("Follow-ups: $followUpsToday • Meetings: $meetingsToday • Overdue: $overdue")
        .setStyle(
          NotificationCompat.BigTextStyle().bigText(
            "Today (IST)\nFollow-ups: $followUpsToday\nMeetings: $meetingsToday\nOverdue: $overdue",
          ),
        )
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .build()

    NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID, notification)
    return Result.success()
  }

  companion object {
    const val NOTIFICATION_ID = 1002
  }
}
