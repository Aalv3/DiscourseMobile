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

The counsel-independent iPhone LBD-056 matrix is complete. Overall LBD-056 remains **NO-GO only on
the external Apple identity gate**: the real Apple Team ID is still required for full Universal
Links. iPhone/mobile remains the launch priority; iPad evidence is supporting and non-blocking.

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

Do not rerun the completed iPhone/iPad certification without a relevant source change. Resume at the
external Apple Team ID/Universal Links gate. Push notifications and OTA integrity/channel/rollback
remain the next mandatory implementation/certification programs, but must begin only when separately
authorized. Signing and store submission remain prohibited.

## iPhone closeout — 2026-08-12

The owner completed ordinary-member authentication and manual accessibility/privacy actions without
placing the credential in commands or evidence. The iPhone closeout passed:

- native authorization, callback, four-scope authenticated content and no persistent Connecting
  state;
- Keychain persistence across force-quit/relaunch;
- Floor, Discussions, Lounge, Ask, Intelligence and You in light/dark, with ordinary-member identity
  and no admin, moderator or operator surface;
- authenticated AX XXXL Dynamic Type with scrollable content and all six tabs exposed with complete
  accessibility labels and tab positions;
- owner-operated VoiceOver traversal for focus order, labels, controls, actionability and clipping;
- owner-operated app-switcher verification that the background privacy shield hides private content
  and restores it only after foregrounding;
- logout cleanup followed by a second normal authorization/callback/content load; and
- uninstall/reinstall account isolation: the new installation opened signed out with no member
  identity, private content, RSA collision or cross-account leakage.

The final sanitized three-hour simulator log scan covered 14,851 app log lines and found zero
credential-field, auth-callback query or private-payload matches. Local screenshots/build logs remain
under ignored `.local/` evidence and contain no password capture.

## Remaining gates and prohibitions

- Universal Links remain external-blocked until the real Apple Team ID is supplied and configured in
  the AASA app ID and native entitlement. AASA transport is GO; full Universal Links are not.
- Location access is unused: the product tree contains no Core Location API/import, location
  dependency or location entitlement. The inherited empty `NSLocationWhenInUseUsageDescription`
  declaration was removed on resume; simulator build validation must remain warning-free for it.
- Production push notifications remain a mandatory pre-store implementation and certification gate.
  That work has not started.
- OTA updates remain a mandatory pre-store gate, including integrity, channel selection and rollback
  certification. That work has not started.
- Signing, archiving for distribution and store submission remain prohibited until LBD-056, Apple
  identity/AASA, push, OTA and the later signing/store-readiness gates are complete.
- Do not alter production web/backend state from this native lane.
