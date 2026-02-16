package com.jubilant.lirasnative.ui.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.ui.components.BrandMark
import com.jubilant.lirasnative.ui.designsystem.tokens.AppMotion
import com.jubilant.lirasnative.ui.designsystem.tokens.AppRadius
import com.jubilant.lirasnative.ui.designsystem.tokens.AppSpacing
import com.jubilant.lirasnative.ui.designsystem.tokens.AppTypographyTokens
import com.jubilant.lirasnative.ui.theme.BrandPrimary
import com.jubilant.lirasnative.ui.theme.BrandPrimarySubtle
import com.jubilant.lirasnative.ui.theme.SemanticCritical
import com.jubilant.lirasnative.ui.theme.SemanticInfo
import com.jubilant.lirasnative.ui.theme.SemanticSuccess
import com.jubilant.lirasnative.ui.theme.SemanticWarning
import com.jubilant.lirasnative.ui.theme.TextPrimaryDark
import com.jubilant.lirasnative.ui.theme.JubilantNativeTheme

enum class RiskLevel {
  LOW,
  MED,
  HIGH,
  CRITICAL,
}

enum class StageStatus {
  NEW,
  IN_REVIEW,
  APPROVED,
  REJECTED,
  COLLECTIONS,
}

enum class SyncState {
  ONLINE,
  SYNCING,
  OFFLINE,
}

data class RowAction(
  val icon: ImageVector,
  val description: String,
  val enabled: Boolean = true,
  val onClick: () -> Unit,
)

data class EvidenceColumn(
  val key: String,
  val label: String,
  val weight: Float = 1f,
  val numeric: Boolean = false,
)

data class EvidenceRow(
  val id: String,
  val cells: Map<String, String>,
  val narration: String = "",
  val month: String? = null,
  val category: String? = null,
  val flag: String? = null,
)

@Composable
fun AppTopBar(
  userName: String,
  syncStatus: SyncState,
  modifier: Modifier = Modifier,
  onProfileClick: (() -> Unit)? = null,
  actions: (@Composable RowScope.() -> Unit)? = null,
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.Space16, vertical = AppSpacing.Space12),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        BrandMark(size = 30.dp)
        Spacer(Modifier.width(AppSpacing.Space12))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(
            text = "Jubilant Capital",
            style = AppTypographyTokens.Value16,
            color = MaterialTheme.colorScheme.onBackground,
          )
          Text(
            text = userName.ifBlank { "Unknown user" },
            style = AppTypographyTokens.Helper12,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }
        if (actions != null) {
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space4), content = actions)
        }
        ProfileBadge(name = userName, onClick = onProfileClick)
      }
      Row(
        modifier = Modifier.fillMaxWidth().padding(start = AppSpacing.Space16, end = AppSpacing.Space16, bottom = AppSpacing.Space12),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        SyncStatusChip(status = syncStatus)
      }
      HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
  }
}

@Composable
private fun ProfileBadge(
  name: String,
  onClick: (() -> Unit)?,
) {
  val bg = if (MaterialTheme.colorScheme.background.luminance() > 0.5f) Color.Black.copy(alpha = 0.08f) else TextPrimaryDark.copy(alpha = 0.14f)
  Box(
    modifier =
      Modifier
        .size(36.dp)
        .clip(CircleShape)
        .background(bg)
        .then(
          if (onClick != null) {
            Modifier.clickable(onClick = onClick)
          } else {
            Modifier
          },
        ),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text = initialsFrom(name),
      style = AppTypographyTokens.Chip12,
      color = MaterialTheme.colorScheme.onBackground,
    )
  }
}

