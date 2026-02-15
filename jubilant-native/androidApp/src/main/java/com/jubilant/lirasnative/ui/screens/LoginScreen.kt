package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material3.Icon
import androidx.compose.material3.TextField
import androidx.compose.ui.text.style.TextAlign
import com.jubilant.lirasnative.ui.components.BankingBackground
import com.jubilant.lirasnative.ui.components.BrandHeader
import com.jubilant.lirasnative.ui.components.GradientButton
import androidx.compose.ui.graphics.Color

@Composable
fun LoginScreen(
  busy: Boolean,
  error: String?,
  onSubmit: (email: String, password: String) -> Unit,
) {
  var email by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }

  BankingBackground {
    Box(modifier = Modifier.fillMaxSize().padding(22.dp), contentAlignment = Alignment.Center) {
      Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
      ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
          BrandHeader(
            title = "Jubilant Capital",
            subtitle = "LIRAS • Native CRM",
          )

          Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
              text = "Secure sign in",
              style = MaterialTheme.typography.headlineSmall,
              color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
              text = "Invite-only access for staff accounts",
              style = MaterialTheme.typography.bodyMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }

          val tfColors =
            TextFieldDefaults.colors(
              unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
              focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
              focusedIndicatorColor = MaterialTheme.colorScheme.secondary,
              unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
              focusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
              unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
              focusedTextColor = MaterialTheme.colorScheme.onBackground,
              unfocusedTextColor = MaterialTheme.colorScheme.onBackground,
              focusedLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
              unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            )

          OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            leadingIcon = { Icon(Icons.Outlined.Mail, contentDescription = null) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            colors = tfColors,
          )

          OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            colors = tfColors,
          )

          if (!error.isNullOrBlank()) {
            Card(
              colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)),
              border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
            ) {
              Text(
                text = error,
                modifier = Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
              )
            }
          } else {
            Spacer(Modifier.size(2.dp))
          }

          GradientButton(
            label = if (busy) "Signing in…" else "Sign in",
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
            leading =
              if (busy) {
                {
                  CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = Color.White,
                  )
                }
              } else {
                null
              },
            onClick = { onSubmit(email, password) },
          )

          Text(
            text = "Tip: ask your admin to create your account in Supabase Auth → Users.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
          )
        }
      }
    }
  }
}
