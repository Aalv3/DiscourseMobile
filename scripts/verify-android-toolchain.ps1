$ErrorActionPreference = 'Stop'

$requiredEnvironment = @('JAVA_HOME', 'ANDROID_HOME')
foreach ($name in $requiredEnvironment) {
  $value = [Environment]::GetEnvironmentVariable($name, 'Process')
  if ([string]::IsNullOrWhiteSpace($value) -or -not (Test-Path -LiteralPath $value)) {
    throw "$name must point to an installed local toolchain directory"
  }
}

$java = Join-Path $env:JAVA_HOME 'bin\java.exe'
$sdkManager = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat'
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'

foreach ($tool in @($java, $sdkManager, $adb)) {
  if (-not (Test-Path -LiteralPath $tool)) {
    throw "Required tool is missing: $tool"
  }
}

& $java -version
& $sdkManager --version
& $adb version

$requiredPackages = @(
  'build-tools;35.0.0',
  'ndk;27.1.12297006',
  'platform-tools',
  'platforms;android-35'
)
$installed = (& $sdkManager --list_installed) -join "`n"
foreach ($package in $requiredPackages) {
  if ($installed -notmatch [regex]::Escape($package)) {
    throw "Required Android SDK package is missing: $package"
  }
}

Write-Output 'PASS: JDK and pinned Android SDK packages are available.'
