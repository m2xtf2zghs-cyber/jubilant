package com.jubilant.lirasnative.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.jubilant.lirasnative.reminders.ReminderScheduler

@Composable
fun RemindersScreen(
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val prefs = remember { context.getSharedPreferences("liras_native_prefs", Context.MODE_PRIVATE) }

  var eodEnabled by remember { mutableStateOf(prefs.getBoolean(KEY_EOD_ENABLED, false)) }
  var permissionDenied by remember { mutableStateOf(false) }

  val requestPermission =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      permissionDenied = !granted
      if (granted) {
        ReminderScheduler.scheduleDailyEodReminder(context)
      }
    }

  LaunchedEffect(eodEnabled) {
    prefs.edit().putBoolean(KEY_EOD_ENABLED, eodEnabled).apply()
    if (eodEnabled) {
      if (Build.VERSION.SDK_INT >= 33) {
        val granted =
          ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
          requestPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
          return@LaunchedEffect
        }
      }
      ReminderScheduler.scheduleDailyEodReminder(context)
    } else {
      ReminderScheduler.cancelDailyEodReminder(context)
    }
  }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Reminders", style = MaterialTheme.typography.titleMedium)
        Text(
          "Reminders are scheduled using India time (Asia/Kolkata). Android may deliver them with a small delay depending on battery optimizations.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Daily EOD reminder", style = MaterialTheme.typography.titleMedium)
            Text("Runs once per day (targets 6:00 PM).", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          Spacer(Modifier.width(8.dp))
          Switch(checked = eodEnabled, onCheckedChange = { eodEnabled = it })
        }

        if (permissionDenied) {
          Text(
            "Notifications permission denied. Enable it in Android Settings → Apps → Jubilant Native → Notifications.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
          )
        }
      }
    }
  }
}

private const val KEY_EOD_ENABLED = "eod_reminder_enabled"

