package com.jubilant.lirasnative.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import com.jubilant.lirasnative.ui.designsystem.tokens.AppRadius

val JubilantShapes =
  Shapes(
    extraSmall = RoundedCornerShape(AppRadius.Radius8),
    small = RoundedCornerShape(AppRadius.Radius12),
    medium = RoundedCornerShape(AppRadius.Radius16),
    large = RoundedCornerShape(AppRadius.Radius16),
    extraLarge = RoundedCornerShape(AppRadius.Radius16),
  )
