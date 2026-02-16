package com.jubilant.lirasnative.ui.util

import android.content.Context
import com.jubilant.lirasnative.shared.supabase.Mediator
import java.io.File
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

private val MEDIATORS_CACHE_JSON =
  Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
  }

object MediatorsCacheStore {
  private const val FILE_NAME = "mediators_cache.json"
  private const val KEY_LAST_UPDATED_AT_MS = "mediators_cache_last_updated_at_ms"
  private val MEDIATORS_SER = ListSerializer(Mediator.serializer())

  private fun file(context: Context): File = File(context.filesDir, FILE_NAME)

  fun save(context: Context, mediators: List<Mediator>) {
    runCatching {
      file(context).writeText(MEDIATORS_CACHE_JSON.encodeToString(MEDIATORS_SER, mediators))
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putLong(KEY_LAST_UPDATED_AT_MS, System.currentTimeMillis()).apply()
    }
  }

  fun load(context: Context): List<Mediator> =
    runCatching {
      val f = file(context)
      if (!f.exists()) return@runCatching emptyList()
      MEDIATORS_CACHE_JSON.decodeFromString(MEDIATORS_SER, f.readText())
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