@Composable
fun PortfolioPanel(
  activePipeline: String,
  overdue: String,
  todayAction: String,
  modifier: Modifier = Modifier,
  approvalsPending: String? = null,
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(AppRadius.Radius16),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(AppSpacing.CardPadding), verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8)) {
        Text(
          text = "Portfolio",
          style = AppTypographyTokens.Title20,
          color = MaterialTheme.colorScheme.onSurface,
          modifier = Modifier.weight(1f),
        )
        approvalsPending?.let {
          StatusChip(label = "$it pending", color = SemanticWarning)
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space12), modifier = Modifier.fillMaxWidth()) {
        PanelMetric(label = "Active Pipeline", value = activePipeline, modifier = Modifier.weight(1f))
        PanelMetric(label = "Overdue", value = overdue, modifier = Modifier.weight(1f))
        PanelMetric(label = "Today Action", value = todayAction, modifier = Modifier.weight(1f))
      }
    }
  }
}

@Composable
private fun PanelMetric(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(
      text = value,
      style = AppTypographyTokens.Display28,
      color = MaterialTheme.colorScheme.onSurface,
      maxLines = 1,
    )
    Text(
      text = label,
      style = AppTypographyTokens.Helper12,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
  }
}

@Composable
fun StatCard(
  value: String,
  label: String,
  modifier: Modifier = Modifier,
  trend: String? = null,
  onClick: (() -> Unit)? = null,
) {
  Card(
    modifier = modifier.then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
    shape = RoundedCornerShape(AppRadius.Radius12),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(AppSpacing.CardPadding),
      verticalArrangement = Arrangement.spacedBy(AppSpacing.Space4),
    ) {
      Text(text = value, style = AppTypographyTokens.Value16, color = MaterialTheme.colorScheme.onSurface)
      Text(text = label, style = AppTypographyTokens.Body14, color = MaterialTheme.colorScheme.onSurfaceVariant)
      if (!trend.isNullOrBlank()) {
        Text(text = trend, style = AppTypographyTokens.Helper12, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
  }
}

@Composable
fun MetricRow(
  label: String,
  value: String,
  modifier: Modifier = Modifier,
  helper: String? = null,
) {
  Row(
    modifier = modifier.fillMaxWidth().padding(horizontal = AppSpacing.Space12, vertical = AppSpacing.Space8),
    horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(text = label, style = AppTypographyTokens.Body14, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
    Column(horizontalAlignment = Alignment.End) {
      Text(text = value, style = AppTypographyTokens.Value16, color = MaterialTheme.colorScheme.onSurface, textAlign = TextAlign.End)
      if (!helper.isNullOrBlank()) {
        Text(text = helper, style = AppTypographyTokens.Helper12, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.End)
      }
    }
  }
}

@Composable
fun RiskBadge(
  level: RiskLevel,
  modifier: Modifier = Modifier,
) {
  val label = level.name
  val color =
    when (level) {
      RiskLevel.LOW -> SemanticSuccess
      RiskLevel.MED -> SemanticWarning
      RiskLevel.HIGH -> SemanticCritical
      RiskLevel.CRITICAL -> SemanticCritical
    }
  StatusChip(label = label, color = color, modifier = modifier)
}

@Composable
fun StatusChip(
  status: StageStatus,
  modifier: Modifier = Modifier,
) {
  val color =
    when (status) {
      StageStatus.NEW -> SemanticInfo
      StageStatus.IN_REVIEW -> SemanticWarning
      StageStatus.APPROVED -> SemanticSuccess
      StageStatus.REJECTED -> SemanticCritical
      StageStatus.COLLECTIONS -> SemanticWarning
    }
  StatusChip(label = status.name.replace('_', ' '), color = color, modifier = modifier)
}

@Composable
fun SyncStatusChip(
  status: SyncState,
  modifier: Modifier = Modifier,
) {
  val color =
    when (status) {
      SyncState.ONLINE -> SemanticSuccess
      SyncState.SYNCING -> SemanticWarning
      SyncState.OFFLINE -> SemanticCritical
    }
  StatusChip(label = status.name, color = color, modifier = modifier)
}

@Composable
fun StatusChip(
  label: String,
  color: Color,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier,
    colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.16f)),
    border = BorderStroke(1.dp, color.copy(alpha = 0.45f)),
    shape = RoundedCornerShape(AppRadius.Radius8),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Text(
      text = label,
      modifier = Modifier.padding(horizontal = AppSpacing.Space8, vertical = AppSpacing.Space4),
      style = AppTypographyTokens.Chip12,
      color = color,
    )
  }
}

