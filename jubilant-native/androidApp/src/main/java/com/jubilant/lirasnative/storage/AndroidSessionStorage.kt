package com.jubilant.lirasnative.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.jubilant.lirasnative.shared.SessionStorage
import com.jubilant.lirasnative.shared.supabase.SupabaseSession
import com.jubilant.lirasnative.shared.util.DefaultJson
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString

class AndroidSessionStorage(
  private val context: Context,
) : SessionStorage {
  private val prefs by lazy { createPrefs(context) }

  override suspend fun load(): SupabaseSession? {
    val raw = prefs.getString(KEY_SESSION_JSON, null) ?: return null
    return runCatching { DefaultJson.decodeFromString<SupabaseSession>(raw) }.getOrNull()
  }

  override suspend fun save(session: SupabaseSession) {
    prefs.edit().putString(KEY_SESSION_JSON, DefaultJson.encodeToString(session)).apply()
  }

  override suspend fun clear() {
    prefs.edit().remove(KEY_SESSION_JSON).apply()
  }

  private fun createPrefs(context: Context): SharedPreferences =
    try {
      EncryptedSharedPreferences.create(
        context,
        FILE_NAME,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
      )
    } catch (_: Exception) {
      context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
    }

  private companion object {
    private const val FILE_NAME = "jubilant_native_secure_store"
    private const val KEY_SESSION_JSON = "supabase_session_json"
  }
}
