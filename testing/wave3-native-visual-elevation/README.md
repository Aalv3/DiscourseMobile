# Wave 3 native visual elevation evidence

This package records representative Simulator evidence for the app-wide Wave 3
design-system pass. It is not a new functional certification and contains no
credentials, tokens, private payloads, or member-entered content.

The implementation preserves the `an-ios-android-1.0.0-native-2` runtime and
uses only existing React Native primitives, the bundled Font Awesome icon set,
and the canonical Adjuster Network logo.

## Design direction

- Editorial rows and dividers replace repetitive card stacks for discussions,
  collections, search, settings, and intelligence destinations.
- Raised surfaces are reserved for focal content: the Floor briefing, state
  messages, safety guidance, and the Adjuster Card.
- One compact branded header hierarchy remains shared across primary and nested
  destinations.
- Conversation and chat retain distinct density and hierarchy while using the
  same color, typography, spacing, action, and accessibility primitives.

See `manifest.json` for the exact capture inventory.

## Validation boundary

The clean Release-style Simulator build passed and the signed Release physical
build passed code signing, installed on the paired iPhone 15 Pro, and accepted a
launch request. The preserved Simulator container was signed out, so no attempt
was made to re-enter the previously unreliable Simulator system-auth flow.
Authenticated member surfaces were therefore validated through automated
contracts plus the bounded physical launch, without creating test content or
reopening frozen behavior.
