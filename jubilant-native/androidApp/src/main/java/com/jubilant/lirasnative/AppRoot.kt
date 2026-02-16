package com.jubilant.lirasnative

import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jubilant.lirasnative.di.AppContainer
import com.jubilant.lirasnative.ui.screens.ErrorScreen
import com.jubilant.lirasnative.ui.screens.HomeScreen
import com.jubilant.lirasnative.ui.screens.LoginScreen
import com.jubilant.lirasnative.ui.screens.SplashScreen

@Composable
fun AppRoot(
  container: AppContainer,
  navTargetRoute: String?,
  onNavTargetHandled: () -> Unit,
) {
  val vm: RootViewModel = viewModel(factory = RootViewModel.factory(container))
  val state by vm.state.collectAsState()

  Surface {
    when (state.phase) {
      RootPhase.Loading -> SplashScreen(label = "Starting…")
      RootPhase.SignedOut ->
        LoginScreen(
          busy = state.busy,
          error = state.error,
          onSubmit = vm::signIn,
        )

      RootPhase.SignedIn ->
        HomeScreen(
          leadsRepository = container.leadsRepository,
          mediatorsRepository = container.mediatorsRepository,
          profilesRepository = container.profilesRepository,
          underwritingRepository = container.underwritingRepository,
          pdRepository = container.pdRepository,
          statementRepository = container.statementRepository,
          onSignOut = vm::signOut,
          navTargetRoute = navTargetRoute,
          onNavTargetHandled = onNavTargetHandled,
        )

      RootPhase.FatalError -> ErrorScreen(message = state.error ?: "Something went wrong")
    }
  }
}
