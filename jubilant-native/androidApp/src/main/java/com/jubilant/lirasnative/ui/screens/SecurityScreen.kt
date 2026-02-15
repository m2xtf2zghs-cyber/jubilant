package com.jubilant.lirasnative.ui.screens

import android.content.Context
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
import com.jubilant.lirasnative.ui.util.KEY_BIOMETRIC_LOCK
import com.jubilant.lirasnative.ui.util.KEY_BLOCK_SCREENSHOTS
import com.jubilant.lirasnative.ui.util.PREFS_NAME

@Composable
fun SecurityScreen(
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val prefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

  var biometricLock by remember { mutableStateOf(prefs.getBoolean(KEY_BIOMETRIC_LOCK, false)) }
  var blockScreenshots by remember { mutableStateOf(prefs.getBoolean(KEY_BLOCK_SCREENSHOTS, false)) }

  LaunchedEffect(biometricLock) {
    prefs.edit().putBoolean(KEY_BIOMETRIC_LOCK, biometricLock).apply()
  }
  LaunchedEffect(blockScreenshots) {
    prefs.edit().putBoolean(KEY_BLOCK_SCREENSHOTS, blockScreenshots).apply()
  }

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
          "These settings apply only to this device. For best protection, enable a device screen lock and use biometric unlock.",
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
              "Prevents screenshots/screen recording (and hides previews in Recents).",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          Spacer(Modifier.width(10.dp))
          Switch(checked = blockScreenshots, onCheckedChange = { blockScreenshots = it })
        }
      }
    }
  }
}
