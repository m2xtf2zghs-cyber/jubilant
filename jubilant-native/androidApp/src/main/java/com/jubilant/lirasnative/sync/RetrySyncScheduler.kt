package com.jubilant.lirasnative.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object RetrySyncScheduler {
  private const val WORK_NAME = "retry_sync"

  fun enqueueNow(context: Context) {
    val constraints =
      Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    val req =
      OneTimeWorkRequestBuilder<RetrySyncWorker>()
        .setConstraints(constraints)
        .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
      WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      req,
    )
  }
}

