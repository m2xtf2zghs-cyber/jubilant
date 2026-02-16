package com.jubilant.lirasnative.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.ui.util.RetryQueueAction
import com.jubilant.lirasnative.ui.util.RetryQueueStore
import java.time.Instant
import kotlinx.coroutines.launch

private data class LeadConflictItem(
  val action: RetryQueueAction.LeadUpdateAction,
  val serverSnapshot: String?,
  val differences: List<String>,
)

@Composable
fun ConflictResolverScreen(
  leadsRepository: LeadsRepository,
  onMutated: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val appContext = context.applicationContext
  val scope = rememberCoroutineScope()
  var loading by remember { mutableStateOf(true) }
  var items by remember { mutableStateOf(emptyList<LeadConflictItem>()) }
  var busyActionId by remember { mutableStateOf<String?>(null) }

  fun refresh() {
    scope.launch {
      loading = true
      val queue = RetryQueueStore.load(appContext).filterIsInstance<RetryQueueAction.LeadUpdateAction>()
      val next =
        queue.map { action ->
          val server = runCatching { leadsRepository.getLead(action.leadId) }.getOrNull()
          val diffs =
            buildList {
              if (server != null) {
                action.patch.status?.let { if ((server.status ?: "") != it) add("Status: local=$it / server=${server.status ?: "-"}") }
                action.patch.loanAmount?.let { if ((server.loanAmount ?: 0L) != it) add("Amount: local=$it / server=${server.loanAmount ?: 0L}") }
                action.patch.nextFollowUp?.let { if ((server.nextFollowUp ?: "") != it) add("Next follow-up differs") }
                action.patch.phone?.let { if ((server.phone ?: "") != it) add("Phone: local=$it / server=${server.phone ?: "-"}") }
                action.patch.location?.let { if ((server.location ?: "") != it) add("Location differs") }
                action.patch.company?.let { if ((server.company ?: "") != it) add("Company differs") }
                action.patch.ownerId?.let { if ((server.ownerId ?: "") != it) add("Owner differs") }
                action.patch.isHighPotential?.let { if ((server.isHighPotential ?: false) != it) add("High potential differs") }
              }
            }
          LeadConflictItem(
            action = action,
            serverSnapshot = server?.name,
            differences = diffs,
          )
        }
      items = next
      loading = false
    }
  }

  LaunchedEffect(Unit) { refresh() }

  Column(modifier = modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Conflict Resolver", style = MaterialTheme.typography.titleMedium)
        Text(
          "Review queued local edits against current server snapshot and choose how to resolve.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(onClick = { refresh() }, modifier = Modifier.fillMaxWidth(), enabled = !loading) {
          Text("Refresh conflicts")
        }
      }
    }

    if (loading) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
        CircularProgressIndicator()
      }
      return@Column
    }

    if (items.isEmpty()) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      ) {
        Text(
          "No queued lead updates to resolve.",
          modifier = Modifier.padding(14.dp),
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      return@Column
    }

    LazyColumn(modifier = Modifier.fillMaxWidth().weight(1f, true), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      items(items, key = { it.action.id }) { item ->
        val busy = busyActionId == item.action.id
        Card(
          modifier = Modifier.fillMaxWidth(),
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        ) {
          Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Lead ${item.serverSnapshot ?: item.action.leadId.take(8)}", style = MaterialTheme.typography.titleSmall)
            Text(
              "Queued: ${Instant.ofEpochMilli(item.action.createdAtMs)}",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (item.serverSnapshot == null) {
              Text(
                "Could not fetch server snapshot (offline or permission issue).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
              )
            } else if (item.differences.isEmpty()) {
              Text(
                "No explicit field conflict detected. You can apply local now or discard.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            } else {
              item.differences.forEach { diff ->
                Text(diff, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
              Button(
                onClick = {
                  busyActionId = item.action.id
                  scope.launch {
                    runCatching {
                      leadsRepository.updateLead(item.action.leadId, item.action.patch)
                    }.onSuccess {
                      RetryQueueStore.removeById(appContext, item.action.id)
                      onMutated()
                      Toast.makeText(context, "Applied local update.", Toast.LENGTH_SHORT).show()
                      refresh()
                    }.onFailure {
                      Toast.makeText(context, it.message ?: "Couldn’t apply local update.", Toast.LENGTH_LONG).show()
                    }
                    busyActionId = null
                  }
                },
                enabled = !busy,
                modifier = Modifier.weight(1f),
              ) {
                Text("Apply Local")
              }
              OutlinedButton(
                onClick = {
                  RetryQueueStore.removeById(appContext, item.action.id)
                  Toast.makeText(context, "Local queued change discarded.", Toast.LENGTH_SHORT).show()
                  refresh()
                },
                enabled = !busy,
                modifier = Modifier.weight(1f),
              ) {
                Text("Use Server")
              }
            }
          }
        }
      }
    }
  }
}

