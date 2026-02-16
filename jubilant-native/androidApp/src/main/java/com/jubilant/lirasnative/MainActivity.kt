package com.jubilant.lirasnative

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.fragment.app.FragmentActivity
import com.jubilant.lirasnative.di.AppContainer
import com.jubilant.lirasnative.ui.util.KEY_BIOMETRIC_LOCK
import com.jubilant.lirasnative.ui.util.KEY_BLOCK_SCREENSHOTS
import com.jubilant.lirasnative.ui.util.KEY_LAST_BIOMETRIC_AUTH_AT_MS
import com.jubilant.lirasnative.ui.util.PREFS_NAME
import com.jubilant.lirasnative.ui.util.rememberKolkataDateTimeTicker
import com.jubilant.lirasnative.ui.theme.JubilantNativeTheme
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import java.time.LocalTime

class MainActivity : FragmentActivity() {
  private var navTargetRoute by mutableStateOf<String?>(null)
  private var biometricInFlight: Boolean = false

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(savedInstanceState)
    runCatching {
      // Initialize PDFBox resources once for the whole app (used by Underwriting PDF parsing).
      PDFBoxResourceLoader.init(applicationContext)
    }
    navTargetRoute = intent?.getStringExtra(EXTRA_NAV_ROUTE)
    applyPrivacyFlags()
    setContent {
      val container = remember { AppContainer(applicationContext) }
      val now by rememberKolkataDateTimeTicker()
      val t = now.toLocalTime()
      val darkTheme =
        remember(t) {
          val startDark = LocalTime.of(18, 0)
          val endDark = LocalTime.of(6, 0)
          !t.isBefore(startDark) || t.isBefore(endDark)
        }

      JubilantNativeTheme(darkTheme = darkTheme) {
        AppRoot(
          container = container,
          navTargetRoute = navTargetRoute,
          onNavTargetHandled = { navTargetRoute = null },
        )
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    navTargetRoute = intent.getStringExtra(EXTRA_NAV_ROUTE)
  }

  override fun onResume() {
    super.onResume()
    applyPrivacyFlags()
    maybePromptBiometric()
  }

  private fun prefs(): SharedPreferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

  private fun applyPrivacyFlags() {
    val enabled = prefs().getBoolean(KEY_BLOCK_SCREENSHOTS, false)
    if (enabled) {
      window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    } else {
      window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }

  private fun maybePromptBiometric() {
    val p = prefs()
    if (!p.getBoolean(KEY_BIOMETRIC_LOCK, false)) return
    if (biometricInFlight) return

    val last = p.getLong(KEY_LAST_BIOMETRIC_AUTH_AT_MS, 0L)
    val now = System.currentTimeMillis()
    if (last > 0L && now - last < AUTH_GRACE_PERIOD_MS) return

    val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
    val can = BiometricManager.from(this).canAuthenticate(authenticators)
    if (can != BiometricManager.BIOMETRIC_SUCCESS) {
      // If biometric/device credential isn't available, avoid trapping the user in a loop.
      p.edit().putBoolean(KEY_BIOMETRIC_LOCK, false).apply()
      return
    }

    biometricInFlight = true
    val executor = ContextCompat.getMainExecutor(this)
    val prompt =
      BiometricPrompt(
        this,
        executor,
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            p.edit().putLong(KEY_LAST_BIOMETRIC_AUTH_AT_MS, System.currentTimeMillis()).apply()
            biometricInFlight = false
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            biometricInFlight = false
            // User canceled or system canceled → close app (lock behavior).
            finish()
          }
        },
      )

    val promptInfo =
      BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock")
        .setSubtitle(getString(R.string.app_name))
        .setAllowedAuthenticators(authenticators)
        .build()

    prompt.authenticate(promptInfo)
  }

  companion object {
    const val EXTRA_NAV_ROUTE: String = "nav_route"

    private const val AUTH_GRACE_PERIOD_MS: Long = 60_000L
  }
}
