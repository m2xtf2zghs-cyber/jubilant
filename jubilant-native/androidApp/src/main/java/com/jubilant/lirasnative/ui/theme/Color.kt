package com.jubilant.lirasnative.ui.theme

import androidx.compose.ui.graphics.Color
import com.jubilant.lirasnative.ui.designsystem.tokens.AppColorTokens

// Design-system colors (single source of truth)
val BgPrimaryDark: Color = AppColorTokens.BgPrimaryDark
val BgSecondaryDark: Color = AppColorTokens.BgSecondaryDark
val BgSurfaceDark: Color = AppColorTokens.BgSurfaceDark

val BgPrimaryLight: Color = AppColorTokens.BgPrimaryLight
val BgSecondaryLight: Color = AppColorTokens.BgSecondaryLight
val BgSurfaceLight: Color = AppColorTokens.BgSurfaceLight

val TextPrimaryDark: Color = AppColorTokens.TextPrimaryDark
val TextSecondaryDark: Color = AppColorTokens.TextSecondaryDark
val TextPrimaryLight: Color = AppColorTokens.TextPrimaryLight
val TextSecondaryLight: Color = AppColorTokens.TextSecondaryLight

val BrandPrimary: Color = AppColorTokens.BrandPrimary
val BrandPrimaryHover: Color = AppColorTokens.BrandPrimaryHover
val BrandPrimarySubtle: Color = AppColorTokens.BrandPrimarySubtle

val SemanticSuccess: Color = AppColorTokens.SemanticSuccess
val SemanticWarning: Color = AppColorTokens.SemanticWarning
val SemanticCritical: Color = AppColorTokens.SemanticCritical
val SemanticInfo: Color = AppColorTokens.SemanticInfo

val BorderSubtleDark: Color = AppColorTokens.BorderSubtleDark
val BorderSubtleLight: Color = AppColorTokens.BorderSubtleLight

// Legacy aliases kept for compatibility with existing screens.
val Navy950: Color = BgPrimaryDark
val Navy925: Color = BgSecondaryDark
val Navy900: Color = BgSurfaceDark
val Navy850: Color = Color(0xFF262D39)

val Gold500: Color = BrandPrimary
val Gold400: Color = BrandPrimaryHover

val Blue500: Color = SemanticInfo
val Blue400: Color = Color(0xFF9BAEC4)
val Blue600: Color = Color(0xFF5E7288)

val Slate200: Color = TextPrimaryDark
val Slate400: Color = TextSecondaryDark

val Success500: Color = SemanticSuccess
val Warning500: Color = SemanticWarning
val Danger500: Color = SemanticCritical
