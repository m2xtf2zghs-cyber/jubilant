package com.jubilant.lirasnative.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jubilant.lirasnative.R

@Composable
fun BrandMark(size: Dp = 44.dp) {
  Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
    Image(
      painter = painterResource(R.drawable.ic_brand_mark),
      contentDescription = null,
      modifier = Modifier.size(size),
      contentScale = ContentScale.Fit,
    )
  }
}

@Composable
fun BrandHeader(
  title: String,
  subtitle: String,
  modifier: Modifier = Modifier,
) {
  Row(
    modifier = modifier,
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.Start,
  ) {
    BrandMark()
    Spacer(Modifier.width(12.dp))
    Column {
      Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
      Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  }
}
