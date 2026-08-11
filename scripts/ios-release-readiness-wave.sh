#!/usr/bin/env bash
set -euo pipefail

# Simulator-only evidence wave. It never signs, archives, uploads, submits, or changes a domain.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
evidence_root="${1:-$repo_root/.local/ios-readiness}"
mkdir -p "$evidence_root"

exec > >(tee "$evidence_root/wave.log") 2>&1
cd "$repo_root"

printf 'commit=%s\n' "$(git rev-parse HEAD)" | tee "$evidence_root/revision.txt"
git status --short --branch | tee -a "$evidence_root/revision.txt"
sw_vers
xcodebuild -version
xcrun simctl list runtimes
node --version
corepack yarn --version
bundle --version
pod --version

corepack yarn install --immutable
bundle install
bundle exec pod install --project-directory=ios
corepack yarn prettier
corepack yarn eslint
corepack yarn test:unit --runInBand
corepack yarn verify:release-readiness | tee "$evidence_root/readiness.json"

rm -rf "$repo_root/ios/build-readiness"
xcodebuild \
  -workspace ios/Discourse.xcworkspace \
  -scheme Discourse \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build-readiness \
  CODE_SIGNING_ALLOWED=NO \
  build | tee "$evidence_root/xcodebuild.log"

printf '%s\n' 'BUILD PASS. Continue with the manual runtime matrix in docs/IOS-MAC-RELEASE-READINESS-WAVE.md.'
