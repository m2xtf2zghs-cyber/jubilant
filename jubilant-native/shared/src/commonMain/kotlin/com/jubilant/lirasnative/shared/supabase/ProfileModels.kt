package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Profile(
  @SerialName("user_id")
  val userId: String,
  val email: String? = null,
  @SerialName("full_name")
  val fullName: String? = null,
  val role: String? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
  @SerialName("updated_at")
  val updatedAt: String? = null,
)

@Serializable
data class ProfileUpdate(
  val email: String? = null,
  @SerialName("full_name")
  val fullName: String? = null,
  val role: String? = null,
)

