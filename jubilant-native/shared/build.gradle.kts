import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.plugin.mpp.apple.XCFramework

plugins {
  kotlin("multiplatform")
  id("com.android.library")
  kotlin("plugin.serialization")
}

private val KTOR_VERSION = "2.3.7"
private val COROUTINES_VERSION = "1.7.3"
private val SERIALIZATION_VERSION = "1.6.3"
private val DATETIME_VERSION = "0.5.0"

kotlin {
  androidTarget {
    compilations.all {
      compilerOptions.configure {
        jvmTarget.set(JvmTarget.JVM_17)
      }
    }
  }

  // iOS targets (for the native SwiftUI app)
  val iosX64 = iosX64()
  val iosArm64 = iosArm64()
  val iosSimulatorArm64 = iosSimulatorArm64()

  val xcframework = XCFramework("JubilantShared")
  listOf(iosX64, iosArm64, iosSimulatorArm64).forEach { target ->
    target.binaries.framework {
      baseName = "JubilantShared"
      isStatic = true
      xcframework.add(this)
    }
  }

  sourceSets {
    val commonMain by getting {
      dependencies {
        implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$COROUTINES_VERSION")
        implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$SERIALIZATION_VERSION")
        implementation("org.jetbrains.kotlinx:kotlinx-datetime:$DATETIME_VERSION")

        implementation("io.ktor:ktor-client-core:$KTOR_VERSION")
        implementation("io.ktor:ktor-client-content-negotiation:$KTOR_VERSION")
        implementation("io.ktor:ktor-serialization-kotlinx-json:$KTOR_VERSION")
      }
    }

    val commonTest by getting {
      dependencies {
        implementation(kotlin("test"))
      }
    }

    val androidMain by getting {
      dependencies {
        implementation("io.ktor:ktor-client-okhttp:$KTOR_VERSION")
      }
    }

    val iosX64Main by getting
    val iosArm64Main by getting
    val iosSimulatorArm64Main by getting

    val iosMain by creating {
      dependsOn(commonMain)
      iosX64Main.dependsOn(this)
      iosArm64Main.dependsOn(this)
      iosSimulatorArm64Main.dependsOn(this)
      dependencies {
        implementation("io.ktor:ktor-client-darwin:$KTOR_VERSION")
      }
    }
  }
}

android {
  namespace = "com.jubilant.lirasnative.shared"
  compileSdk = 34

  defaultConfig {
    minSdk = 24
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}
