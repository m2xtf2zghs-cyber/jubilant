package com.jubilant.lirasnative.ui.screens

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.PowerManager
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.sync.RetrySyncScheduler
import com.jubilant.lirasnative.ui.util.KOLKATA_ZONE
import com.jubilant.lirasnative.ui.util.KEY_SYNC_PAUSED
import com.jubilant.lirasnative.ui.util.PREFS_NAME
import com.jubilant.lirasnative.ui.util.RetryQueueAction
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import com.jubilant.lirasnative.ui.util.rememberRetryQueueCount
import java.time.Instant
import java.time.format.DateTimeFormatter

@Composable
fun SyncQueueScreen(
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val appContext = context.applicationContext
  val queuedCount = rememberRetryQueueCount()
  var actions by remember { mutableStateOf(emptyList<RetryQueueAction>()) }
  var showClearConfirm by remember { mutableStateOf(false) }
  val prefs = remember { appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
  var syncPaused by remember { mutableStateOf(prefs.getBoolean(KEY_SYNC_PAUSED, false)) }

  LaunchedEffect(queuedCount) {
    actions = RetryQueueStore.load(appContext).sortedByDescending { it.createdAtMs }
  }

  Column(modifier = modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text("Sync Center", style = MaterialTheme.typography.titleMedium)
        Text(
          "Pending offline updates: $queuedCount",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
          Text(
            if (syncPaused) "Sync paused" else "Sync active",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
          )
          Switch(
            checked = syncPaused,
            onCheckedChange = { checked ->
              syncPaused = checked
              prefs.edit().putBoolean(KEY_SYNC_PAUSED, checked).apply()
              if (checked) {
                RetrySyncScheduler.cancelPending(appContext)
              } else {
                RetrySyncScheduler.enqueueNow(appContext)
              }
            },
          )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
          Button(
            onClick = {
              RetrySyncScheduler.enqueueNow(appContext)
              Toast.makeText(context, "Sync requested.", Toast.LENGTH_SHORT).show()
            },
            modifier = Modifier.weight(1f),
          ) {
            Text("Sync now")
          }
          OutlinedButton(
            onClick = { showClearConfirm = true },
            modifier = Modifier.weight(1f),
            enabled = actions.isNotEmpty(),
          ) {
            Text("Clear queue")
          }
        }
        OutlinedButton(
          onClick = {
            RetrySyncScheduler.enqueueNow(appContext, force = true)
            Toast.makeText(context, "Emergency sync triggered.", Toast.LENGTH_SHORT).show()
          },
          modifier = Modifier.fillMaxWidth(),
          enabled = actions.isNotEmpty(),
        ) {
          Text("Emergency panic sync")
        }
      }
    }

    SyncAdvisorCard(
      batteryPercent = readBatteryPercent(appContext),
      networkQuality = readNetworkQuality(appContext),
      isPowerSave = isPowerSaveMode(appContext),
    )

    if (actions.isEmpty()) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
      ) {
        Text(
          "No pending actions. Everything is synced.",
          modifier = Modifier.fillMaxWidth().padding(14.dp),
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxWidth().weight(1f, fill = true),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        items(actions, key = { it.id }) { action ->
          QueueActionRow(
            action = action,
            onRetryNow = {
              RetrySyncScheduler.enqueueNow(appContext, actionId = action.id, force = true)
              Toast.makeText(context, "Queued retry for this item.", Toast.LENGTH_SHORT).show()
            },
          )
        }
      }
    }
  }

  if (showClearConfirm) {
    AlertDialog(
      onDismissRequest = { showClearConfirm = false },
      title = { Text("Clear sync queue?") },
      text = {
        Text(
          "This will remove all pending offline changes from this device queue.",
          style = MaterialTheme.typography.bodyMedium,
        )
      },
      confirmButton = {
        TextButton(
          onClick = {
            RetryQueueStore.clear(appContext)
            actions = emptyList()
            showClearConfirm = false
            Toast.makeText(context, "Sync queue cleared.", Toast.LENGTH_SHORT).show()
          },
        ) {
          Text("Clear")
        }
      },
      dismissButton = {
        TextButton(onClick = { showClearConfirm = false }) {
          Text("Cancel")
        }
      },
    )
  }
}

@Composable
private fun QueueActionRow(
  action: RetryQueueAction,
  onRetryNow: () -> Unit,
) {
  val title =
    when (action) {
      is RetryQueueAction.LeadUpdateAction -> "Lead update"
      is RetryQueueAction.LeadAppendNoteAction -> "Lead note"
      is RetryQueueAction.MediatorUpdateAction -> "Mediator update"
      is RetryQueueAction.PdMasterDraftAction -> "PD draft"
      is RetryQueueAction.PdDoubtAnswerAction -> "PD doubt answer"
    }

  val detail =
    when (action) {
      is RetryQueueAction.LeadUpdateAction -> "Lead: ${action.leadId.take(8)}"
      is RetryQueueAction.LeadAppendNoteAction -> "Lead: ${action.leadId.take(8)}"
      is RetryQueueAction.MediatorUpdateAction -> "Mediator: ${action.mediatorId.take(8)}"
      is RetryQueueAction.PdMasterDraftAction -> "Session: ${action.pdSessionId.take(8)}"
      is RetryQueueAction.PdDoubtAnswerAction -> "Question: ${action.questionId.take(8)}"
    }

  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(title, style = MaterialTheme.typography.titleSmall)
      Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(
        "Queued ${formatQueueTime(action.createdAtMs)}",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      OutlinedButton(onClick = onRetryNow, modifier = Modifier.fillMaxWidth()) {
        Text("Retry this item")
      }
    }
  }
}

@Composable
private fun SyncAdvisorCard(
  batteryPercent: Int?,
  networkQuality: String,
  isPowerSave: Boolean,
) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      val batteryLabel = batteryPercent?.let { "$it%" } ?: "Unknown"
      val powerSaveLabel = if (isPowerSave) " (Power saver ON)" else ""
      Text("Battery & Network Advisor", style = MaterialTheme.typography.titleSmall)
      Text(
        "Battery: $batteryLabel$powerSaveLabel",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        "Network: $networkQuality",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      if (isPowerSave || networkQuality.contains("offline", ignoreCase = true)) {
        Text(
          "Advice: keep app foreground while syncing and disable battery restrictions for reliable retries.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurface,
        )
      }
    }
  }
}

private val queueTimeFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM, HH:mm")

private fun formatQueueTime(createdAtMs: Long): String {
  return runCatching {
    Instant.ofEpochMilli(createdAtMs).atZone(KOLKATA_ZONE).format(queueTimeFormatter)
  }.getOrDefault("just now")
}

private fun readBatteryPercent(context: Context): Int? {
  val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return null
  val value = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
  return value.takeIf { it in 0..100 }
}

private fun isPowerSaveMode(context: Context): Boolean {
  val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
  return pm.isPowerSaveMode
}

private fun readNetworkQuality(context: Context): String {
  val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return "Unknown"
  val network = cm.activeNetwork ?: return "Offline"
  val caps = cm.getNetworkCapabilities(network) ?: return "Offline"
  val transport =
    when {
      caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Mobile data"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
      else -> "Unknown"
    }
  val metered = if (cm.isActiveNetworkMetered) "metered" else "unmetered"
  return "$transport ($metered)"
}
