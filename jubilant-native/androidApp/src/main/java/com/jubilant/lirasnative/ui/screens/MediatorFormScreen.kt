package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.MediatorsRepository
import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorCreateInput
import kotlinx.coroutines.launch

@Composable
fun MediatorFormScreen(
  mediatorsRepository: MediatorsRepository,
  onCancel: () -> Unit,
  onSaved: (Mediator) -> Unit,
) {
  val scope = rememberCoroutineScope()
  var busy by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var name by remember { mutableStateOf("") }
  var phone by remember { mutableStateOf("") }

  fun save() {
    val n = name.trim()
    if (n.isEmpty()) {
      error = "Mediator name is required."
      return
    }
    scope.launch {
      busy = true
      error = null
      val created =
        runCatching {
          mediatorsRepository.createMediator(
            MediatorCreateInput(
              name = n,
              phone = phone.trim().takeIf { it.isNotBlank() },
            ),
          )
        }
          .onFailure { error = it.message ?: "Create failed." }
          .getOrNull()
      if (created != null) onSaved(created)
      busy = false
    }
  }

  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("Add mediator", style = MaterialTheme.typography.titleLarge)

      if (!error.isNullOrBlank()) {
        Card(
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
        ) {
          Text(
            error!!,
            modifier = Modifier.padding(12.dp),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
          )
        }
      }

      val tfColors =
        TextFieldDefaults.colors(
          unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
          focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
          focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
          unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
          focusedTextColor = MaterialTheme.colorScheme.onSurface,
          unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
          focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
          unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
        )

      OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Mediator name") }, singleLine = true, colors = tfColors)
      OutlinedTextField(
        value = phone,
        onValueChange = { phone = it },
        label = { Text("Phone (optional)") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        colors = tfColors,
      )

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        TextButton(onClick = onCancel, enabled = !busy, modifier = Modifier.weight(1f)) { Text("Cancel") }
        Button(onClick = { save() }, enabled = !busy, modifier = Modifier.weight(1f)) {
          if (busy) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
          } else {
            androidx.compose.material3.Icon(Icons.Outlined.Save, contentDescription = null)
            Spacer(Modifier.width(10.dp))
          }
          Text("Save")
        }
      }
    }
  }
}
