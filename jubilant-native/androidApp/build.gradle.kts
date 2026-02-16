import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File
import java.util.Properties

plugins {
  id("com.android.application")
  kotlin("android")
  kotlin("plugin.serialization")
}

android {
  namespace = "com.jubilant.lirasnative"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.jubilant.lirasnative"
    minSdk = 24
    targetSdk = 34
    versionCode = 7
    versionName = "0.1.6"
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.8"
  }

  compileOptions {
    isCoreLibraryDesugaringEnabled = true
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlin {
    compilerOptions {
      jvmTarget.set(JvmTarget.JVM_17)
    }
  }

  fun loadSupabaseLocalProperties(): Properties {
    val props = Properties()
    val file = rootProject.file("supabase.properties")
    if (file.exists()) {
      file.inputStream().use { props.load(it) }
    }
    return props
  }

  val localProps = loadSupabaseLocalProperties()
  val supabaseUrl: String =
    sequenceOf(
        (project.findProperty("SUPABASE_URL") as String?)?.trim(),
        System.getenv("SUPABASE_URL")?.trim(),
        localProps.getProperty("SUPABASE_URL")?.trim(),
      )
      .firstOrNull { !it.isNullOrBlank() }
      ?: ""

  val supabaseAnonKey: String =
    sequenceOf(
        (project.findProperty("SUPABASE_ANON_KEY") as String?)?.trim(),
        System.getenv("SUPABASE_ANON_KEY")?.trim(),
        localProps.getProperty("SUPABASE_ANON_KEY")?.trim(),
      )
      .firstOrNull { !it.isNullOrBlank() }
      ?: ""

  signingConfigs {
    create("release") {
      val props = Properties()
      val propsFile = rootProject.file("keystore.properties")
      if (propsFile.exists()) {
        propsFile.inputStream().use { props.load(it) }

        val storeFileProp = props.getProperty("storeFile")?.trim().orEmpty()
        val storePasswordProp = props.getProperty("storePassword")?.trim().orEmpty()
        val keyAliasProp = props.getProperty("keyAlias")?.trim().orEmpty()
        val keyPasswordProp = props.getProperty("keyPassword")?.trim().orEmpty()

        if (storeFileProp.isNotBlank() && storePasswordProp.isNotBlank() && keyAliasProp.isNotBlank() && keyPasswordProp.isNotBlank()) {
          val resolvedStoreFile =
            run {
              val f = File(storeFileProp)
              if (f.isAbsolute) f else File(propsFile.parentFile, storeFileProp)
            }

          storeFile = resolvedStoreFile
          storePassword = storePasswordProp
          keyAlias = keyAliasProp
          keyPassword = keyPasswordProp
        }
      }
    }
  }

  val releaseSigning = signingConfigs.getByName("release")

  flavorDimensions += "dist"
  productFlavors {
    create("play") {
      dimension = "dist"
      // Play Store policy: call-log access is a restricted permission and can cause rejection.
      // Keep tap-logging for Play builds; reserve call-log import for internal builds.
      buildConfigField("boolean", "CALL_LOG_AUTOMATION_ENABLED", "false")
    }
    create("internal") {
      dimension = "dist"
      buildConfigField("boolean", "CALL_LOG_AUTOMATION_ENABLED", "true")
    }
  }

  buildTypes {
    debug {
      buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
      buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
    }
    release {
      isMinifyEnabled = false
      buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
      buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      if (releaseSigning.storeFile != null) {
        signingConfig = releaseSigning
      }
    }
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

private val COROUTINES_VERSION = "1.7.3"
private val LIFECYCLE_VERSION = "2.8.1"
private val SERIALIZATION_VERSION = "1.6.3"

dependencies {
  implementation(project(":shared"))

  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.core:core-splashscreen:1.0.1")
  implementation("androidx.activity:activity-compose:1.9.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:$LIFECYCLE_VERSION")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$LIFECYCLE_VERSION")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$COROUTINES_VERSION")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$SERIALIZATION_VERSION")

  implementation("androidx.navigation:navigation-compose:2.7.7")
  implementation("androidx.work:work-runtime-ktx:2.9.0")
  implementation("androidx.biometric:biometric:1.1.0")

  // Compose (explicit versions to avoid BOM drift)
  implementation("androidx.compose.ui:ui:1.6.1")
  implementation("androidx.compose.ui:ui-tooling-preview:1.6.1")
  debugImplementation("androidx.compose.ui:ui-tooling:1.6.1")
  implementation("androidx.compose.material3:material3:1.2.0")
  implementation("androidx.compose.material:material-icons-extended:1.6.1")

  implementation("androidx.security:security-crypto:1.1.0-alpha06")

  // Bank statement PDF text extraction (Underwriting)
  implementation("com.tom-roush:pdfbox-android:2.0.27.0")

  // Support java.time APIs on API < 26 (minSdk is 24)
  coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
