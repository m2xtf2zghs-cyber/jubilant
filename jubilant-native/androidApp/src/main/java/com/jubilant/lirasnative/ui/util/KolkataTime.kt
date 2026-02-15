package com.jubilant.lirasnative.ui.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

val KOLKATA_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")

fun nowKolkataDate(): LocalDate = LocalDate.now(KOLKATA_ZONE)

fun isoToKolkataLocalDateTime(raw: String?): LocalDateTime? {
  val s = raw?.trim().orEmpty()
  if (s.isEmpty()) return null

  // Most values are ISO-8601 timestamptz from Supabase.
  val instant = runCatching { Instant.parse(s) }.getOrNull()
  if (instant != null) return instant.atZone(KOLKATA_ZONE).toLocalDateTime()

  // Fallback for "YYYY-MM-DDTHH:MM..." without timezone.
  val local = runCatching { LocalDateTime.parse(s) }.getOrNull()
  if (local != null) return local

  // Fallback for older string formats: YYYY-MM-DD...
  val d = runCatching { LocalDate.parse(s.take(10)) }.getOrNull()
  return d?.atStartOfDay()
}

fun isoToKolkataTime(raw: String?): LocalTime? = isoToKolkataLocalDateTime(raw)?.toLocalTime()

fun isoToKolkataDate(raw: String?): LocalDate? {
  val s = raw?.trim().orEmpty()
  if (s.isEmpty()) return null

  // Most values are ISO-8601 timestamptz from Supabase.
  val instant = runCatching { Instant.parse(s) }.getOrNull()
  if (instant != null) return instant.atZone(KOLKATA_ZONE).toLocalDate()

  // Fallback for older string formats: YYYY-MM-DD...
  return runCatching { LocalDate.parse(s.take(10)) }.getOrNull()
}
