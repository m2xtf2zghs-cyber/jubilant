package com.jubilant.lirasnative.shared

import com.jubilant.lirasnative.shared.supabase.SupabaseSession

interface SessionStorage {
  suspend fun load(): SupabaseSession?
  suspend fun save(session: SupabaseSession)
  suspend fun clear()
}

class InMemorySessionStorage : SessionStorage {
  private var session: SupabaseSession? = null

  override suspend fun load(): SupabaseSession? = session

  override suspend fun save(session: SupabaseSession) {
    this.session = session
  }

  override suspend fun clear() {
    session = null
  }
}

