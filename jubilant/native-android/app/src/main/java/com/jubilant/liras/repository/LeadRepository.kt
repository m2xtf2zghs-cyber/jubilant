package com.jubilant.liras.repository

import com.jubilant.liras.models.Lead
import com.jubilant.liras.network.supabase
import io.github.jan_tennert.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class LeadRepository {
    suspend fun getLeads(): List<Lead> = withContext(Dispatchers.IO) {
        try {
            supabase.postgrest["leads"]
                .select()
                .decodeList<Lead>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun updateLead(lead: Lead) = withContext(Dispatchers.IO) {
        supabase.postgrest["leads"]
            .update(lead) {
                filter {
                    eq("id", lead.id)
                }
            }
    }
}