@Composable
fun SectionHeader(
  title: String,
  modifier: Modifier = Modifier,
  actionLabel: String? = null,
  onActionClick: (() -> Unit)? = null,
) {
  Column(
    modifier = modifier.fillMaxWidth().padding(top = AppSpacing.SectionGap),
    verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
      Text(
        text = title,
        style = AppTypographyTokens.Title20,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.weight(1f),
      )
      if (!actionLabel.isNullOrBlank() && onActionClick != null) {
        TextButton(onClick = onActionClick) {
          Text(text = actionLabel, style = AppTypographyTokens.Body14, color = BrandPrimary)
        }
      }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
  }
}

@Composable
fun ListRow(
  title: String,
  subtitle: String,
  meta: String,
  modifier: Modifier = Modifier,
  leadingChip: (@Composable () -> Unit)? = null,
  actions: List<RowAction> = emptyList(),
  showChevron: Boolean = actions.isEmpty(),
  onClick: () -> Unit,
) {
  Row(
    modifier =
      modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(AppRadius.Radius12))
        .clickable(onClick = onClick)
        .padding(horizontal = AppSpacing.Space12, vertical = AppSpacing.Space8)
        .defaultMinSize(minHeight = AppSpacing.MinListRowHeight),
    horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    if (leadingChip != null) {
      leadingChip()
    }
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(text = title, style = AppTypographyTokens.Value16, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text(text = subtitle, style = AppTypographyTokens.Helper12, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text(text = meta, style = AppTypographyTokens.Helper12, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    if (actions.isNotEmpty()) {
      Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space4), verticalAlignment = Alignment.CenterVertically) {
        actions.forEach { action ->
          IconButton(onClick = action.onClick, enabled = action.enabled, modifier = Modifier.size(AppSpacing.MinTapTarget)) {
            Icon(imageVector = action.icon, contentDescription = action.description, tint = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
      }
    } else if (showChevron) {
      Icon(
        imageVector = Icons.AutoMirrored.Outlined.KeyboardArrowRight,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun EvidenceTable(
  columns: List<EvidenceColumn>,
  rows: List<EvidenceRow>,
  monthOptions: List<String>,
  selectedMonth: String?,
  onMonthSelected: (String?) -> Unit,
  categoryOptions: List<String>,
  selectedCategory: String?,
  onCategorySelected: (String?) -> Unit,
  flagOptions: List<String>,
  selectedFlag: String?,
  onFlagSelected: (String?) -> Unit,
  modifier: Modifier = Modifier,
) {
  var expandedRowId by rememberSaveable { mutableStateOf<String?>(null) }

  val filteredRows =
    remember(rows, selectedMonth, selectedCategory, selectedFlag) {
      rows.filter { row ->
        (selectedMonth == null || row.month == selectedMonth) &&
          (selectedCategory == null || row.category == selectedCategory) &&
          (selectedFlag == null || row.flag == selectedFlag)
      }
    }

  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12)) {
    FilterRow(
      title = "Month",
      options = monthOptions,
      selected = selectedMonth,
      onSelected = onMonthSelected,
    )
    FilterRow(
      title = "Category",
      options = categoryOptions,
      selected = selectedCategory,
      onSelected = onCategorySelected,
    )
    FilterRow(
      title = "Flag",
      options = flagOptions,
      selected = selectedFlag,
      onSelected = onFlagSelected,
    )

    Card(
      modifier = Modifier.fillMaxWidth(),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
      shape = RoundedCornerShape(AppRadius.Radius12),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
      LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(min = 180.dp, max = 420.dp)) {
        item {
          Row(
            modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant).padding(horizontal = AppSpacing.Space12, vertical = AppSpacing.Space8),
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
          ) {
            columns.forEach { col ->
              Text(
                text = col.label,
                modifier = Modifier.weight(col.weight),
                textAlign = if (col.numeric) TextAlign.End else TextAlign.Start,
                style = AppTypographyTokens.Chip12,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            }
          }
        }

        items(filteredRows, key = { it.id }) { row ->
          Column(
            modifier =
              Modifier
                .fillMaxWidth()
                .clickable { expandedRowId = if (expandedRowId == row.id) null else row.id }
                .padding(horizontal = AppSpacing.Space12, vertical = AppSpacing.Space12),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
          ) {
            Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8), modifier = Modifier.fillMaxWidth()) {
              columns.forEach { col ->
                Text(
                  text = row.cells[col.key].orEmpty(),
                  modifier = Modifier.weight(col.weight),
                  textAlign = if (col.numeric) TextAlign.End else TextAlign.Start,
                  style = AppTypographyTokens.Body14,
                  color = MaterialTheme.colorScheme.onSurface,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis,
                )
              }
            }
            AnimatedVisibility(
              visible = expandedRowId == row.id && row.narration.isNotBlank(),
              enter = fadeIn() + expandVertically(),
              exit = fadeOut() + shrinkVertically(),
            ) {
              Text(
                text = row.narration,
                style = AppTypographyTokens.Helper12,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
          }
        }
      }
    }
  }
}

@Composable
private fun FilterRow(
  title: String,
  options: List<String>,
  selected: String?,
  onSelected: (String?) -> Unit,
) {
  LazyRow(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8), modifier = Modifier.fillMaxWidth()) {
    item {
      FilterChip(
        selected = selected == null,
        onClick = { onSelected(null) },
        label = { Text("$title: All", style = AppTypographyTokens.Chip12) },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedContainerColor = BrandPrimarySubtle,
            selectedLabelColor = MaterialTheme.colorScheme.onSurface,
          ),
      )
    }
    items(options) { option ->
      FilterChip(
        selected = option == selected,
        onClick = { onSelected(option) },
        label = { Text(option, style = AppTypographyTokens.Chip12) },
        colors =
          FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            selectedContainerColor = BrandPrimarySubtle,
            selectedLabelColor = MaterialTheme.colorScheme.onSurface,
          ),
      )
    }
  }
}

@Composable
fun AccordionSection(
  title: String,
  isComplete: Boolean,
  autosaveLabel: String,
  modifier: Modifier = Modifier,
  initiallyExpanded: Boolean = false,
  content: @Composable () -> Unit,
) {
  var expanded by rememberSaveable { mutableStateOf(initiallyExpanded) }
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(AppRadius.Radius12),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(horizontal = AppSpacing.Space16, vertical = AppSpacing.Space12),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
      ) {
        Text(
          text = title,
          style = AppTypographyTokens.Value16,
          color = MaterialTheme.colorScheme.onSurface,
          modifier = Modifier.weight(1f),
        )
        if (isComplete) {
          Icon(
            imageVector = Icons.Outlined.CheckCircle,
            contentDescription = null,
            tint = SemanticSuccess,
            modifier = Modifier.size(18.dp),
          )
        }
        Icon(
          imageVector = if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      AnimatedVisibility(
        visible = expanded,
        enter = fadeIn(animationSpec = tween(AppMotion.DurationMed, easing = AppMotion.EasingStandard)) +
          expandVertically(animationSpec = tween(AppMotion.DurationMed, easing = AppMotion.EasingStandard)),
        exit = fadeOut(animationSpec = tween(AppMotion.DurationFast, easing = AppMotion.EasingStandard)) +
          shrinkVertically(animationSpec = tween(AppMotion.DurationFast, easing = AppMotion.EasingStandard)),
      ) {
        Column(
          modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.Space16, vertical = AppSpacing.Space12),
          verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
        ) {
          Text(text = autosaveLabel, style = AppTypographyTokens.Helper12, color = MaterialTheme.colorScheme.onSurfaceVariant)
          content()
        }
      }
    }
  }
}

