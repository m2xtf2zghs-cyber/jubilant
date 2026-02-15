package com.jubilant.lirasnative.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.jubilant.lirasnative.di.LeadsRepository
import com.jubilant.lirasnative.shared.supabase.LeadSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LeadsState(
  val loading: Boolean = false,
  val leads: List<LeadSummary> = emptyList(),
  val error: String? = null,
)

class LeadsViewModel(
  private val leads: LeadsRepository,
) : ViewModel() {
  private val _state = MutableStateFlow(LeadsState())
  val state: StateFlow<LeadsState> = _state

  fun refresh() {
    viewModelScope.launch {
      _state.update { it.copy(loading = true, error = null) }
      try {
        val items = leads.listLeads()
        _state.update { it.copy(loading = false, leads = items) }
      } catch (e: Exception) {
        _state.update { it.copy(loading = false, error = e.message ?: "Couldn’t load leads.") }
      }
    }
  }

  companion object {
    fun factory(leads: LeadsRepository): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return LeadsViewModel(leads) as T
        }
      }
  }
}
