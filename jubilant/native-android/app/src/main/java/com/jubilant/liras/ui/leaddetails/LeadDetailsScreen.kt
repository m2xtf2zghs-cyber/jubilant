package com.jubilant.liras.ui.leaddetails

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jubilant.liras.models.Lead
import com.jubilant.liras.ui.dashboard.formatCurrency
import com.jubilant.liras.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeadDetailsScreen(
    leadId: String,
    viewModel: LeadDetailsViewModel = viewModel(),
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(leadId) {
        viewModel.loadLead(leadId)
    }

    Scaffold(
        containerColor = DeepBlack,
        topBar = {
            TopAppBar(
                title = { Text("LEAD DETAILS", style = MaterialTheme.typography.labelSmall, letterSpacing = 2.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = CredWhite)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepBlack)
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is LeadDetailsUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IndigoAccent)
                }
            }
            is LeadDetailsUiState.Success -> {
                LeadDetailsContent(state.lead, padding, onUpdateStatus = { viewModel.updateStatus(state.lead, it) })
            }
            is LeadDetailsUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(state.message, color = RubyAccent)
                }
            }
        }
    }
}

@Composable
fun LeadDetailsContent(
    lead: Lead,
    padding: PaddingValues,
    onUpdateStatus: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .padding(padding)
            .fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        item {
            LeadHeaderCard(lead)
        }

        item {
            ActionButtonsRow(lead)
        }

        item {
            StatusSection(lead.status, onUpdateStatus)
        }

        item {
            InfoSection(lead)
        }

        item {
            Text(
                "ACTIVITY LOG",
                style = MaterialTheme.typography.labelSmall,
                color = CredSilver,
                letterSpacing = 1.sp
            )
        }

        items(lead.notes.reversed()) { note ->
            NoteItem(note.text, note.date)
        }
    }
}

@Composable
fun LeadHeaderCard(lead: Lead) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.verticalGradient(listOf(SurfaceGray, CardGray)))
            .border(1.dp, DividerGray, RoundedCornerShape(24.dp))
            .padding(24.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(DividerGray),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    lead.name.take(1).uppercase(),
                    style = MaterialTheme.typography.headlineMedium,
                    color = CredWhite
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(lead.name, style = MaterialTheme.typography.headlineMedium, color = CredWhite)
            Text(lead.company ?: "No Company", style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                formatCurrency(lead.loanAmount),
                style = MaterialTheme.typography.displayLarge,
                color = CredWhite,
                fontSize = 36.sp
            )
        }
    }
}

@Composable
fun ActionButtonsRow(lead: Lead) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        ActionButton(
            icon = Icons.Default.Phone,
            label = "Call",
            modifier = Modifier.weight(1f),
            color = IndigoAccent
        )
        ActionButton(
            icon = Icons.Default.Message,
            label = "WhatsApp",
            modifier = Modifier.weight(1f),
            color = EmeraldAccent
        )
        ActionButton(
            icon = Icons.Default.Share,
            label = "Share",
            modifier = Modifier.weight(1f),
            color = CredSilver
        )
    }
}

@Composable
fun ActionButton(icon: ImageVector, label: String, modifier: Modifier, color: Color) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceGray)
            .border(1.dp, DividerGray, RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.height(8.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = CredWhite)
    }
}

@Composable
fun StatusSection(currentStatus: String, onUpdate: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("CURRENT STATUS", style = MaterialTheme.typography.labelSmall, color = CredSilver)
        
        val statuses = listOf("New", "Meeting Scheduled", "Follow-Up Required", "Payment Done", "Not Eligible")
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            // Simplified status selector for mobile UI
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceGray)
                    .border(1.dp, DividerGray, RoundedCornerShape(16.dp))
                    .padding(16.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(GoldAccent))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(currentStatus, color = CredWhite, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.weight(1f))
                    Icon(Icons.Default.Edit, contentDescription = null, tint = CredSilver, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
fun InfoSection(lead: Lead) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(SurfaceGray)
            .border(1.dp, DividerGray, RoundedCornerShape(20.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        InfoRow(Icons.Default.LocationOn, "Location", lead.location ?: "Not Set")
        InfoRow(Icons.Default.Phone, "Contact", lead.phone ?: "Not Provided")
        InfoRow(Icons.Default.CalendarToday, "Created On", lead.createdAt ?: "N/A")
        InfoRow(Icons.Default.Notifications, "Next Action", lead.nextFollowUp ?: "No scheduled action")
    }
}

@Composable
fun InfoRow(icon: ImageVector, label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = CredSilver, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(label, style = MaterialTheme.typography.labelSmall, color = CredSilver)
            Text(value, style = MaterialTheme.typography.bodyLarge, color = CredWhite)
        }
    }
}

@Composable
fun NoteItem(text: String, date: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(IndigoAccent))
            Spacer(modifier = Modifier.width(12.dp))
            Text(date, style = MaterialTheme.typography.labelSmall, color = CredSilver)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .padding(start = 18.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SurfaceGray)
                .padding(12.dp)
        ) {
            Text(text, style = MaterialTheme.typography.bodyMedium, color = CredWhite)
        }
    }
}
