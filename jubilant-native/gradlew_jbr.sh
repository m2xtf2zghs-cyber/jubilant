#!/usr/bin/env bash
set -euo pipefail

# Gradle needs a Java runtime. Use Android Studio's bundled JBR.
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# Keep Gradle caches inside the repo (sandbox-friendly).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GRADLE_USER_HOME="${SCRIPT_DIR}/.gradle-user-home"

exec "${SCRIPT_DIR}/gradlew" "$@"

