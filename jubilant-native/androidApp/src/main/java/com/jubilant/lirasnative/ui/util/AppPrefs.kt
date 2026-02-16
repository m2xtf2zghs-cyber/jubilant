package com.jubilant.lirasnative.ui.util

const val KEY_SESSION_ROLE: String = "session_role"
const val KEY_SESSION_USER_ID: String = "session_user_id"

fun snoozePrefKeyForLead(leadId: String): String = "meeting_snooze_until_$leadId"

