package com.jubilant.lirasnative.ui.util

import com.jubilant.lirasnative.shared.supabase.Lead
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * CRM Automation: Logic to determine if a lead requires urgent attention based on inactivity.
 */
object CrmAutomations {

    fun getStalenessStatus(lead: Lead): StalenessLevel {
        val lastUpdate = lead.updatedAt ?: lead.createdAt ?: return StalenessLevel.FRESH
        val lastInstant = Instant.parse(lastUpdate)
        val hoursOld = ChronoUnit.HOURS.between(lastInstant, Instant.now())

        return when {
            hoursOld > 72 -> StalenessLevel.CRITICAL // Over 3 days no update
            hoursOld > 48 -> StalenessLevel.STALE    // Over 2 days
            else -> StalenessLevel.FRESH
        }
    }

    /**
     * CRM Automation: Auto-suggest next action based on current state and missing documents.
     */
    fun suggestNextAction(lead: Lead): String {
        val docs = lead.documents
        if (docs?.bank != true) return "Request Bank Statements"
        if (docs.itr != true) return "Verify ITR records"
        
        val status = (lead.status ?: "").lowercase()
        if (status.contains("ptp")) return "Check Payment Status"
        if (status.contains("follow-up")) return "Schedule Discovery Call"
        
        return "Nudge for Progress"
    }
}

enum class StalenessLevel {
    FRESH,
    STALE,
    CRITICAL
}
