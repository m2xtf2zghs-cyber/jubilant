package com.jubilant.liras.repository

import com.jubilant.liras.models.Mediator
import com.jubilant.liras.network.supabase
import io.github.jan_tennert.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MediatorRepository {
    suspend fun getMediators(): List<Mediator> = withContext(Dispatchers.IO) {
        try {
            supabase.postgrest["mediators"]
                .select()
                .decodeList<Mediator>()
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun updateMediator(mediator: Mediator) = withContext(Dispatchers.IO) {
        supabase.postgrest["mediators"]
            .update(mediator) {
                filter {
                    eq("id", mediator.id)
                }
            }
    }
}
