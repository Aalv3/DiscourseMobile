# Native release-readiness disposition — 2026-08-11

## Reconciliation

The canonical checkout is the `Aalv3/DiscourseMobile` fork on
`codex/an-2700-native-foundation`. Upstream baseline `e8bf7472` is followed by the Adjuster Network
foundation; `b077b917` contains the Android build/runtime evidence and `e713b052` is a later cleanup.
The branch continues through authenticated closeout commits `85a3c108`, `042768ad`, `009ca386` and
`e3bc322b`. No app has been signed, uploaded or published.

## Counsel-independent disposition

- Android debug/API 35 lifecycle evidence remains valid at the recorded scope: secure credential
  lifecycle, revocation, reinstall, account isolation, deep-link rejection, background privacy,
  bounded TalkBack labels, restrictions and cleanup.
- The local reproducible gates are immutable install, Prettier, ESLint, 12 Jest suites, anonymous
  backend contract, Android lint and Android debug assembly. Release identity/signing and verified
  links are deliberately not claimed by debug evidence.
- Android's release JavaScript/Hermes asset bundle and `lintRelease` also pass on the pinned
  Windows/JDK 17/API 35 toolchain. No release APK/AAB was produced because the only locally available
  keystore is the ignored debug keystore and debug signing is not release evidence.
- `yarn verify:release-readiness` inventories fail-closed privacy controls and prints every remaining
  owner-controlled identity/link/signing input. It does not read or print secrets.
- `scripts/ios-release-readiness-wave.sh` and the Mac checklist make the outstanding iOS work
  executable and evidence-producing as soon as Mac/Xcode access exists.

## Exact unresolved release gates

The minimum true owner input is one written configuration packet containing:

1. the owned Android application ID, iOS app bundle ID, iOS Share Extension bundle ID and unique
   callback scheme;
2. the custodian and secure delivery path for the Android release keystore plus the Apple Developer
   team/certificate/provisioning authority (never the credentials themselves in Git);
3. which owned HTTPS domain is approved for App Links/Universal Links, and authorization to publish
   its `assetlinks.json`/AASA association files in the later serialized production lane;
4. either an owned Firebase mobile project/configuration or an explicit decision to remove Firebase
   from the first release while push stays off;
5. the release version/build numbers and the account/custodian that will later own each store record;
6. approved privacy/store answers supplied by the qualified owner/counsel process, without the native
   lane inventing them.

Android cannot produce a release candidate until items 1, 2 and 4 exist. Verified links remain
blocked until item 3 is configured and later published. Store-metadata completion requires items 5
and 6. iOS cannot become runtime-certified on Windows: the exact external restoration requirement is
interactive access to a Mac capable of checking out this branch, with current supported Xcode and
an iPhone/iPad simulator runtime, Ruby/Bundler and CocoaPods, enough disk for Pods/DerivedData, and
permission to export the redacted `.local/ios-readiness` evidence. Simulator build/runtime work does
not require signing credentials; signed-device/archive work additionally requires item 2.

These gates must not be filled with the upstream Discourse identifiers, team, domains or credentials.

No store submission/publication, production callback/domain mutation, production identity creation,
push activation or legal-language change is authorized by this disposition.
