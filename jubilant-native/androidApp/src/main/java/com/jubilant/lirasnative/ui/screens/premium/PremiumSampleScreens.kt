package com.jubilant.lirasnative.ui.screens.premium

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.jubilant.lirasnative.ui.designsystem.components.AccordionSection
import com.jubilant.lirasnative.ui.designsystem.components.AppTopBar
import com.jubilant.lirasnative.ui.designsystem.components.EvidenceColumn
import com.jubilant.lirasnative.ui.designsystem.components.EvidenceRow
import com.jubilant.lirasnative.ui.designsystem.components.EvidenceTable
import com.jubilant.lirasnative.ui.designsystem.components.ListRow
import com.jubilant.lirasnative.ui.designsystem.components.PortfolioPanel
import com.jubilant.lirasnative.ui.designsystem.components.PrimaryActionCard
import com.jubilant.lirasnative.ui.designsystem.components.RiskBadge
import com.jubilant.lirasnative.ui.designsystem.components.RiskLevel
import com.jubilant.lirasnative.ui.designsystem.components.RowAction
import com.jubilant.lirasnative.ui.designsystem.components.SectionHeader
import com.jubilant.lirasnative.ui.designsystem.components.StageStatus
import com.jubilant.lirasnative.ui.designsystem.components.StatCard
import com.jubilant.lirasnative.ui.designsystem.components.StatusChip
import com.jubilant.lirasnative.ui.designsystem.components.SyncState
import com.jubilant.lirasnative.ui.designsystem.tokens.AppSpacing
import com.jubilant.lirasnative.ui.designsystem.tokens.AppTypographyTokens
import com.jubilant.lirasnative.ui.theme.JubilantNativeTheme

@Composable
fun PremiumHomeExampleScreen(
  modifier: Modifier = Modifier,
) {
  LazyColumn(
    modifier = modifier.fillMaxSize(),
    verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
  ) {
    item {
      AppTopBar(userName = "Rahul Sharma", syncStatus = SyncState.SYNCING)
    }
    item {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
      ) {
        PortfolioPanel(
          activePipeline = "₹4.52Cr",
          overdue = "₹31L",
          todayAction = "22",
          approvalsPending = "9",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8), modifier = Modifier.fillMaxWidth()) {
          StatusChip(status = StageStatus.IN_REVIEW)
          RiskBadge(level = RiskLevel.HIGH)
          RiskBadge(level = RiskLevel.CRITICAL)
        }
      }
    }
    item {
      Column(modifier = Modifier.padding(horizontal = AppSpacing.ScreenPadding)) {
        SectionHeader(title = "Work Queue", actionLabel = "View all", onActionClick = {})
      }
    }
    items(
      listOf(
        "Follow up with AFFAN METALS for bank statement continuity",
        "Approve PD pack for R K Traders",
        "Collection callback due for Super Steel",
      ),
    ) { title ->
      ListRow(
        modifier = Modifier.padding(horizontal = AppSpacing.ScreenPadding),
        title = title,
        subtitle = "Next best action",
        meta = "Due today",
        leadingChip = { StatusChip(status = StageStatus.COLLECTIONS) },
        onClick = {},
      )
    }
    item {
      Column(modifier = Modifier.padding(horizontal = AppSpacing.ScreenPadding)) {
        SectionHeader(title = "Alerts")
        AccordionSection(
          title = "Signals and triggers",
          isComplete = false,
          autosaveLabel = "Live feed",
          initiallyExpanded = true,
        ) {
          Text("2 bounce alerts, 1 lender overlap, 3 missing docs.", style = AppTypographyTokens.Body14)
        }
      }
    }
  }
}

@Composable
fun PremiumLeadsExampleScreen(
  modifier: Modifier = Modifier,
) {
  val rows =
    listOf(
      Triple("AFFAN METALS", "Exposure ₹34L", "Next action: 16 Feb"),
      Triple("RK TRADERS", "Exposure ₹18L", "Next action: 17 Feb"),
      Triple("SHIVAM PLY", "Exposure ₹11L", "Next action: 18 Feb"),
    )

  LazyColumn(
    modifier = modifier.fillMaxSize().padding(AppSpacing.ScreenPadding),
    verticalArrangement = Arrangement.spacedBy(AppSpacing.Space8),
  ) {
    item {
      SectionHeader(title = "Leads")
    }
    items(rows) { row ->
      ListRow(
        title = row.first,
        subtitle = row.second,
        meta = row.third,
        leadingChip = { RiskBadge(level = RiskLevel.MED) },
        actions =
          listOf(
            RowAction(icon = Icons.Outlined.Call, description = "Call", onClick = {}),
            RowAction(icon = Icons.Outlined.Chat, description = "WhatsApp", onClick = {}),
            RowAction(icon = Icons.Outlined.EditNote, description = "Note", onClick = {}),
            RowAction(icon = Icons.Outlined.CheckCircle, description = "Done", onClick = {}),
          ),
        onClick = {},
      )
    }
  }
}

