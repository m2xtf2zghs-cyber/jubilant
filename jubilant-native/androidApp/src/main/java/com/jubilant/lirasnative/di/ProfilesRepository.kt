package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.Profile
import com.jubilant.lirasnative.shared.supabase.ProfileUpdate
import com.jubilant.lirasnative.shared.supabase.SupabaseClient

class ProfilesRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun requireUserId(): String = supabase.requireUserId()

  suspend fun getMyProfile(): Profile? = supabase.getMyProfile()

  suspend fun listProfiles(limit: Int = 200): List<Profile> = supabase.listProfiles(limit)

  suspend fun updateProfile(userId: String, patch: ProfileUpdate): Profile = supabase.updateProfile(userId, patch)

  suspend fun upsertProfile(userId: String, email: String?, fullName: String?, role: String?): Profile =
    supabase.upsertProfile(userId = userId, email = email, fullName = fullName, role = role)

  suspend fun createUser(email: String, password: String): String {
    val user = supabase.signUpWithPassword(email = email, password = password)
    return user.id
  }

  suspend fun sendPasswordRecovery(email: String) {
    supabase.sendPasswordRecovery(email = email)
  }
}
