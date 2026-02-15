package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.SupabaseClient

class AuthRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun signIn(email: String, password: String) {
    supabase.signInWithPassword(email.trim(), password)
  }

  suspend fun signOut() {
    supabase.clearSession()
  }
}

