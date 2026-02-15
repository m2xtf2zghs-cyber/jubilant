package com.jubilant.lirasnative.ui.util

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import java.time.LocalDate
import java.time.LocalTime

fun showDatePicker(
  context: Context,
  initial: LocalDate = LocalDate.now(),
  onSelected: (LocalDate) -> Unit,
) {
  DatePickerDialog(
    context,
    { _, year, month, dayOfMonth ->
      onSelected(LocalDate.of(year, month + 1, dayOfMonth))
    },
    initial.year,
    initial.monthValue - 1,
    initial.dayOfMonth,
  ).show()
}

fun showTimePicker(
  context: Context,
  initial: LocalTime = LocalTime.now(),
  onSelected: (LocalTime) -> Unit,
) {
  TimePickerDialog(
    context,
    { _, hourOfDay, minute ->
      onSelected(LocalTime.of(hourOfDay, minute))
    },
    initial.hour,
    initial.minute,
    false,
  ).show()
}

