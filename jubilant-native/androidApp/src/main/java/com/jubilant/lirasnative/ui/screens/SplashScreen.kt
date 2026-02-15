package com.jubilant.lirasnative.ui.screens

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.painterResource
import com.jubilant.lirasnative.R
import com.jubilant.lirasnative.ui.components.BankingBackground

@Composable
fun SplashScreen(label: String) {
  var ready by remember { mutableStateOf(false) }
  LaunchedEffect(Unit) { ready = true }

  val a by
    animateFloatAsState(
      targetValue = if (ready) 1f else 0f,
      animationSpec = tween(durationMillis = 600, easing = FastOutSlowInEasing),
      label = "splash_alpha",
    )

  BankingBackground {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
      Column(
        modifier =
          Modifier
            .padding(horizontal = 24.dp)
            .alpha(a)
            .graphicsLayer(
              scaleX = 0.92f + (0.08f * a),
              scaleY = 0.92f + (0.08f * a),
            ),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Image(
          painter = painterResource(R.drawable.ic_brand_logo),
          contentDescription = stringResource(R.string.app_name),
          modifier = Modifier.size(200.dp),
        )
        Spacer(Modifier.height(10.dp))
        Text(
          text = label,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(18.dp))
        CircularProgressIndicator()
      }
    }
  }
}
