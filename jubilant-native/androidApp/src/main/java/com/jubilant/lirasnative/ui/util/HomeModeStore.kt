package com.jubilant.lirasnative.ui.util

import android.content.Context

/**
 * Temporary toggle for admins to view "Owner" home until an explicit owner role is added.
 */
object HomeModeStore {
  private const val KEY_ADMIN_OWNER_MODE = "home_admin_owner_mode"

  fun isAdminOwnerModeEnabled(context: Context): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getBoolean(KEY_ADMIN_OWNER_MODE, false)
  }

  fun setAdminOwnerModeEnabled(context: Context, enabled: Boolean) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().putBoolean(KEY_ADMIN_OWNER_MODE, enabled).apply()
  }
}

