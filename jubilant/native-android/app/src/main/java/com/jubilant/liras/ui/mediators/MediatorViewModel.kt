package com.jubilant.liras.ui.mediators

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jubilant.liras.models.Mediator
import com.jubilant.liras.repository.MediatorRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MediatorViewModel(private val repository: MediatorRepository = MediatorRepository()) : ViewModel() {

    private val _uiState = MutableStateFlow<MediatorUiState>(MediatorUiState.Loading)
    val uiState: StateFlow<MediatorUiState> = _uiState.asStateFlow()

    init {
        loadMediators()
    }

    fun loadMediators() {
        viewModelScope.launch {
            _uiState.value = MediatorUiState.Loading
            val mediators = repository.getMediators()
            _uiState.value = MediatorUiState.Success(mediators)
        }
    }
}

sealed class MediatorUiState {
    object Loading : MediatorUiState()
    data class Success(val mediators: List<Mediator>) : MediatorUiState()
    data class Error(val message: String) : MediatorUiState()
}
