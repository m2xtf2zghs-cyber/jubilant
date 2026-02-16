package com.jubilant.lirasnative.ui.designsystem.tokens

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val BaseFont = FontFamily.SansSerif

object AppTypographyTokens {
  val Display28: TextStyle =
    TextStyle(
      fontFamily = BaseFont,
      fontWeight = FontWeight.SemiBold,
      fontSize = 28.sp,
      lineHeight = 34.sp,
      letterSpacing = 0.sp,
      fontFeatureSettings = "tnum",
    )

  val Title20: TextStyle =
    TextStyle(
      fontFamily = BaseFont,
      fontWeight = FontWeight.SemiBold,
      fontSize = 20.sp,
      lineHeight = 26.sp,
      letterSpacing = 0.sp,
    )

  val Value16: TextStyle =
    TextStyle(
      fontFamily = BaseFont,
      fontWeight = FontWeight.SemiBold,
      fontSize = 16.sp,
      lineHeight = 22.sp,
      letterSpacing = 0.sp,
      fontFeatureSettings = "tnum",
    )

  val Body14: TextStyle =
    TextStyle(
      fontFamily = BaseFont,
      fontWeight = FontWeight.Normal,
      fontSize = 14.sp,
      lineHeight = 20.sp,
      letterSpacing = 0.sp,
    )

  val Helper12: TextStyle =
    TextStyle(
      fontFamily = BaseFont,
      fontWeight = FontWeight.Normal,
      fontSize = 12.sp,
      lineHeight = 16.sp,
      letterSpacing = 0.sp,
    )

  val Chip12: TextStyle =
    TextStyle(
      fontFamily = BaseFont,
      fontWeight = FontWeight.Medium,
      fontSize = 12.sp,
      lineHeight = 16.sp,
      letterSpacing = 0.sp,
    )
}
