package com.jubilant.lirasnative.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object RetrySyncScheduler {
  private const val WORK_NAME = "retry_sync"
  const val INPUT_ACTION_ID: String = "input_action_id"
  const val INPUT_FORCE_RUN: String = "input_force_run"

  fun enqueueNow(
    context: Context,
    actionId: String? = null,
    force: Boolean = false,
  ) {
    val constraints =
      Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    val input =
      Data.Builder()
        .putString(INPUT_ACTION_ID, actionId)
        .putBoolean(INPUT_FORCE_RUN, force)
        .build()

    val req =
      OneTimeWorkRequestBuilder<RetrySyncWorker>()
        .setConstraints(constraints)
        .setInputData(input)
        .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
      WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      req,
    )
  }

  fun cancelPending(context: Context) {
    WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
  }
}
