package com.jubilant.lirasnative.ui.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

enum class NetworkStatus {
  Online,
  Offline,
  PoorNetwork,
}

private fun currentNetworkStatus(context: Context): NetworkStatus {
  val cm = context.getSystemService(ConnectivityManager::class.java) ?: return NetworkStatus.Offline
  val network = cm.activeNetwork ?: return NetworkStatus.Offline
  val caps = cm.getNetworkCapabilities(network) ?: return NetworkStatus.Offline
  if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return NetworkStatus.Offline
  return if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) NetworkStatus.Online else NetworkStatus.PoorNetwork
}

@Composable
fun rememberNetworkStatus(): NetworkStatus {
  val context = LocalContext.current
  val status: MutableState<NetworkStatus> = remember { mutableStateOf(currentNetworkStatus(context)) }

  DisposableEffect(Unit) {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    if (cm == null) {
      status.value = NetworkStatus.Offline
      onDispose { }
    } else {
      val callback =
        object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            status.value = currentNetworkStatus(context)
          }

          override fun onLost(network: Network) {
            status.value = currentNetworkStatus(context)
          }

          override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            status.value = currentNetworkStatus(context)
          }
        }

      val request =
        NetworkRequest.Builder()
          .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          .build()

      runCatching { cm.registerNetworkCallback(request, callback) }
      status.value = currentNetworkStatus(context)

      onDispose {
        runCatching { cm.unregisterNetworkCallback(callback) }
      }
    }
  }

  return status.value
}

