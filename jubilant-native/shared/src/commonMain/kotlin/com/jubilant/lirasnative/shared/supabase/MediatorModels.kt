package com.jubilant.lirasnative.shared.supabase

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MediatorFollowUpEntry(
  val date: String,
  val time: String? = null,
  val type: String? = null,
)

@Serializable
data class Mediator(
  val id: String,
  @SerialName("owner_id")
  val ownerId: String? = null,
  @SerialName("created_by")
  val createdBy: String? = null,
  @SerialName("created_at")
  val createdAt: String? = null,
  @SerialName("updated_at")
  val updatedAt: String? = null,
  val name: String,
  val phone: String? = null,
  @SerialName("follow_up_history")
  val followUpHistory: List<MediatorFollowUpEntry> = emptyList(),
)

@Serializable
data class MediatorCreateInput(
  val name: String,
  val phone: String? = null,
  @SerialName("follow_up_history")
  val followUpHistory: List<MediatorFollowUpEntry>? = null,
)

@Serializable
data class MediatorUpdate(
  val name: String? = null,
  val phone: String? = null,
  @SerialName("follow_up_history")
  val followUpHistory: List<MediatorFollowUpEntry>? = null,
)

