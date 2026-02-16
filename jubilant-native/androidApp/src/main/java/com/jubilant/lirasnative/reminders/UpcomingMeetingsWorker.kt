package com.jubilant.lirasnative.reminders

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jubilant.lirasnative.MainActivity
import com.jubilant.lirasnative.R
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.LeadsCacheStore
import com.jubilant.lirasnative.ui.util.isoToKolkataLocalDateTime
import com.jubilant.lirasnative.ui.util.snoozePrefKeyForLead
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class UpcomingMeetingsWorker(
  private val appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    ReminderNotifications.ensureChannel(appContext)

    val prefs = appContext.getSharedPreferences("liras_native_prefs", Context.MODE_PRIVATE)
    val todayKey = LocalDate.now(KOLKATA_ZONE).toString()

    val now: LocalDateTime = LocalDateTime.now(KOLKATA_ZONE).withSecond(0).withNano(0)
    val t = now.toLocalTime()
    // Keep background checks quiet at night.
    if (t.isBefore(java.time.LocalTime.of(7, 0)) || t.isAfter(java.time.LocalTime.of(22, 0))) {
      // Also clear old notification keys once per day.
      val existing = prefs.getStringSet(KEY_NOTIFIED, emptySet())?.toMutableSet() ?: mutableSetOf()
      val cleaned = existing.filter { it.startsWith(todayKey) }.toSet()
      if (cleaned.size != existing.size) prefs.edit().putStringSet(KEY_NOTIFIED, cleaned).apply()
      return Result.success()
    }

    val leads = LeadsCacheStore.load(appContext)
    if (leads.isEmpty()) return Result.success()

    val horizonMinutes = 45L
    val cutoff = now.plusMinutes(horizonMinutes)
    val nowMs = System.currentTimeMillis()

    val closedStatuses = setOf("Payment Done", "Deal Closed")
    val rejectedStatuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor")

    val upcoming =
      leads
        .asSequence()
        .filterNot { (it.status ?: "").trim() in closedStatuses || (it.status ?: "").trim() in rejectedStatuses }
        .filter { l ->
          val snoozeUntil = prefs.getLong(snoozePrefKeyForLead(l.id), 0L)
          snoozeUntil <= nowMs
        }
        .mapNotNull { l ->
          val dt = isoToKolkataLocalDateTime(l.nextFollowUp) ?: return@mapNotNull null
          l to dt
        }
        .filter { (_, dt) -> !dt.isBefore(now) && !dt.isAfter(cutoff) }
        .sortedBy { (_, dt) -> dt }
        .toList()

    if (upcoming.isEmpty()) return Result.success()

    val existing = prefs.getStringSet(KEY_NOTIFIED, emptySet())?.toMutableSet() ?: mutableSetOf()
    val cleaned = existing.filter { it.startsWith(todayKey) }.toMutableSet()

    val toNotify =
      upcoming.filter { (l, dt) ->
        val key = buildKey(todayKey, l.id, dt, (l.status ?: "").trim())
        if (cleaned.contains(key)) false else {
          cleaned.add(key)
          true
        }
      }

    if (toNotify.isEmpty()) {
      if (cleaned.size != existing.size) prefs.edit().putStringSet(KEY_NOTIFIED, cleaned).apply()
      return Result.success()
    }

    prefs.edit().putStringSet(KEY_NOTIFIED, cleaned).apply()

    val timeFmt = DateTimeFormatter.ofPattern("hh:mm a")
    val lines =
      toNotify.take(3).map { (l, dt) ->
        val tLabel = dt.toLocalTime().format(timeFmt)
        val kind = if ((l.status ?: "").trim() == "Meeting Scheduled") "Meeting" else "Follow-up"
        "$tLabel • $kind • ${l.name}"
      }
    val more = (toNotify.size - lines.size).coerceAtLeast(0)
    val body =
      if (more > 0) (lines + "+$more more").joinToString("\n") else lines.joinToString("\n")

    val targetRoute =
      if (toNotify.size == 1) "lead/${toNotify.first().first.id}" else "collections"

    val intent =
      Intent(appContext, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(MainActivity.EXTRA_NAV_ROUTE, targetRoute)
      }

    val pendingIntent =
      PendingIntent.getActivity(
        appContext,
        102,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val title =
      if (toNotify.size == 1) {
        val kind = if ((toNotify.first().first.status ?: "").trim() == "Meeting Scheduled") "Meeting" else "Follow-up"
        "$kind soon"
      } else {
        "Upcoming actions"
      }

    val notificationBuilder =
      NotificationCompat.Builder(appContext, ReminderNotifications.CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_launcher)
        .setContentTitle("Jubilant Capital • $title")
        .setContentText(lines.firstOrNull() ?: "Upcoming meeting")
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)

    val singleLead = toNotify.singleOrNull()?.first
    if (singleLead != null) {
      val markDoneIntent =
        Intent(appContext, ReminderActionReceiver::class.java).apply {
          action = ReminderActionReceiver.ACTION_MARK_DONE
          putExtra(ReminderActionReceiver.EXTRA_LEAD_ID, singleLead.id)
          putExtra(ReminderActionReceiver.EXTRA_NOTIFICATION_ID, NOTIFICATION_ID)
        }
      val markDonePending =
        PendingIntent.getBroadcast(
          appContext,
          2101,
          markDoneIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      notificationBuilder.addAction(0, "Mark done", markDonePending)

      val snoozeIntent =
        Intent(appContext, ReminderActionReceiver::class.java).apply {
          action = ReminderActionReceiver.ACTION_SNOOZE
          putExtra(ReminderActionReceiver.EXTRA_LEAD_ID, singleLead.id)
          putExtra(ReminderActionReceiver.EXTRA_NOTIFICATION_ID, NOTIFICATION_ID)
        }
      val snoozePending =
        PendingIntent.getBroadcast(
          appContext,
          2102,
          snoozeIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      notificationBuilder.addAction(0, "Snooze 30m", snoozePending)

      val digits = singleLead.phone?.filter { it.isDigit() }.orEmpty()
      if (digits.isNotBlank()) {
        val dialIntent =
          Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
          }
        val dialPending =
          PendingIntent.getActivity(
            appContext,
            2103,
            dialIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        notificationBuilder.addAction(0, "Call back", dialPending)
      }
    }

    val notification = notificationBuilder.build()

    NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID, notification)
    return Result.success()
  }

  private fun buildKey(todayKey: String, leadId: String, dt: LocalDateTime, status: String): String {
    // Store per-day to keep the set bounded and auto-expiring.
    return "$todayKey|$leadId|${dt.toString()}|$status"
  }

  companion object {
    private const val KEY_NOTIFIED = "meeting_reminder_notified_keys"
    const val NOTIFICATION_ID = 1003
  }
}
