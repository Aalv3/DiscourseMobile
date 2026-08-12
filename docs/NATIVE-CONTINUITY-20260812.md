# Native continuity checkpoint — 2026-08-12

## Canonical state

- Repository: `adjuster-network-native` on the canonical Mac development/certification worker.
- Branch: `codex/an-2700-native-foundation`.
- End-of-day source baseline: `73d794a3917fd6b4fdba1b7fc548ead7ccb98814` before this checkpoint-only commit.
- That baseline is synchronized with `origin/codex/an-2700-native-foundation` and contains the
  validated Dynamic Type tab-label correction.
- Root `.bundle/` and `.local/` hold project-local tooling and certification/build evidence. They are
  intentionally retained locally and ignored; they must not be committed as product source.

## LBD-056 disposition

LBD-056 remains **NO-GO**, narrowed to the remaining owner-operated iPhone certification and the
external Apple identity gate. iPhone/mobile is the launch priority. The completed iPad matrix is
useful regression evidence but is non-blocking and must not displace the iPhone closeout.

Passed on the current native line:

- immutable dependency installation, formatting, lint, unit tests and unsigned Release simulator
  compilation;
- production native authorization with `read,notifications,session_info,one_time_password`, callback
  completion and authenticated private-content loading;
- iPad Floor, Discussions, Lounge, Ask, Intelligence and You ordinary-member surfaces, with no
  staff/operator UI leakage;
- iPad Keychain persistence across force-quit/relaunch, logout cleanup, login again and reinstall
  isolation without observed RSA collision or cross-account leakage;
- light/dark rendering and authenticated AX XXXL Dynamic Type. The fixed tab bar retains readable
  visual labels while its accessibility tree exposes full labels and tab positions;
- runtime log review with zero credential-field, auth-callback query or private-payload matches; and
- AASA endpoint transport/content validation at the currently supported placeholder identity.

## Exact resume point

Tomorrow, fetch this branch and begin with the **owner-operated iPhone closeout only**. Through the
normal supported login flow, the owner enters the permanent ordinary-member credential directly into
the simulator; it must not be echoed, logged, screenshotted, committed or placed in evidence. Then
certify callback/content, Keychain force-quit/relaunch, all six member screens, logout/login,
reinstall isolation, light/dark, authenticated Dynamic Type, full manual VoiceOver focus/labels/
controls traversal, background privacy in the app switcher, and a final sanitized log review.

Do not rerun or expand iPad work unless the iPhone pass reveals a shared regression.

## Remaining gates and prohibitions

- Universal Links remain external-blocked until the real Apple Team ID is supplied and configured in
  the AASA app ID and native entitlement. AASA transport is GO; full Universal Links are not.
- The build currently warns that `NSLocationWhenInUseUsageDescription` is empty. Before store
  readiness, determine whether location access is actually used; remove the unused declaration or
  provide accurate owner-approved purpose text. No cleanup was implemented at this checkpoint.
- Production push notifications remain a mandatory pre-store implementation and certification gate.
  That work has not started.
- OTA updates remain a mandatory pre-store gate, including integrity, channel selection and rollback
  certification. That work has not started.
- Signing, archiving for distribution and store submission remain prohibited until LBD-056, Apple
  identity/AASA, push, OTA and the later signing/store-readiness gates are complete.
- Do not alter production web/backend state from this native lane.
