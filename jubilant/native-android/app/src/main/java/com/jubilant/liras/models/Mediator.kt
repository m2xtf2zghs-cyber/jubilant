package com.jubilant.liras.models

import java.util.Date

data class Mediator(
    val id: String,
    val name: String,
    val phone: String?,
    val followUpHistory: List<FollowUpEntry> = emptyList()
)

data class FollowUpEntry(
    val date: String,
    val time: String,
    val type: String,
    val ts: Date? = null,
    val outcome: String? = null,
    val notes: String? = null
)
