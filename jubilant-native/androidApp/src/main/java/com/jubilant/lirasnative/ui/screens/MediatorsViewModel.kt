package com.jubilant.lirasnative.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.jubilant.lirasnative.di.MediatorsRepository
import com.jubilant.lirasnative.shared.supabase.Mediator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MediatorsState(
  val loading: Boolean = false,
  val mediators: List<Mediator> = emptyList(),
  val error: String? = null,
)

class MediatorsViewModel(
  private val mediators: MediatorsRepository,
) : ViewModel() {
  private val _state = MutableStateFlow(MediatorsState())
  val state: StateFlow<MediatorsState> = _state

  fun refresh() {
    viewModelScope.launch {
      _state.update { it.copy(loading = true, error = null) }
      try {
        val items = mediators.listMediators()
        _state.update { it.copy(loading = false, mediators = items) }
      } catch (e: Exception) {
        _state.update { it.copy(loading = false, error = e.message ?: "Couldn’t load mediators.") }
      }
    }
  }

  companion object {
    fun factory(repo: MediatorsRepository): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return MediatorsViewModel(repo) as T
        }
      }
  }
}

