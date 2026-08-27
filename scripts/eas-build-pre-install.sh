#!/usr/bin/env bash
set -euo pipefail

# React Native's Hermes podspec requires CMake when
# RCT_BUILD_HERMES_FROM_SOURCE=true. The pinned EAS macOS image does not ship
# it, so install only this missing native build prerequisite.
if command -v cmake >/dev/null 2>&1; then
  cmake --version
  exit 0
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "error: CMake is required for source-built Hermes and Homebrew is unavailable" >&2
  exit 1
fi

HOMEBREW_NO_AUTO_UPDATE=1 brew install cmake
command -v cmake >/dev/null 2>&1
cmake --version
