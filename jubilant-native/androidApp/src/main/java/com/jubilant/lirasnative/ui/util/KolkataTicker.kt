package com.jubilant.lirasnative.ui.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import java.time.LocalDate
import java.time.LocalDateTime
import kotlinx.coroutines.delay

/**
 * Keeps time-based UI (EOD, "today" resets, monthly widgets) accurate even if the app stays open across midnight.
 * Uses Asia/Kolkata as the day boundary.
 */
@Composable
fun rememberKolkataDateTicker(
  pollMs: Long = 60_000L,
): State<LocalDate> =
  produceState(initialValue = nowKolkataDate()) {
    while (true) {
      val next = nowKolkataDate()
      if (next != value) value = next
      delay(pollMs)
    }
  }

@Composable
fun rememberKolkataDateTimeTicker(
  pollMs: Long = 60_000L,
): State<LocalDateTime> =
  produceState(initialValue = LocalDateTime.now(KOLKATA_ZONE)) {
    while (true) {
      value = LocalDateTime.now(KOLKATA_ZONE)
      delay(pollMs)
    }
  }

