package com.jubilant.lirasnative.shared

import com.jubilant.lirasnative.shared.supabase.SupabaseSession
import com.jubilant.lirasnative.shared.util.DefaultJson
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import platform.Foundation.NSUserDefaults

class IosSessionStorage(
  private val defaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
) : SessionStorage {
  constructor() : this(NSUserDefaults.standardUserDefaults)

  override suspend fun load(): SupabaseSession? {
    val raw = defaults.stringForKey(KEY_SESSION_JSON) ?: return null
    return runCatching { DefaultJson.decodeFromString<SupabaseSession>(raw) }.getOrNull()
  }

  override suspend fun save(session: SupabaseSession) {
    defaults.setObject(DefaultJson.encodeToString(session), forKey = KEY_SESSION_JSON)
  }

  override suspend fun clear() {
    defaults.removeObjectForKey(KEY_SESSION_JSON)
  }

  private companion object {
    private const val KEY_SESSION_JSON = "supabase_session_json"
  }
}
