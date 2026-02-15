package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.PersonAddAlt
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldColors
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
import com.jubilant.lirasnative.di.ProfilesRepository
import com.jubilant.lirasnative.shared.supabase.Profile
import com.jubilant.lirasnative.shared.supabase.ProfileUpdate
import kotlinx.coroutines.launch

private enum class RoleOption(
  val label: String,
) {
  Admin("admin"),
  Staff("staff"),
}

@Composable
fun AdminAccessScreen(
  profilesRepository: ProfilesRepository,
  session: SessionState,
  onChanged: () -> Unit,
  modifier: Modifier = Modifier,
) {
  if (!session.isAdmin) {
    ErrorScreen(message = "Admin access only.")
    return
  }

  val scope = rememberCoroutineScope()

  var busy by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var toast by remember { mutableStateOf<String?>(null) }

  var email by remember { mutableStateOf("") }
  var fullName by remember { mutableStateOf("") }
  var tempPassword by remember { mutableStateOf("") }
  var role by remember { mutableStateOf(RoleOption.Staff) }
  var roleExpanded by remember { mutableStateOf(false) }

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

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    error?.let { msg ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
      ) {
        Text(
          msg,
          modifier = Modifier.padding(12.dp),
          color = MaterialTheme.colorScheme.error,
          style = MaterialTheme.typography.bodyMedium,
        )
      }
    }
    toast?.let { msg ->
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f)),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth().padding(12.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text(msg, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
          TextButton(onClick = { toast = null }) { Text("OK") }
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          Text("Staff & access", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
          IconButton(onClick = onChanged, enabled = !busy) {
            Icon(Icons.Outlined.Refresh, contentDescription = "Refresh")
          }
        }
        Text(
          "Create staff users only if signups are enabled on Supabase Auth. If your project is invite-only, create users via Supabase dashboard (or add an admin invite Edge Function).",
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
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Create staff user", style = MaterialTheme.typography.titleMedium)

        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, colors = tfColors)
        OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Full name") }, singleLine = true, colors = tfColors)
        OutlinedTextField(
          value = tempPassword,
          onValueChange = { tempPassword = it },
          label = { Text("Temporary password") },
          singleLine = true,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
          colors = tfColors,
        )

        Column {
          OutlinedTextField(
            readOnly = true,
            value = role.label,
            onValueChange = {},
            label = { Text("Role") },
            trailingIcon = {
              IconButton(onClick = { roleExpanded = !roleExpanded }) {
                Icon(Icons.Outlined.Key, contentDescription = null)
              }
            },
            modifier = Modifier.fillMaxWidth(),
            colors = tfColors,
          )

          DropdownMenu(expanded = roleExpanded, onDismissRequest = { roleExpanded = false }) {
            RoleOption.entries.forEach { r ->
              DropdownMenuItem(
                text = { Text(r.label) },
                onClick = {
                  role = r
                  roleExpanded = false
                },
              )
            }
          }
        }

        Button(
          onClick = {
            if (busy) return@Button
            val e = email.trim()
            if (e.isBlank()) {
              error = "Email is required."
              return@Button
            }
            val p = tempPassword
            if (p.length < 6) {
              error = "Temporary password should be at least 6 characters."
              return@Button
            }

            busy = true
            error = null
            toast = null
            scope.launch {
              runCatching {
                val userId = profilesRepository.createUser(email = e, password = p)
                profilesRepository.upsertProfile(
                  userId = userId,
                  email = e,
                  fullName = fullName.trim().takeIf { it.isNotBlank() },
                  role = role.label,
                )
              }.onSuccess {
                toast = "Created user. Share the temporary password and ask them to change it after login."
                email = ""
                fullName = ""
                tempPassword = ""
                role = RoleOption.Staff
                onChanged()
              }.onFailure { ex ->
                error = ex.message ?: "Create user failed."
              }
              busy = false
            }
          },
          enabled = !busy,
          modifier = Modifier.fillMaxWidth(),
        ) {
          if (busy) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp))
          } else {
            Icon(Icons.Outlined.PersonAddAlt, contentDescription = null)
            Spacer(Modifier.width(8.dp))
          }
          Text("Create user")
        }
      }
    }

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Existing users", style = MaterialTheme.typography.titleMedium)
        if (session.profiles.isEmpty()) {
          Text("No profiles found.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
          LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(session.profiles.sortedBy { (it.fullName ?: it.email ?: it.userId).lowercase() }) { p ->
              ProfileRow(
                profile = p,
                busy = busy,
                tfColors = tfColors,
                onUpdate = { patch ->
                  if (busy) return@ProfileRow
                  busy = true
                  error = null
                  toast = null
                  scope.launch {
                    runCatching { profilesRepository.updateProfile(userId = p.userId, patch = patch) }
                      .onSuccess { onChanged() }
                      .onFailure { ex -> error = ex.message ?: "Update failed." }
                    busy = false
                  }
                },
                onSendReset = {
                  if (busy) return@ProfileRow
                  val e = p.email?.trim().orEmpty()
                  if (e.isBlank()) {
                    error = "This profile has no email."
                    return@ProfileRow
                  }
                  busy = true
                  error = null
                  toast = null
                  scope.launch {
                    runCatching { profilesRepository.sendPasswordRecovery(email = e) }
                      .onSuccess { toast = "Sent password reset email to $e." }
                      .onFailure { ex -> error = ex.message ?: "Reset failed." }
                    busy = false
                  }
                },
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun ProfileRow(
  profile: Profile,
  busy: Boolean,
  tfColors: TextFieldColors,
  onUpdate: (ProfileUpdate) -> Unit,
  onSendReset: () -> Unit,
) {
  var expanded by remember(profile.userId) { mutableStateOf(false) }
  var name by remember(profile.userId) { mutableStateOf(profile.fullName.orEmpty()) }
  var role by remember(profile.userId) { mutableStateOf(profile.role?.ifBlank { "staff" } ?: "staff") }

  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(profile.email ?: profile.userId, style = MaterialTheme.typography.titleMedium)
      if (!profile.fullName.isNullOrBlank()) {
        Text(profile.fullName!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }

      OutlinedTextField(
        value = name,
        onValueChange = { name = it },
        label = { Text("Full name") },
        singleLine = true,
        colors = tfColors,
      )

      Column {
        OutlinedTextField(
          value = role,
          onValueChange = {},
          readOnly = true,
          label = { Text("Role") },
          trailingIcon = {
            IconButton(onClick = { expanded = !expanded }) {
              Icon(Icons.Outlined.Key, contentDescription = null)
            }
          },
          singleLine = true,
          colors = tfColors,
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
          listOf("staff", "admin").forEach { r ->
            DropdownMenuItem(
              text = { Text(r) },
              onClick = {
                role = r
                expanded = false
              },
            )
          }
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        TextButton(
          onClick = { onSendReset() },
          enabled = !busy,
          modifier = Modifier.weight(1f),
        ) {
          Icon(Icons.Outlined.Send, contentDescription = null)
          Spacer(Modifier.width(8.dp))
          Text("Reset email")
        }

        Button(
          onClick = { onUpdate(ProfileUpdate(fullName = name.trim().takeIf { it.isNotBlank() }, role = role)) },
          enabled = !busy,
          modifier = Modifier.weight(1f),
        ) {
          Text("Save")
        }
      }
    }
  }
}
