package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.SupabaseClient
import com.jubilant.lirasnative.shared.supabase.UnderwritingApplicationCreateInput
import com.jubilant.lirasnative.shared.supabase.UnderwritingApplicationListItem
import com.jubilant.lirasnative.shared.supabase.UnderwritingApplicationRow
import com.jubilant.lirasnative.shared.supabase.UnderwritingDocumentCreateInput
import com.jubilant.lirasnative.shared.supabase.UnderwritingDocumentRow

class UnderwritingRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun listApplications(leadId: String, limit: Int = 50): List<UnderwritingApplicationListItem> =
    supabase.listUnderwritingApplications(leadId = leadId, limit = limit)

  suspend fun getApplication(id: String): UnderwritingApplicationRow = supabase.getUnderwritingApplication(id = id)

  suspend fun createApplication(input: UnderwritingApplicationCreateInput): UnderwritingApplicationRow =
    supabase.createUnderwritingApplication(input = input)

  suspend fun uploadDocument(applicationId: String, ownerId: String, fileName: String, bytes: ByteArray, contentType: String): String =
    supabase.uploadUnderwritingDocument(applicationId = applicationId, ownerId = ownerId, fileName = fileName, bytes = bytes, contentType = contentType)

  suspend fun createDocument(input: UnderwritingDocumentCreateInput): UnderwritingDocumentRow =
    supabase.createUnderwritingDocument(input = input)
}