@Composable
fun PrimaryActionCard(
  title: String,
  subtitle: String,
  ctaLabel: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(AppRadius.Radius16),
    colors = CardDefaults.cardColors(containerColor = BrandPrimary),
    border = BorderStroke(1.dp, BrandPrimary.copy(alpha = 0.8f)),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(AppSpacing.CardPadding),
      verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
    ) {
      Text(title, style = AppTypographyTokens.Title20, color = Color.White)
      Text(subtitle, style = AppTypographyTokens.Body14, color = Color.White.copy(alpha = 0.92f))
      TextButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().heightIn(min = AppSpacing.MinTapTarget),
      ) {
        Text(ctaLabel, style = AppTypographyTokens.Value16, color = Color.White)
      }
    }
  }
}

@Composable
fun EmptyState(
  title: String,
  subtitle: String,
  ctaLabel: String,
  onCtaClick: () -> Unit,
  modifier: Modifier = Modifier,
  icon: ImageVector = Icons.Outlined.CheckCircle,
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(AppRadius.Radius12),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(AppSpacing.Space16),
      verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Icon(imageVector = icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(title, style = AppTypographyTokens.Value16, color = MaterialTheme.colorScheme.onSurface)
      Text(
        subtitle,
        style = AppTypographyTokens.Helper12,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
      )
      TextButton(onClick = onCtaClick) {
        Text(text = ctaLabel, style = AppTypographyTokens.Body14, color = BrandPrimary)
      }
    }
  }
}

