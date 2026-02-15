package com.jubilant.lirasnative.ui.util

import android.content.Context

private const val KEY_PD_MASTER_PREFIX = "pd_master_v50_"
private const val KEY_PD_DOUBTS_PREFIX = "pd_doubts_"

object PdLocalStore {
  fun loadPdMasterDraft(context: Context, applicationId: String): String? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getString(KEY_PD_MASTER_PREFIX + applicationId, null)
  }

  fun savePdMasterDraft(context: Context, applicationId: String, json: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_PD_MASTER_PREFIX + applicationId, json).apply()
  }

  fun clearPdMasterDraft(context: Context, applicationId: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().remove(KEY_PD_MASTER_PREFIX + applicationId).apply()
  }

  fun loadDoubtsDraft(context: Context, applicationId: String): String? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getString(KEY_PD_DOUBTS_PREFIX + applicationId, null)
  }

  fun saveDoubtsDraft(context: Context, applicationId: String, json: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().putString(KEY_PD_DOUBTS_PREFIX + applicationId, json).apply()
  }

  fun clearDoubtsDraft(context: Context, applicationId: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().remove(KEY_PD_DOUBTS_PREFIX + applicationId).apply()
  }
}

