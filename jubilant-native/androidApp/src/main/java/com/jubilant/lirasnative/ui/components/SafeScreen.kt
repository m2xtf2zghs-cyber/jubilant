package com.jubilant.lirasnative.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun SafeScreen(
  screenName: String,
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  val errorState = remember { mutableStateOf<String?>(null) }

  if (errorState.value != null) {
    val errorMessage = errorState.value
    Card(
      modifier = modifier.fillMaxSize().padding(16.dp),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.08f)),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Text(
          "$screenName failed to load",
          style = MaterialTheme.typography.titleMedium,
          color = MaterialTheme.colorScheme.error,
        )
        Text(
          errorMessage ?: "Unexpected error",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 6,
          overflow = TextOverflow.Ellipsis,
        )
        Button(onClick = { errorState.value = null }) {
          Text("Retry")
        }
      }
    }
    return
  }

  content()
}
