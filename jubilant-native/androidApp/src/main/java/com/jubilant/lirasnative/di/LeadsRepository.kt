package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.Lead
import com.jubilant.lirasnative.shared.supabase.LeadCreateInput
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.StorageObject
import com.jubilant.lirasnative.shared.supabase.SupabaseClient

class LeadsRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun listLeads(limit: Int = 100): List<LeadSummary> = supabase.listLeads(limit)

  suspend fun listLeadsDetailed(limit: Int = 1000): List<Lead> = supabase.listLeadsDetailed(limit)

  suspend fun getLead(id: String): Lead = supabase.getLead(id)

  suspend fun createLead(input: LeadCreateInput): Lead = supabase.createLead(input)

  suspend fun updateLead(id: String, patch: LeadUpdate): Lead = supabase.updateLead(id, patch)

  suspend fun clearMediatorFromLeads(mediatorId: String) = supabase.clearMediatorFromLeads(mediatorId)

  suspend fun deleteLead(id: String) = supabase.deleteLead(id)

  suspend fun listLeadAttachments(leadId: String, limit: Int = 100): List<StorageObject> =
    supabase.listLeadAttachments(leadId = leadId, limit = limit)

  suspend fun uploadLeadAttachment(leadId: String, fileName: String, bytes: ByteArray, contentType: String): String =
    supabase.uploadLeadAttachment(leadId = leadId, fileName = fileName, bytes = bytes, contentType = contentType)

  suspend fun downloadLeadAttachment(path: String): ByteArray = supabase.downloadLeadAttachment(path = path)

  suspend fun deleteLeadAttachment(path: String) = supabase.deleteLeadAttachment(path = path)
}
