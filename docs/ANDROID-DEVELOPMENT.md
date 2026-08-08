# Reproducible Android development

## Supported local baseline

The Adjuster Network branch builds the upstream React Native 0.80.2 Android project. The verified Windows baseline is:

- Microsoft OpenJDK 17.0.20 x64;
- Android command-line tools `15859902`;
- Android Platform 35 and Build Tools 35.0.0;
- Android Platform Tools 37.0.1;
- Android NDK 27.1.12297006; and
- the repository-pinned Gradle wrapper 8.14.1.

JDK 17 is intentionally used even when a newer system Java exists. Node must satisfy `package.json` (`>=18`); Yarn 4.9.4 is supplied by Corepack.

## Install without machine-wide mutation

Download the OpenJDK 17 Windows x64 ZIP from Microsoft and Android command-line tools from Android Developers. Verify the Android archive against the checksum published on the download page before extraction. A portable layout under `%LOCALAPPDATA%\AdjusterNetworkDevTools` avoids administrator access:

```powershell
$toolRoot = Join-Path $env:LOCALAPPDATA 'AdjusterNetworkDevTools'
$env:JAVA_HOME = Get-ChildItem "$toolRoot\jdk17" -Directory | Select-Object -ExpandProperty FullName -First 1
$env:ANDROID_HOME = "$toolRoot\android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" `
  'platform-tools' 'platforms;android-35' 'build-tools;35.0.0' 'ndk;27.1.12297006'
```

Run `powershell -File scripts/verify-android-toolchain.ps1` in the same configured shell.

## Debug-only generated files

Upstream omits `android/gradle.properties` and `android/app/google-services.json` because its private Fastlane bootstrap generates them with release credentials. Never run that private bootstrap or copy upstream secrets for local Adjuster Network work.

For a local debug compile, create an ignored `android/gradle.properties` with `MYAPP_VERSION`, AndroidX, Hermes, new-architecture, and architecture values. Release keystore properties must remain placeholders and no release task may be run. A debug compile also requires an ignored Firebase JSON matching `com.discourse`; until an owner Firebase project is authorized, use a clearly synthetic, nonfunctional local file. Neither file may be committed.

## Gates

```powershell
corepack yarn install --immutable
corepack yarn prettier
corepack yarn eslint
corepack yarn test:unit --runInBand
corepack yarn verify:backend
& .\android\gradlew.bat -p android assembleDebug --no-daemon
```

The output is `android/app/build/outputs/apk/debug/app-debug.apk`. It is an unsigned-development artifact for local testing only.

On Windows, keep the checkout path short. React Native new-architecture CMake object names can exceed the legacy 260-character boundary from a deeply nested checkout; Ninja then fails at `buildCMakeDebug` even though Java compilation and dependency resolution have succeeded. The verified non-destructive remedy is a temporary drive mapping:

```powershell
subst N: 'C:\path\to\adjuster-network-native'
& N:\android\gradlew.bat -p N:\android assembleDebug --no-daemon
subst N: /d
```

Gradle must run through the short path, while Yarn and Metro must run from the canonical checkout because Yarn verifies its real project root. A separate short checkout is also valid. Global Windows long-path mutation and disabling React Native's new architecture are unnecessary.

## Emulator or device

An emulator additionally requires the SDK emulator package, a Platform 35 system image, hardware virtualization, and an AVD. A physical Android 8+ device may instead use USB debugging through ADB. Emulator/device launch is not a compile gate, and production signing, Firebase/push credentials, owned application IDs, store upload, or publication remain separate owner-authorized release work.

The Windows certification AVD used the independently removable packages `emulator` and `system-images;android-35;google_apis;x86_64`, with a Pixel 6 profile named `AdjusterNetwork_API35`. Metro ran from the canonical checkout and `adb reverse tcp:8081 tcp:8081` connected the debug app. Screenshots and UI hierarchy dumps belong outside the repository.
