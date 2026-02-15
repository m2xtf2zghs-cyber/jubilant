package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class StorageListRequest(
  val prefix: String,
  val limit: Int? = null,
  val offset: Int? = null,
)

@Serializable
data class StorageObject(
  val name: String,
  val id: String? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
  @SerialName("updated_at")
  val updatedAt: String? = null,
  val metadata: JsonObject? = null,
)

