package com.jubilant.lirasnative.ui.util

import android.content.Context
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.builtins.ListSerializer

private val LEADS_CACHE_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

object LeadsCacheStore {
  private const val FILE_NAME = "leads_cache.json"
  private const val KEY_LAST_UPDATED_AT_MS = "leads_cache_last_updated_at_ms"
  private val LEADS_SER = ListSerializer(LeadSummary.serializer())

  private fun file(context: Context): File = File(context.filesDir, FILE_NAME)

  fun save(context: Context, leads: List<LeadSummary>) {
    runCatching {
      file(context).writeText(LEADS_CACHE_JSON.encodeToString(LEADS_SER, leads))
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putLong(KEY_LAST_UPDATED_AT_MS, System.currentTimeMillis()).apply()
    }
  }

  fun load(context: Context): List<LeadSummary> =
    runCatching {
      val f = file(context)
      if (!f.exists()) return@runCatching emptyList()
      LEADS_CACHE_JSON.decodeFromString(LEADS_SER, f.readText())
    }.getOrNull() ?: emptyList()

  fun lastUpdatedAtMs(context: Context): Long? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val v = prefs.getLong(KEY_LAST_UPDATED_AT_MS, 0L)
    return if (v > 0L) v else null
  }

  fun clear(context: Context) {
    runCatching { file(context).delete() }
    runCatching {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().remove(KEY_LAST_UPDATED_AT_MS).apply()
    }
  }
}
