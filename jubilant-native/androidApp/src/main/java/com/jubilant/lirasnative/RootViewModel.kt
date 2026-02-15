package com.jubilant.lirasnative

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.jubilant.lirasnative.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class RootPhase {
  Loading,
  SignedOut,
  SignedIn,
  FatalError,
}

data class RootState(
  val phase: RootPhase = RootPhase.Loading,
  val busy: Boolean = false,
  val error: String? = null,
)

class RootViewModel(
  private val container: AppContainer,
) : ViewModel() {
  private val _state = MutableStateFlow(RootState())
  val state: StateFlow<RootState> = _state

  init {
    viewModelScope.launch {
      if (!container.supabaseClient.isConfigured()) {
        _state.update {
          it.copy(
            phase = RootPhase.FatalError,
            error =
              "Supabase is not configured.\n\nSet SUPABASE_URL and SUPABASE_ANON_KEY, then rebuild.\n\nOptions:\n- ~/.gradle/gradle.properties (recommended)\n- jubilant-native/supabase.properties (project-local)",
          )
        }
        return@launch
      }

      try {
        val session = container.supabaseClient.restoreSession()
        _state.update { it.copy(phase = if (session == null) RootPhase.SignedOut else RootPhase.SignedIn) }
      } catch (e: Exception) {
        _state.update {
          it.copy(
            phase = RootPhase.FatalError,
            error = e.message ?: "Could not initialize secure session storage.",
          )
        }
      }
    }
  }

  fun signIn(email: String, password: String) {
    viewModelScope.launch {
      _state.update { it.copy(busy = true, error = null) }
      try {
        container.authRepository.signIn(email, password)
        _state.update { it.copy(phase = RootPhase.SignedIn, busy = false) }
      } catch (e: Exception) {
        _state.update {
          it.copy(
            busy = false,
            error = e.message ?: "Invalid login credentials.",
          )
        }
      }
    }
  }

  fun signOut() {
    viewModelScope.launch {
      runCatching { container.authRepository.signOut() }
      _state.update { it.copy(phase = RootPhase.SignedOut, busy = false, error = null) }
    }
  }

  companion object {
    fun factory(container: AppContainer): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return RootViewModel(container) as T
        }
      }
  }
}
