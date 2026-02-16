package com.jubilant.lirasnative.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.jubilant.lirasnative.di.ProfilesRepository
import com.jubilant.lirasnative.shared.supabase.Profile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SessionState(
  val loading: Boolean = false,
  val userId: String? = null,
  val myProfile: Profile? = null,
  val profiles: List<Profile> = emptyList(),
  val error: String? = null,
) {
  val role: String
    get() = (myProfile?.role ?: "").trim().lowercase()

  val isAdmin: Boolean
    get() = role == "admin"

  val isOwner: Boolean
    get() = role == "owner"

  val isStaff: Boolean
    get() = role == "staff"
}

class SessionViewModel(
  private val profiles: ProfilesRepository,
) : ViewModel() {
  private val _state = MutableStateFlow(SessionState())
  val state: StateFlow<SessionState> = _state

  fun refresh() {
    viewModelScope.launch {
      _state.update { it.copy(loading = true, error = null) }
      try {
        val userId = profiles.requireUserId()
        val myProfile = profiles.getMyProfile()

        val allProfiles =
          if ((myProfile?.role ?: "").equals("admin", ignoreCase = true)) {
            profiles.listProfiles(limit = 500)
          } else {
            myProfile?.let { listOf(it) } ?: emptyList()
          }

        _state.update {
          it.copy(
            loading = false,
            userId = userId,
            myProfile = myProfile,
            profiles = allProfiles,
          )
        }
      } catch (e: Exception) {
        _state.update { it.copy(loading = false, error = e.message ?: "Couldn’t load session profile.") }
      }
    }
  }

  companion object {
    fun factory(repo: ProfilesRepository): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return SessionViewModel(repo) as T
        }
      }
  }
}
