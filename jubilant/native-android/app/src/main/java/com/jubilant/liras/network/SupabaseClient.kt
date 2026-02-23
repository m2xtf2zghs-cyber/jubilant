package com.jubilant.liras.network

import io.github.jan_tennert.supabase.SupabaseClient
import io.github.jan_tennert.supabase.createSupabaseClient
import io.github.jan_tennert.supabase.gotrue.GoTrue
import io.github.jan_tennert.supabase.postgrest.Postgrest

object SupabaseConfig {
    // Replace these with your actual Supabase credentials
    const val URL = "YOUR_SUPABASE_URL"
    const val ANON_KEY = "YOUR_SUPABASE_ANON_KEY"
}

val supabase = createSupabaseClient(
    supabaseUrl = SupabaseConfig.URL,
    supabaseKey = SupabaseConfig.ANON_KEY
) {
    install(Postgrest)
    install(GoTrue)
}
