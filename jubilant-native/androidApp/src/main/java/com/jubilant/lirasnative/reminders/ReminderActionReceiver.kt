package com.jubilant.lirasnative.reminders

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.jubilant.lirasnative.di.AppContainer
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.snoozePrefKeyForLead
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ReminderActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val safeIntent = intent ?: return
    val action = safeIntent.action.orEmpty()
    if (action.isBlank()) return
    val appContext = context.applicationContext
    val pendingResult = goAsync()
    CoroutineScope(Dispatchers.IO).launch {
      try {
        when (action) {
          ACTION_MARK_DONE -> markDone(appContext, safeIntent)
          ACTION_SNOOZE -> snooze(appContext, safeIntent)
        }
      } finally {
        pendingResult.finish()
      }
    }
  }

  private suspend fun markDone(context: Context, intent: Intent) {
    val leadId = intent.getStringExtra(EXTRA_LEAD_ID)?.trim().orEmpty()
    if (leadId.isBlank()) return
    val appContainer = AppContainer(context)
    val patch = LeadUpdate(status = "Deal Closed")
    runCatching {
      appContainer.leadsRepository.updateLead(leadId, patch)
    }.onFailure {
      RetryQueueStore.enqueueLeadUpdate(context, leadId, patch)
      RetrySyncScheduler.enqueueNow(context)
    }
    dismissNotification(context, intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0))
  }

  private fun snooze(context: Context, intent: Intent) {
    val leadId = intent.getStringExtra(EXTRA_LEAD_ID)?.trim().orEmpty()
    if (leadId.isBlank()) return
    val snoozeUntil = System.currentTimeMillis() + SNOOZE_MS
    val prefs = context.getSharedPreferences("liras_native_prefs", Context.MODE_PRIVATE)
    prefs.edit().putLong(snoozePrefKeyForLead(leadId), snoozeUntil).apply()
    dismissNotification(context, intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0))
  }

  private fun dismissNotification(context: Context, id: Int) {
    if (id <= 0) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(id)
  }

  companion object {
    const val ACTION_MARK_DONE: String = "com.jubilant.lirasnative.action.MARK_DONE"
    const val ACTION_SNOOZE: String = "com.jubilant.lirasnative.action.SNOOZE"
    const val EXTRA_LEAD_ID: String = "extra_lead_id"
    const val EXTRA_NOTIFICATION_ID: String = "extra_notification_id"
    const val EXTRA_PHONE: String = "extra_phone"

    private const val SNOOZE_MS: Long = 30 * 60 * 1000L
  }
}
