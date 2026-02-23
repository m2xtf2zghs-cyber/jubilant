package com.jubilant.liras.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jubilant.liras.models.Lead
import com.jubilant.liras.repository.LeadRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class DashboardViewModel(private val repository: LeadRepository = LeadRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadLeads()
    }

    fun loadLeads() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            val leads = repository.getLeads()
            _uiState.value = DashboardUiState.Success(
                leads = leads,
                stats = calculateStats(leads)
            )
        }
    }

    private fun calculateStats(leads: List<Lead>): DashboardStats {
        return DashboardStats(
            totalLeads = leads.size,
            activePipeline = leads.filter { it.status !in listOf("Payment Done", "Deal Closed", "Not Eligible", "Not Reliable") }.size,
            closedDeals = leads.filter { it.status in listOf("Payment Done", "Deal Closed") }.size,
            totalVolume = leads.sumOf { it.loanAmount }
        )
    }
}

sealed class DashboardUiState {
    object Loading : DashboardUiState()
    data class Success(val leads: List<Lead>, val stats: DashboardStats) : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}

data class DashboardStats(
    val totalLeads: Int,
    val activePipeline: Int,
    val closedDeals: Int,
    val totalVolume: Double
)
