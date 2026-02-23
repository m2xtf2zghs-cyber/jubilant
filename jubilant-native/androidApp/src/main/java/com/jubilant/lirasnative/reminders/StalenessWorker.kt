package com.jubilant.lirasnative.reminders

import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jubilant.lirasnative.R
import com.jubilant.lirasnative.ui.util.CrmAutomations
import com.jubilant.lirasnative.ui.util.LeadsCacheStore
import com.jubilant.lirasnative.ui.util.StalenessLevel

class StalenessWorker(
    private val appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        ReminderNotifications.ensureChannel(appContext)

        val leads = LeadsCacheStore.load(appContext)
        if (leads.isEmpty()) return Result.success()

        val criticalLeads = leads.filter { 
            // We need to convert LeadSummary to Lead or have a summary version of getStalenessStatus
            // For now, let's assume we can check updatedAt/createdAt
            val lastUpdate = it.updatedAt ?: it.createdAt ?: return@filter false
            val hoursOld = java.time.temporal.ChronoUnit.HOURS.between(
                java.time.Instant.parse(lastUpdate), 
                java.time.Instant.now()
            )
            hoursOld > 72
        }

        if (criticalLeads.isNotEmpty()) {
            val notification = NotificationCompat.Builder(appContext, ReminderNotifications.CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Urgent: Stale Leads Found")
                .setContentText("${criticalLeads.size} leads require immediate attention.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID, notification)
        }

        return Result.success()
    }

    companion object {
        const val NOTIFICATION_ID = 1003
    }
}
