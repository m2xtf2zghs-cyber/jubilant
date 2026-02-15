package com.jubilant.lirasnative.shared.util

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json

@OptIn(ExperimentalSerializationApi::class)
val DefaultJson: Json =
  Json {
    ignoreUnknownKeys = true
    isLenient = true
    explicitNulls = false
  }
