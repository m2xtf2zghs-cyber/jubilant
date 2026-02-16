package com.jubilant.lirasnative.di

import android.content.Context
import com.jubilant.lirasnative.BuildConfig
import com.jubilant.lirasnative.storage.AndroidSessionStorage
import com.jubilant.lirasnative.shared.supabase.SupabaseClient
import com.jubilant.lirasnative.shared.supabase.SupabaseConfig

class AppContainer(context: Context) {
  private val sessionStorage = AndroidSessionStorage(context)

  val supabaseClient =
    SupabaseClient(
      config = SupabaseConfig(url = BuildConfig.SUPABASE_URL, anonKey = BuildConfig.SUPABASE_ANON_KEY),
      storage = sessionStorage,
    )

  val authRepository = AuthRepository(supabaseClient)
  val leadsRepository = LeadsRepository(supabaseClient)
  val mediatorsRepository = MediatorsRepository(supabaseClient)
  val profilesRepository = ProfilesRepository(supabaseClient)
  val underwritingRepository = UnderwritingRepository(supabaseClient)
  val pdRepository = PdRepository(supabaseClient)
  val statementRepository = StatementRepository(supabaseClient)
}
