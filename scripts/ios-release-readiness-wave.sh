#!/usr/bin/env bash
set -euo pipefail

# Simulator-only evidence wave. It never signs, archives, uploads, submits, or changes a domain.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workflow="ios-release-readiness"
eval "$(node "$repo_root/scripts/native-build-storage.mjs" begin --workflow="$workflow" --shell)"
evidence_root="$AN_NATIVE_EVIDENCE_DIR"
derived_data="$AN_NATIVE_BUILD_WORKSPACE/DerivedData"
run_status=failed

finish_run() {
  local exit_code=$?
  trap - EXIT INT TERM
  node "$repo_root/scripts/native-build-storage.mjs" finish \
    --workflow="$workflow" \
    --run-id="$AN_NATIVE_RUN_ID" \
    --status="$run_status" || true
  exit "$exit_code"
}
trap finish_run EXIT
trap 'run_status=failed; exit 130' INT TERM

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
corepack yarn format:check
corepack yarn lint
corepack yarn test:unit --runInBand
corepack yarn verify:release-readiness | tee "$evidence_root/readiness.json"

for configuration in Debug Release; do
  configuration_slug=$(printf '%s' "$configuration" | tr '[:upper:]' '[:lower:]')
  # DerivedData is disposable build state, never audit evidence. Both configurations
  # share this run-scoped workspace and it is removed by the EXIT trap.
  xcodebuild \
    -workspace ios/Discourse.xcworkspace \
    -scheme Discourse \
    -configuration "$configuration" \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$derived_data" \
    CODE_SIGNING_ALLOWED=NO \
    clean build | tee "$evidence_root/xcodebuild-$configuration_slug.log"
done

printf '%s\n' 'DEBUG + RELEASE BUILDS PASS. Continue with the manual runtime matrix in docs/IOS-MAC-RELEASE-READINESS-WAVE.md.'
run_status=success
