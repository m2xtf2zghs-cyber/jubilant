package com.jubilant.liras.ui.leaddetails

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jubilant.liras.models.Lead
import com.jubilant.liras.repository.LeadRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class LeadDetailsViewModel(
    private val repository: LeadRepository = LeadRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow<LeadDetailsUiState>(LeadDetailsUiState.Loading)
    val uiState: StateFlow<LeadDetailsUiState> = _uiState.asStateFlow()

    fun loadLead(leadId: String) {
        viewModelScope.launch {
            _uiState.value = LeadDetailsUiState.Loading
            val leads = repository.getLeads()
            val lead = leads.find { it.id == leadId }
            if (lead != null) {
                _uiState.value = LeadDetailsUiState.Success(lead)
            } else {
                _uiState.value = LeadDetailsUiState.Error("Lead not found")
            }
        }
    }

    fun updateStatus(lead: Lead, newStatus: String) {
        viewModelScope.launch {
            val updatedLead = lead.copy(status = newStatus)
            repository.updateLead(updatedLead)
            _uiState.value = LeadDetailsUiState.Success(updatedLead)
        }
    }
}

sealed class LeadDetailsUiState {
    object Loading : LeadDetailsUiState()
    data class Success(val lead: Lead) : LeadDetailsUiState()
    data class Error(val message: String) : LeadDetailsUiState()
}
