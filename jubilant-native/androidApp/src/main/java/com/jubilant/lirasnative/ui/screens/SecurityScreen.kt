package com.jubilant.lirasnative.ui.screens

import android.content.Context
import android.os.Build
import android.os.Debug
import android.provider.Settings
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
import com.jubilant.lirasnative.BuildConfig
import com.jubilant.lirasnative.ui.util.KEY_BIOMETRIC_LOCK
import com.jubilant.lirasnative.ui.util.KEY_BLOCK_SCREENSHOTS
import com.jubilant.lirasnative.ui.util.PREFS_NAME
import java.io.File

private data class DeviceTrustSignal(
  val label: String,
  val flagged: Boolean,
  val detail: String,
)

@Composable
fun SecurityScreen(
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val prefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

  var biometricLock by remember { mutableStateOf(prefs.getBoolean(KEY_BIOMETRIC_LOCK, false)) }
  var blockScreenshots by remember { mutableStateOf(prefs.getBoolean(KEY_BLOCK_SCREENSHOTS, false)) }
  var trustSignals by remember { mutableStateOf(evaluateDeviceTrust(context)) }

  LaunchedEffect(biometricLock) {
    prefs.edit().putBoolean(KEY_BIOMETRIC_LOCK, biometricLock).apply()
  }
  LaunchedEffect(blockScreenshots) {
    prefs.edit().putBoolean(KEY_BLOCK_SCREENSHOTS, blockScreenshots).apply()
  }

  val flaggedCount = trustSignals.count { it.flagged }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Security & privacy", style = MaterialTheme.typography.titleMedium)
        Text(
          "These settings apply only to this device. For best protection, enable device lock and block screenshots.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Biometric lock", style = MaterialTheme.typography.titleMedium)
            Text(
              "Require fingerprint/face when opening the app.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          Spacer(Modifier.width(10.dp))
          Switch(checked = biometricLock, onCheckedChange = { biometricLock = it })
        }

        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Block screenshots", style = MaterialTheme.typography.titleMedium)
            Text(
              "Prevents screenshots/screen recording and hides app content in Recents.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          Spacer(Modifier.width(10.dp))
          Switch(checked = blockScreenshots, onCheckedChange = { blockScreenshots = it })
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text("Device trust checks", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          androidx.compose.material3.TextButton(onClick = { trustSignals = evaluateDeviceTrust(context) }) {
            Text("Recheck")
          }
        }

        trustSignals.forEach { signal ->
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(
              signal.label,
              style = MaterialTheme.typography.bodyMedium,
              modifier = Modifier.weight(1f),
            )
            Text(
              if (signal.flagged) "Flagged" else "OK",
              style = MaterialTheme.typography.labelMedium,
              color = if (signal.flagged) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary,
            )
          }
          Text(
            signal.detail,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }

        if (flaggedCount > 0) {
          Text(
            "$flaggedCount trust signal(s) detected. Avoid storing sensitive docs on this device.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
          )
        } else {
          Text(
            "No trust risks detected from local checks.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.secondary,
          )
        }
      }
    }
  }
}

private fun evaluateDeviceTrust(context: Context): List<DeviceTrustSignal> {
  val rooted = isRootedDevice()
  val emulator = isEmulatorDevice()
  val debuggerAttached = BuildConfig.DEBUG || Debug.isDebuggerConnected()
  val devOptions = isDeveloperOptionsEnabled(context)

  return listOf(
    DeviceTrustSignal(
      label = "Root / tamper",
      flagged = rooted,
      detail = if (rooted) "Root indicators found (su/test-keys)." else "No root indicator detected.",
    ),
    DeviceTrustSignal(
      label = "Emulator check",
      flagged = emulator,
      detail = if (emulator) "Running on emulator-like build fingerprint." else "Physical-device fingerprint pattern.",
    ),
    DeviceTrustSignal(
      label = "Debug attached",
      flagged = debuggerAttached,
      detail = if (debuggerAttached) "Debugger/build debug mode is active." else "No debugger currently attached.",
    ),
    DeviceTrustSignal(
      label = "Developer options",
      flagged = devOptions,
      detail = if (devOptions) "Developer options enabled on this device." else "Developer options disabled.",
    ),
  )
}

private fun isRootedDevice(): Boolean {
  val tags = Build.TAGS.orEmpty()
  if (tags.contains("test-keys", ignoreCase = true)) return true

  val knownPaths =
    listOf(
      "/system/app/Superuser.apk",
      "/sbin/su",
      "/system/bin/su",
      "/system/xbin/su",
      "/data/local/xbin/su",
      "/data/local/bin/su",
      "/system/sd/xbin/su",
      "/system/bin/failsafe/su",
      "/data/local/su",
    )

  return knownPaths.any { path ->
    runCatching { File(path).exists() }.getOrDefault(false)
  }
}

private fun isEmulatorDevice(): Boolean {
  val fingerprint = Build.FINGERPRINT.orEmpty().lowercase()
  val model = Build.MODEL.orEmpty().lowercase()
  val product = Build.PRODUCT.orEmpty().lowercase()
  return fingerprint.contains("generic") ||
    fingerprint.contains("emulator") ||
    model.contains("emulator") ||
    product.contains("sdk") ||
    product.contains("vbox")
}

private fun isDeveloperOptionsEnabled(context: Context): Boolean {
  return runCatching {
    Settings.Global.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1
  }.getOrDefault(false)
}