@Composable
fun CardSkeleton(
  modifier: Modifier = Modifier,
) {
  val brush = shimmerBrush()
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(AppRadius.Radius12),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(modifier = Modifier.fillMaxWidth().padding(AppSpacing.Space16), verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8)) {
      Box(modifier = Modifier.fillMaxWidth(0.35f).height(12.dp).background(brush, RoundedCornerShape(6.dp)))
      Box(modifier = Modifier.fillMaxWidth(0.7f).height(22.dp).background(brush, RoundedCornerShape(8.dp)))
      Box(modifier = Modifier.fillMaxWidth(0.5f).height(12.dp).background(brush, RoundedCornerShape(6.dp)))
    }
  }
}

@Composable
fun ListSkeleton(
  rows: Int,
  modifier: Modifier = Modifier,
) {
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8)) {
    repeat(rows.coerceAtLeast(1)) {
      ListRowSkeleton()
    }
  }
}

@Composable
fun ListRowSkeleton(
  modifier: Modifier = Modifier,
) {
  val brush = shimmerBrush()
  Row(
    modifier = modifier.fillMaxWidth().padding(horizontal = AppSpacing.Space12, vertical = AppSpacing.Space8),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
  ) {
    Box(modifier = Modifier.size(28.dp).clip(CircleShape).background(brush))
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(AppSpacing.Space4)) {
      Box(modifier = Modifier.fillMaxWidth(0.7f).height(12.dp).background(brush, RoundedCornerShape(6.dp)))
      Box(modifier = Modifier.fillMaxWidth(0.45f).height(10.dp).background(brush, RoundedCornerShape(5.dp)))
    }
    Box(modifier = Modifier.size(20.dp).clip(CircleShape).background(brush))
  }
}

