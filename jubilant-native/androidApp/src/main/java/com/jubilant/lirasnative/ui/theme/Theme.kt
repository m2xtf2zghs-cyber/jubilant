package com.jubilant.lirasnative.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColors =
  darkColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    primaryContainer = BrandPrimarySubtle,
    onPrimaryContainer = TextPrimaryDark,
    secondary = BrandPrimaryHover,
    onSecondary = Color.White,
    secondaryContainer = BrandPrimarySubtle,
    onSecondaryContainer = TextPrimaryDark,
    tertiary = SemanticInfo,
    onTertiary = TextPrimaryDark,
    background = BgPrimaryDark,
    onBackground = TextPrimaryDark,
    surface = BgSurfaceDark,
    onSurface = TextPrimaryDark,
    surfaceVariant = BgSecondaryDark,
    onSurfaceVariant = TextSecondaryDark,
    outline = BorderSubtleDark,
    outlineVariant = BorderSubtleDark.copy(alpha = 0.72f),
    error = SemanticCritical,
    onError = Color.White,
  )

private val LightColors =
  lightColorScheme(
    primary = BrandPrimary,
    onPrimary = Color.White,
    primaryContainer = BrandPrimarySubtle,
    onPrimaryContainer = TextPrimaryLight,
    secondary = BrandPrimaryHover,
    onSecondary = Color.White,
    secondaryContainer = BrandPrimarySubtle,
    onSecondaryContainer = TextPrimaryLight,
    tertiary = SemanticInfo,
    onTertiary = TextPrimaryLight,
    background = BgPrimaryLight,
    onBackground = TextPrimaryLight,
    surface = BgSurfaceLight,
    onSurface = TextPrimaryLight,
    surfaceVariant = BgSecondaryLight,
    onSurfaceVariant = TextSecondaryLight,
    outline = BorderSubtleLight,
    outlineVariant = BorderSubtleLight.copy(alpha = 0.72f),
    error = SemanticCritical,
    onError = Color.White,
  )

@Composable
fun JubilantNativeTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit,
) {
  val view = LocalView.current
  SideEffect {
    val window = (view.context as? android.app.Activity)?.window ?: return@SideEffect
    val controller = WindowCompat.getInsetsController(window, view)
    controller.isAppearanceLightStatusBars = !darkTheme
    controller.isAppearanceLightNavigationBars = !darkTheme
  }

  MaterialTheme(
    colorScheme = if (darkTheme) DarkColors else LightColors,
    typography = JubilantTypography,
    shapes = JubilantShapes,
    content = content,
  )
}
