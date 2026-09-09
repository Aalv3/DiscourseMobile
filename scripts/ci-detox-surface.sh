#!/usr/bin/env bash
# Decides whether a change needs the full iPhone+iPad Detox regression.
#
# The Detox suite is three logged-out specs. Every assertion in it resolves to
# js/product/ProductScreens.js or js/screens/HomeScreenComponents/NavigationBar.js,
# plus the authentication start those screens trigger. It cannot reach anything
# behind sign-in. So a JS change that cannot touch the logged-out shell gets no
# signal from ~100 minutes of runner time, and is gated instead by lint, Jest,
# the static native gates, and the physical-device certification step.
#
# Writes `full=` and `reason=` for $GITHUB_OUTPUT. Fails closed: if the changed
# file list cannot be computed, run the full regression.
set -euo pipefail

emit() { echo "full=$1"; echo "reason=$2"; }

case "${EVENT:-}" in
  workflow_dispatch) emit true "manual full regression requested"; exit 0 ;;
  schedule)          emit true "nightly full regression"; exit 0 ;;
esac

# An explicit owner decision outranks any path rule, in both directions.
case ",${LABELS:-}," in
  *,skip-full-detox,*) emit false "owner label skip-full-detox"; exit 0 ;;
  *,full-detox,*)      emit true  "owner label full-detox"; exit 0 ;;
esac

if [ -z "${BASE:-}" ] || [ -z "${HEAD:-}" ]; then
  emit true "changed-file list unavailable; failing closed to the full suite"
  exit 0
fi
# Merge-base, not a two-dot diff, so a PR is judged on what it adds. Note that
# a PR stacked on an unmerged branch still inherits its parent's files here; it
# will run the full suite, and skip-full-detox is the escape hatch.
MERGE_BASE=$(git merge-base "$BASE" "$HEAD" 2>/dev/null || echo "$BASE")
if ! CHANGED=$(git diff --name-only "$MERGE_BASE" "$HEAD" 2>/dev/null) || [ -z "$CHANGED" ]; then
  emit true "changed-file list unavailable; failing closed to the full suite"
  exit 0
fi

# Native, runtime, harness, and the specific JS files the Detox specs assert on.
TRIGGERS='^(ios|android|e2e)/
^\.detoxrc
^\.github/workflows/
^(package\.json|yarn\.lock|app\.json|eas\.json)$
^(Gemfile|app\.config\.|metro\.config\.|babel\.config\.|react-native\.config\.)
^js/product/ProductScreens\.js$
^js/screens/HomeScreen
^js/(Discourse|iosAuthSession|site_manager)\.js$'

if MATCHED=$(echo "$CHANGED" | grep -E "$(echo "$TRIGGERS" | paste -sd'|' -)" | head -5); then
  emit true "native, runtime or logged-out-shell surface changed: $(echo "$MATCHED" | paste -sd',' -)"
else
  emit false "no native, runtime or logged-out-shell surface changed"
fi
