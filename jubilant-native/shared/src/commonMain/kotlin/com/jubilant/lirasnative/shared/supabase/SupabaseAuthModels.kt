package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SupabaseUser(
  val id: String,
  val email: String? = null,
)

@Serializable
data class SupabaseSession(
  @SerialName("access_token")
  val accessToken: String,
  @SerialName("refresh_token")
  val refreshToken: String,
  @SerialName("expires_in")
  val expiresIn: Long? = null,
  @SerialName("expires_at")
  val expiresAt: Long? = null,
  val user: SupabaseUser? = null,
) {
  fun isExpired(nowEpochSeconds: Long): Boolean {
    val exp = expiresAt ?: return false
    return nowEpochSeconds >= exp
  }
}

@Serializable
data class SupabaseRefreshRequest(
  @SerialName("refresh_token")
  val refreshToken: String,
)

@Serializable
data class SupabasePasswordGrantRequest(
  val email: String,
  val password: String,
)

@Serializable
data class SupabaseAuthResponse(
  val user: SupabaseUser? = null,
  val session: SupabaseSession? = null,
)

@Serializable
data class SupabaseSignUpRequest(
  val email: String,
  val password: String,
)

@Serializable
data class SupabaseRecoverRequest(
  val email: String,
)