@Composable
fun PremiumLeadDetailShellExample(
  modifier: Modifier = Modifier,
) {
  Column(
    modifier = modifier.fillMaxSize().padding(AppSpacing.ScreenPadding),
    verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
  ) {
    SectionHeader(title = "Lead Summary")
    StatCard(value = "₹34L", label = "Exposure")
    AccordionSection(title = "Underwriting", isComplete = true, autosaveLabel = "Updated 2 mins ago") {
      Text("Decision: Accept with control", style = AppTypographyTokens.Body14)
    }
    AccordionSection(title = "PD", isComplete = false, autosaveLabel = "Autosave active") {
      Text("3 doubts generated from underwriting flags", style = AppTypographyTokens.Body14)
    }
    AccordionSection(title = "Collections", isComplete = false, autosaveLabel = "Queue status synced") {
      Text("No missed payments in last 30 days", style = AppTypographyTokens.Body14)
    }
    AccordionSection(title = "Documents", isComplete = false, autosaveLabel = "Last upload: today") {
      Text("GST, ITR, bank statements available", style = AppTypographyTokens.Body14)
    }
  }
}

@Composable
fun PremiumUnderwritingEvidenceExample(
  modifier: Modifier = Modifier,
) {
  var month by remember { mutableStateOf<String?>(null) }
  var category by remember { mutableStateOf<String?>(null) }
  var flag by remember { mutableStateOf<String?>(null) }

  val columns =
    listOf(
      EvidenceColumn(key = "date", label = "Date", weight = 1f),
      EvidenceColumn(key = "party", label = "Counterparty", weight = 1.6f),
      EvidenceColumn(key = "dr", label = "Dr", weight = 1f, numeric = true),
      EvidenceColumn(key = "cr", label = "Cr", weight = 1f, numeric = true),
      EvidenceColumn(key = "bal", label = "Balance", weight = 1f, numeric = true),
    )

  val rows =
    listOf(
      EvidenceRow(
        id = "1",
        month = "2026-01",
        category = "Suppliers",
        flag = "High",
        narration = "Bulk outward payment to repeat supplier cluster.",
        cells = mapOf("date" to "02 Jan", "party" to "AA Metals", "dr" to "1,22,000", "cr" to "0", "bal" to "7,32,410"),
      ),
      EvidenceRow(
        id = "2",
        month = "2026-01",
        category = "Collections",
        flag = "Low",
        narration = "Regular inward collection pattern.",
        cells = mapOf("date" to "04 Jan", "party" to "RK Traders", "dr" to "0", "cr" to "88,000", "bal" to "8,20,410"),
      ),
    )

  LazyColumn(
    modifier = modifier.fillMaxSize().padding(AppSpacing.ScreenPadding),
    verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
  ) {
    item {
      SectionHeader(title = "Underwriting")
    }
    item {
      StatCard(value = "Accept with control", label = "Decision summary", trend = "Top reason: healthy cash inflow trend")
    }
    item {
      PrimaryActionCard(
        title = "Recommended Structure",
        subtitle = "Amount ₹25L | Tenure 12m | Weekly collection | 3m upfront interest",
        ctaLabel = "Open Credit Memo",
        onClick = {},
      )
    }
    item {
      EvidenceTable(
        columns = columns,
        rows = rows,
        monthOptions = listOf("2026-01"),
        selectedMonth = month,
        onMonthSelected = { month = it },
        categoryOptions = listOf("Suppliers", "Collections"),
        selectedCategory = category,
        onCategorySelected = { category = it },
        flagOptions = listOf("High", "Low"),
        selectedFlag = flag,
        onFlagSelected = { flag = it },
      )
    }
  }
}

@Composable
fun PremiumPdExampleScreen(
  modifier: Modifier = Modifier,
) {
  Column(
    modifier = modifier.fillMaxSize().padding(AppSpacing.ScreenPadding),
    verticalArrangement = Arrangement.spacedBy(AppSpacing.Space12),
  ) {
    SectionHeader(title = "PD", actionLabel = "Checklist", onActionClick = {})
    AccordionSection(title = "Borrower profile", isComplete = true, autosaveLabel = "Autosave: just now", initiallyExpanded = true) {
      Text("Business vintage 6 years, stable ownership", style = AppTypographyTokens.Body14)
    }
    AccordionSection(title = "Cash flow validation", isComplete = false, autosaveLabel = "Autosave: 30 sec ago") {
      Text("Mismatch in Jan receivables requires supporting proof", style = AppTypographyTokens.Body14)
    }
    AccordionSection(title = "Dynamic doubts", isComplete = false, autosaveLabel = "Generated from UW/GST/ITR") {
      Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.Space8), modifier = Modifier.fillMaxWidth()) {
        androidx.compose.material3.Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error)
        Text("Frequent cash deposits near month-end", style = AppTypographyTokens.Body14)
      }
    }
    PrimaryActionCard(
      title = "Ready for approval",
      subtitle = "All mandatory sections complete. 2 advisory doubts attached.",
      ctaLabel = "Submit for Approval",
      onClick = {},
    )
  }
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun HomePreview() {
  JubilantNativeTheme {
    PremiumHomeExampleScreen()
  }
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun LeadsPreview() {
  JubilantNativeTheme {
    PremiumLeadsExampleScreen()
  }
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun UnderwritingPreview() {
  JubilantNativeTheme {
    PremiumUnderwritingEvidenceExample()
  }
}

@Preview(showBackground = true, backgroundColor = 0xFF111318)
@Composable
private fun PdPreview() {
  JubilantNativeTheme {
    PremiumPdExampleScreen()
  }
}
