pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  // Kotlin/Native toolchains are downloaded via a Gradle-added ivy repository.
  // Prefer project repositories so Kotlin/Native can install correctly.
  repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "jubilant-native"

include(":androidApp")
include(":shared")
