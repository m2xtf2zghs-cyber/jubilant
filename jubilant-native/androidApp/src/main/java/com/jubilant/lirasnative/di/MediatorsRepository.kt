package com.jubilant.lirasnative.di

import com.jubilant.lirasnative.shared.supabase.Mediator
import com.jubilant.lirasnative.shared.supabase.MediatorCreateInput
import com.jubilant.lirasnative.shared.supabase.MediatorUpdate
import com.jubilant.lirasnative.shared.supabase.SupabaseClient

class MediatorsRepository(
  private val supabase: SupabaseClient,
) {
  suspend fun listMediators(limit: Int = 200): List<Mediator> = supabase.listMediators(limit)

  suspend fun createMediator(input: MediatorCreateInput): Mediator = supabase.createMediator(input)

  suspend fun updateMediator(id: String, patch: MediatorUpdate): Mediator = supabase.updateMediator(id, patch)

  suspend fun deleteMediator(id: String) = supabase.deleteMediator(id)
}

