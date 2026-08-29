#!/usr/bin/env bash
# Builds the standalone release APK, installs it on an authorized phone, and launches it.
#
# The APK embeds the JS bundle, so the installed app never looks for Metro. Expo
# signs the release variant with the template's fixed debug keystore, which is
# why reinstalling updates the app in place and leaves the garden alone.
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# $HOME rather than getent: getent is glibc-only and this script also runs on macOS.
user_home=${HOME:?HOME is not set}

# Gradle checks JAVA_HOME directly before looking at PATH. Prefer a real JDK 17,
# and repair stale shell values from removed local installs when possible.
java_home=''
if command -v /usr/libexec/java_home >/dev/null 2>&1; then
  java_home=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
fi
if [ -z "$java_home" ] && [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  java_home=$JAVA_HOME
fi
for java_candidate in \
  "$user_home/jdk17" \
  "$user_home/.local/opt/jdk-17" \
  /usr/lib/jvm/java-17-openjdk \
  /usr/lib/jvm/java-17-openjdk-amd64 \
  /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home; do
  if [ -z "$java_home" ] && [ -x "$java_candidate/bin/java" ]; then
    java_home=$java_candidate
  fi
done
if [ -n "$java_home" ]; then
  export JAVA_HOME="$java_home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# First SDK that exists wins: the explicit variables, then the path our Linux
# setup script installs to, then Android Studio's default location on macOS.
android_sdk_root=''
for sdk_candidate in "${ANDROID_SDK_ROOT:-}" "${ANDROID_HOME:-}" \
  "$user_home/.local/opt/android-sdk" "$user_home/Library/Android/sdk"; do
  if [ -n "$sdk_candidate" ] && [ -x "$sdk_candidate/platform-tools/adb" ]; then
    android_sdk_root=$sdk_candidate
    break
  fi
done

package_name='com.justsit.app'
apk_file='android/app/build/outputs/apk/release/app-release.apk'

if [ -z "$android_sdk_root" ]; then
  echo "ERROR: No Android SDK with platform-tools found." >&2
  echo "Install it with ../JediNotebook/setup-android-build-tools.sh, or set ANDROID_SDK_ROOT." >&2
  exit 1
fi
adb_bin="$android_sdk_root/platform-tools/adb"

for required_command in node npm npx java; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "ERROR: $required_command is required." >&2
    exit 1
  fi
done

export ANDROID_HOME="$android_sdk_root"
export ANDROID_SDK_ROOT="$android_sdk_root"
export PATH="$android_sdk_root/platform-tools:$PATH"

mapfile -t connected_devices < <("$adb_bin" devices | awk '$2 == "device" {print $1}')
if [ ${#connected_devices[@]} -eq 0 ]; then
  echo "ERROR: No authorized Android device found." >&2
  "$adb_bin" devices -l >&2
  echo "Unlock the phone and accept the USB debugging prompt, then retry." >&2
  exit 1
fi

device_serial=${ANDROID_SERIAL:-"${connected_devices[0]}"}
device_abi=$("$adb_bin" -s "$device_serial" shell getprop ro.product.cpu.abi | tr -d '\r')
case "$device_abi" in
  armeabi-v7a|arm64-v8a|x86|x86_64) ;;
  *)
    echo "ERROR: Unsupported device ABI: ${device_abi:-none}" >&2
    exit 1
    ;;
esac

echo "==> Using device: $device_serial ($device_abi)"
cd "$script_dir"

echo "==> Typechecking..."
npm run typecheck

echo "==> Running tests..."
npm test

# Regenerates android/ from app.json. Idempotent, so it is safe every run — and
# skipping it would silently build the previous app.json's native config.
echo "==> Syncing the native project..."
npx expo prebuild --platform android

# Only the connected phone's ABI: the default builds all four, which quadruples
# the native compile and triples the size of an APK going to one device.
echo "==> Building the release APK for $device_abi..."
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$device_abi")

if [ ! -f "$apk_file" ]; then
  echo "ERROR: APK not found at $apk_file" >&2
  exit 1
fi

echo "==> Installing or updating $package_name (preserving app data)..."
"$adb_bin" -s "$device_serial" install -r "$apk_file"

echo "==> Launching JustSit..."
"$adb_bin" -s "$device_serial" shell am start -n "$package_name/.MainActivity"
"$adb_bin" -s "$device_serial" shell dumpsys package "$package_name" | \
  awk '/versionCode=|versionName=|lastUpdateTime=/{print}'

echo "Done."
