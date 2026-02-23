package com.jubilant.liras.ui.mediators

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jubilant.liras.models.Mediator
import com.jubilant.liras.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediatorScreen(
    viewModel: MediatorViewModel = viewModel(),
    onMediatorClick: (Mediator) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = DeepBlack,
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "PARTNER NETWORK",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 2.sp,
                        color = CredWhite
                    )
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = DeepBlack
                ),
                actions = {
                    IconButton(onClick = { /* TODO: Search Partners */ }) {
                        Icon(Icons.Default.Search, contentDescription = "Search", tint = CredSilver)
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* TODO: Add Mediator */ },
                containerColor = IndigoAccent,
                contentColor = CredWhite,
                shape = CircleShape
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Partner")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            when (val state = uiState) {
                is MediatorUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = IndigoAccent)
                    }
                }
                is MediatorUiState.Success -> {
                    MediatorList(state.mediators, onMediatorClick)
                }
                is MediatorUiState.Error -> {
                    Text("Error: ${state.message}", color = RubyAccent, modifier = Modifier.padding(16.dp))
                }
            }
        }
    }
}

@Composable
fun MediatorList(mediators: List<Mediator>, onMediatorClick: (Mediator) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 80.dp, top = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(mediators) { mediator ->
            MediatorCard(mediator, onClick = { onMediatorClick(mediator) })
        }
    }
}

@Composable
fun MediatorCard(mediator: Mediator, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(SurfaceGray)
            .border(1.dp, DividerGray, RoundedCornerShape(20.dp))
            .clickable { onClick() }
            .padding(20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Initial Avatar
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(DividerGray),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    mediator.name.take(1).uppercase(),
                    style = MaterialTheme.typography.titleLarge,
                    color = CredWhite
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    mediator.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = CredWhite
                )
                Text(
                    mediator.phone ?: "No contact",
                    style = MaterialTheme.typography.bodyMedium,
                    color = CredSilver
                )
            }

            // Quick Actions
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniCircleAction(Icons.Default.Phone, IndigoAccent)
                MiniCircleAction(Icons.Default.Message, EmeraldAccent)
            }
        }
    }
}

@Composable
fun MiniCircleAction(icon: ImageVector, color: Color) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(DividerGray)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
    }
}
