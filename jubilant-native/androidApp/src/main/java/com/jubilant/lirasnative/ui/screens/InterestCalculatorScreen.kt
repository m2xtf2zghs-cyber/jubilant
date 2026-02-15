package com.jubilant.lirasnative.ui.screens

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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.util.Locale

private enum class InterestFrequency(
  val key: String,
  val label: String,
) {
  Monthly("monthly", "Monthly"),
  Weekly("weekly", "Weekly"),
  BiWeekly("biweekly", "Bi-Weekly"),
  BiMonthly("bimonthly", "Bi-Monthly"),
}

@Composable
fun InterestCalculatorScreen(
  modifier: Modifier = Modifier,
) {
  // Keep these variable names to match the requested formula spec.
  var given by remember { mutableStateOf("100000") }
  var interest by remember { mutableStateOf("10000") }
  var weeks by remember { mutableStateOf("12") }

  var frequency by remember { mutableStateOf(InterestFrequency.Monthly) }

  val daysMap =
    remember {
      mapOf(
        InterestFrequency.Weekly to 7.0,
        InterestFrequency.BiWeekly to 14.0,
        InterestFrequency.BiMonthly to 15.0,
      )
    }

  val rate by
    remember(given, interest, weeks, frequency) {
      derivedStateOf {
        val givenNum = given.trim().toDoubleOrNull() ?: 0.0
        val interestNum = interest.trim().toDoubleOrNull() ?: 0.0
        val weeksNum = weeks.trim().toDoubleOrNull() ?: 0.0

        if (givenNum <= 0.0 || weeksNum <= 0.0) return@derivedStateOf 0.0

        // Monthly logic must remain untouched:
        if (frequency == InterestFrequency.Monthly) {
          return@derivedStateOf (interestNum / givenNum) / ((weeksNum + 1.0) / 2.0) * 100.0
        }

        val days = daysMap[frequency] ?: 0.0
        if (days <= 0.0) return@derivedStateOf 0.0

        // Base Formula (must be preserved):
        // ( interest / given ) / ( (weeks + 1) / 2 ) / DAYS * 3000
        (interestNum / givenNum) / ((weeksNum + 1.0) / 2.0) / days * 3000.0
      }
    }

  val durationLabel =
    remember(frequency) {
      when (frequency) {
        InterestFrequency.Monthly -> "Duration (Months)"
        InterestFrequency.Weekly, InterestFrequency.BiWeekly -> "Duration (Weeks)"
        InterestFrequency.BiMonthly -> "Duration (15-day cycles)"
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

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Interest Rate Calculator", style = MaterialTheme.typography.titleLarge)

        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
              "OUR INTEREST RATE",
              style = MaterialTheme.typography.labelLarge,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
              String.format(Locale.US, "%.2f%%", rate),
              style = MaterialTheme.typography.headlineLarge,
              color = MaterialTheme.colorScheme.secondary,
            )
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
          InterestFrequency.entries.forEach { f ->
            FilterChip(
              selected = frequency == f,
              onClick = { frequency = f },
              label = { Text(f.label) },
              colors =
                FilterChipDefaults.filterChipColors(
                  selectedContainerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.18f),
                  selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                ),
              border =
                FilterChipDefaults.filterChipBorder(
                  enabled = true,
                  selected = frequency == f,
                  borderColor = MaterialTheme.colorScheme.outlineVariant,
                  selectedBorderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.35f),
                ),
            )
          }
        }

        OutlinedTextField(
          value = given,
          onValueChange = { given = it },
          label = { Text("Given Amount (Principal)") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          colors = tfColors,
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          value = interest,
          onValueChange = { interest = it },
          label = { Text("Total Interest Amount") },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          colors = tfColors,
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          value = weeks,
          onValueChange = { weeks = it },
          label = { Text(durationLabel) },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          colors = tfColors,
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )

        Text(
          "Monthly uses the original formula. Weekly/Bi-Weekly/Bi-Monthly use the requested DAYS mapping and 3000 factor.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
  }
}
