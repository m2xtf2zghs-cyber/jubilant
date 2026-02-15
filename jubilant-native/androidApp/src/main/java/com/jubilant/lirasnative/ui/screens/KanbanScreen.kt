package com.jubilant.lirasnative.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import android.widget.Toast
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material.icons.outlined.MoreVert
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.LeadUpdate
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private data class KanbanColumn(
  val title: String,
  val defaultStatus: String,
  val statuses: Set<String>,
)

private data class KanbanMoveTarget(
  val label: String,
  val status: String,
)

@Composable
fun KanbanScreen(
  leads: List<LeadSummary>,
  leadsRepository: LeadsRepository,
  onMutated: () -> Unit,
  onLeadClick: (id: String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val scope = rememberCoroutineScope()
  val context = LocalContext.current
  var moving by remember { mutableStateOf(setOf<String>()) }

  val columns =
    remember {
      listOf(
        KanbanColumn("New", defaultStatus = "New", statuses = setOf("New")),
        KanbanColumn("Meeting", defaultStatus = "Meeting Scheduled", statuses = setOf("Meeting Scheduled")),
        KanbanColumn("Follow-up", defaultStatus = "Follow-Up Required", statuses = setOf("Follow-Up Required", "Partner Follow-Up")),
        KanbanColumn(
          "Issues",
          defaultStatus = "Interest Rate Issue",
          statuses = setOf("Interest Rate Issue", "Statements Not Received", "Contact Details Not Received", "No Appointment"),
        ),
        KanbanColumn("Commercial", defaultStatus = "Commercial Client", statuses = setOf("Commercial Client")),
        KanbanColumn("Closed", defaultStatus = "Payment Done", statuses = setOf("Payment Done", "Deal Closed")),
        KanbanColumn(
          "Rejected",
          defaultStatus = "Not Eligible",
          statuses = setOf("Not Eligible", "Not Reliable", "Lost to Competitor", "Not Interested (Temp)"),
        ),
      )
    }

  val moveTargets =
    remember(columns) {
      columns.map { KanbanMoveTarget(label = it.title, status = it.defaultStatus) }
    }

  fun moveLead(id: String, newStatus: String) {
    if (moving.contains(id)) return
    moving = moving + id
    scope.launch {
      val result = runCatching { leadsRepository.updateLead(id, LeadUpdate(status = newStatus)) }
      moving = moving - id
      result
        .onSuccess {
          onMutated()
          Toast.makeText(context, "Moved to $newStatus", Toast.LENGTH_SHORT).show()
        }
        .onFailure {
          Toast.makeText(context, it.message ?: "Move failed.", Toast.LENGTH_LONG).show()
        }
    }
  }

  val scroll = rememberScrollState()
  Row(
    modifier = modifier.horizontalScroll(scroll),
    horizontalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    columns.forEachIndexed { index, col ->
      val items =
        leads.filter { l ->
          val s = l.status?.trim().orEmpty()
          s.isNotBlank() && s in col.statuses
        }

      val left = columns.getOrNull(index - 1)?.defaultStatus
      val right = columns.getOrNull(index + 1)?.defaultStatus

      KanbanColumnCard(
        title = col.title,
        count = items.size,
        leads = items,
        moveLeftStatus = left,
        moveRightStatus = right,
        moveTargets = moveTargets,
        movingIds = moving,
        onMove = { leadId, status -> moveLead(leadId, status) },
        onLeadClick = onLeadClick,
      )
    }
  }
}

@Composable
private fun KanbanColumnCard(
  title: String,
  count: Int,
  leads: List<LeadSummary>,
  moveLeftStatus: String?,
  moveRightStatus: String?,
  moveTargets: List<KanbanMoveTarget>,
  movingIds: Set<String>,
  onMove: (leadId: String, newStatus: String) -> Unit,
  onLeadClick: (id: String) -> Unit,
) {
  Card(
    modifier = Modifier.width(280.dp).fillMaxHeight(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        Card(
          colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
          shape = RoundedCornerShape(999.dp),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        ) {
          Text(
            text = count.toString(),
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }

      val listScroll = rememberScrollState()
      Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(listScroll),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        if (leads.isEmpty()) {
          Text(
            text = "No items",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        } else {
          leads.forEach { lead ->
            val busy = movingIds.contains(lead.id)
            KanbanLeadTile(
              lead = lead,
              canMoveLeft = moveLeftStatus != null,
              canMoveRight = moveRightStatus != null,
              busy = busy,
              onMoveLeft = { moveLeftStatus?.let { onMove(lead.id, it) } },
              onMoveRight = { moveRightStatus?.let { onMove(lead.id, it) } },
              onMoveTo = { status -> onMove(lead.id, status) },
              moveTargets = moveTargets,
              onClick = { onLeadClick(lead.id) },
            )
          }
          Spacer(Modifier.height(6.dp))
        }
      }
    }
  }
}

@Composable
private fun KanbanLeadTile(
  lead: LeadSummary,
  canMoveLeft: Boolean,
  canMoveRight: Boolean,
  busy: Boolean,
  onMoveLeft: () -> Unit,
  onMoveRight: () -> Unit,
  onMoveTo: (newStatus: String) -> Unit,
  moveTargets: List<KanbanMoveTarget>,
  onClick: () -> Unit,
) {
  val density = LocalDensity.current
  val thresholdPx = with(density) { 60.dp.toPx() }
  val maxOffsetPx = with(density) { 36.dp.toPx() }
  var dragX by remember { mutableFloatStateOf(0f) }
  var menuOpen by remember { mutableStateOf(false) }

  val stripe = statusStripeColor(lead.status)
  Card(
    modifier =
      Modifier
        .fillMaxWidth()
        .offset { IntOffset(dragX.coerceIn(-maxOffsetPx, maxOffsetPx).roundToInt(), 0) }
        .pointerInput(canMoveLeft, canMoveRight, busy) {
          if (busy) return@pointerInput
          detectDragGesturesAfterLongPress(
            onDragCancel = { dragX = 0f },
            onDragEnd = {
              val dx = dragX
              dragX = 0f
              if (dx > thresholdPx && canMoveRight) onMoveRight()
              else if (dx < -thresholdPx && canMoveLeft) onMoveLeft()
            },
            onDrag = { change, dragAmount ->
              change.consume()
              dragX += dragAmount.x
            },
          )
        }
        .clickable(enabled = !busy, onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    shape = MaterialTheme.shapes.large,
  ) {
    Row(modifier = Modifier.fillMaxWidth()) {
      Box(modifier = Modifier.width(4.dp).height(58.dp).background(stripe))
      Column(modifier = Modifier.padding(10.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(lead.name, style = MaterialTheme.typography.titleSmall, maxLines = 1)
        val sub =
          listOfNotNull(lead.company?.takeIf { it.isNotBlank() }, lead.location?.takeIf { it.isNotBlank() })
            .joinToString(" • ")
        if (sub.isNotBlank()) {
          Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
          LeadStatusPill(status = lead.status)
          val next = lead.nextFollowUp?.let(::formatShortDate).orEmpty()
          if (next.isNotBlank()) {
            Text(
              text = next,
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }

          Spacer(Modifier.weight(1f))

          if (busy) {
            CircularProgressIndicator(
              modifier = Modifier.width(18.dp).height(18.dp),
              strokeWidth = 2.dp,
            )
          } else {
            if (canMoveLeft) {
              IconButton(onClick = onMoveLeft) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Move left")
              }
            }
            if (canMoveRight) {
              IconButton(onClick = onMoveRight) {
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = "Move right")
              }
            }

            IconButton(onClick = { menuOpen = true }) {
              Icon(Icons.Outlined.MoreVert, contentDescription = "More")
            }

            DropdownMenu(
              expanded = menuOpen,
              onDismissRequest = { menuOpen = false },
            ) {
              val current = lead.status?.trim().orEmpty()
              moveTargets.forEach { target ->
                DropdownMenuItem(
                  text = { Text("Move to ${target.label}") },
                  enabled = target.status != current,
                  onClick = {
                    menuOpen = false
                    onMoveTo(target.status)
                  },
                )
              }
            }
          }
        }
      }
    }
  }
}