@Composable
private fun shimmerBrush(): Brush {
  val transition = rememberInfiniteTransition(label = "skeleton")
  val progress by transition.animateFloat(
    initialValue = 0f,
    targetValue = 1000f,
    animationSpec = infiniteRepeatable(animation = tween(1200, easing = LinearEasing), repeatMode = RepeatMode.Restart),
    label = "shimmer",
  )

  val base = MaterialTheme.colorScheme.surfaceVariant
  return Brush.linearGradient(
    colors = listOf(base.copy(alpha = 0.35f), base.copy(alpha = 0.7f), base.copy(alpha = 0.35f)),
    start = androidx.compose.ui.geometry.Offset(progress - 220f, 0f),
    end = androidx.compose.ui.geometry.Offset(progress, 240f),
  )
}

private fun initialsFrom(name: String): String {
  val parts = name.trim().split(" ").filter { it.isNotBlank() }
  if (parts.isEmpty()) return "JC"
  if (parts.size == 1) return parts.first().take(2).uppercase()
  return (parts[0].take(1) + parts[1].take(1)).uppercase()
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun ComponentsPreview() {
  JubilantNativeTheme {
    Column(
      modifier = Modifier.background(MaterialTheme.colorScheme.background).padding(AppSpacing.Space16),
      verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
    ) {
      AppTopBar(userName = "Ravi Kumar", syncStatus = SyncState.SYNCING)
      PortfolioPanel(activePipeline = "₹4.2Cr", overdue = "₹38L", todayAction = "19", approvalsPending = "7")
      Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8), modifier = Modifier.fillMaxWidth()) {
        StatCard(value = "34", label = "Approvals")
        StatCard(value = "12", label = "Collections")
      }
      MetricRow(label = "Today action", value = "19", helper = "8 overdue")
      RiskBadge(level = RiskLevel.HIGH)
      AccordionSection(title = "PD Summary", isComplete = false, autosaveLabel = "Autosave: 12:24 PM") {
        Text("Accordion content", style = AppTypographyTokens.Body14)
      }
      PrimaryActionCard(
        title = "Submit for approval",
        subtitle = "Checklist complete for this case.",
        ctaLabel = "Submit",
        onClick = {},
      )
    }
  }
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun EvidencePreview() {
  JubilantNativeTheme {
    var month by remember { mutableStateOf<String?>(null) }
    var category by remember { mutableStateOf<String?>(null) }
    var flag by remember { mutableStateOf<String?>(null) }

    val columns =
      listOf(
        EvidenceColumn(key = "date", label = "Date"),
        EvidenceColumn(key = "party", label = "Party", weight = 1.5f),
        EvidenceColumn(key = "dr", label = "Dr", numeric = true),
        EvidenceColumn(key = "cr", label = "Cr", numeric = true),
      )
    val rows =
      listOf(
        EvidenceRow(
          id = "1",
          month = "2026-01",
          category = "Suppliers",
          flag = "High",
          narration = "Repeat outward to key vendor cluster.",
          cells = mapOf("date" to "02 Jan", "party" to "AA Metals", "dr" to "1,22,000", "cr" to "0"),
        ),
      )

    Column(
      modifier = Modifier.background(MaterialTheme.colorScheme.background).padding(AppSpacing.Space16),
      verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
    ) {
      EvidenceTable(
        columns = columns,
        rows = rows,
        monthOptions = listOf("2026-01"),
        selectedMonth = month,
        onMonthSelected = { month = it },
        categoryOptions = listOf("Suppliers"),
        selectedCategory = category,
        onCategorySelected = { category = it },
        flagOptions = listOf("High"),
        selectedFlag = flag,
        onFlagSelected = { flag = it },
      )
    }
  }
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun EmptyAndSkeletonPreview() {
  JubilantNativeTheme {
    Column(
      modifier = Modifier.background(MaterialTheme.colorScheme.background).padding(AppSpacing.Space16),
      verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
    ) {
      EmptyState(
        title = "No tasks for now",
        subtitle = "Your queue is clear. Pull latest data to refresh.",
        ctaLabel = "Sync now",
        onCtaClick = {},
      )
      CardSkeleton()
      ListSkeleton(rows = 3)
    }
  }
}
