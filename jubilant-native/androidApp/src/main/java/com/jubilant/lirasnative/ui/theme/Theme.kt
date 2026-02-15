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
    primary = Gold500,
    onPrimary = Navy950,
    primaryContainer = Gold400,
    onPrimaryContainer = Navy950,
    secondary = Gold500,
    onSecondary = Navy950,
    secondaryContainer = Navy850,
    onSecondaryContainer = Color.White,
    tertiary = Gold400,
    onTertiary = Navy950,
    background = Navy950,
    onBackground = Color.White,
    surface = Navy900,
    onSurface = Color.White,
    surfaceVariant = Navy850,
    onSurfaceVariant = Slate200,
    outline = Color(0xFF2B3A5F),
    outlineVariant = Color(0xFF1B2744),
    error = Danger500,
    onError = Color.White,
  )

private val LightColors =
  lightColorScheme(
    primary = Navy950,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE8ECF8),
    onPrimaryContainer = Navy950,
    secondary = Gold500,
    onSecondary = Navy950,
    secondaryContainer = Color(0xFFFFF3D6),
    onSecondaryContainer = Navy950,
    tertiary = Gold400,
    onTertiary = Navy950,
    background = Color(0xFFF7FAFF),
    onBackground = Navy950,
    surface = Color.White,
    onSurface = Navy950,
    surfaceVariant = Color(0xFFF1F5FF),
    onSurfaceVariant = Color(0xFF475569),
    outline = Color(0xFFCBD5E1),
    outlineVariant = Color(0xFFE2E8F0),
    error = Danger500,
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
