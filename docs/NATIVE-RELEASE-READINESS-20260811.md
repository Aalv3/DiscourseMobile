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
- `yarn verify:release-readiness` inventories fail-closed privacy controls and prints every remaining
  owner-controlled identity/link/signing input. It does not read or print secrets.
- `scripts/ios-release-readiness-wave.sh` and the Mac checklist make the outstanding iOS work
  executable and evidence-producing as soon as Mac/Xcode access exists.

## Exact unresolved release gates

Android cannot become release-ready without the owner's application ID, unique callback scheme,
approved App Link domain/asset-links authorization, signing custody, Firebase decision/configuration,
versioning and approved store/privacy metadata. iOS cannot become runtime-certified on Windows and
also needs the owner packet enumerated in `IOS-MAC-RELEASE-READINESS-WAVE.md`. These gates must not be
filled with the upstream Discourse identifiers, team, domains or credentials.

No store submission/publication, production callback/domain mutation, production identity creation,
push activation or legal-language change is authorized by this disposition.
