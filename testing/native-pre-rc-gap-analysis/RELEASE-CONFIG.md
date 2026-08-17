# Release configuration

| Item | Current source | Verdict |
|---|---|---|
| Version/build | 1.0.0 (2), both app and Share Extension | Build 2 consumed; next upload requires 3+. |
| Bundle IDs | `org.adjusternetwork.app`, `.ShareExtension` | PASS |
| Runtime | `an-ios-android-1.0.0-native-2` | PASS; no new dependency/runtime in dirty work. |
| OTA | EAS URL, production/staging channels, embedded update, anti-bricking, nonblocking launch | PASS structurally; do not publish during audit. |
| APNs | build-substituted entitlement/runtime; Release production contract | PASS structurally, device blocked. |
| Associated Domains | `applinks:adjusternetwork.org`; AASA HTTP 200 JSON on 2026-08-17 | PASS structurally. |
| App Group | `group.org.adjusternetwork.app` on app/extension | PASS |
| Share types | URL/text only, bounded handoff | PASS structurally; device required. |
| Privacy strings | Camera/photo present; microphone remains declared though current media picker is image/file only | Review metadata claim before archive; not currently blocking. |
| Privacy manifest | App manifest declares linked name, media, user content, search history, user/device ID and interaction; tracking false | PASS structural; reconcile with final App Privacy answers. |
| Signing/archive | Last certified Build 2 archive is stale for dirty source | Fresh archive required after freeze. |
| Hermes dSYM | Build 2 pipeline certified | Re-run final-archive UUID guard. |
| Branding | Adjuster Network display/launch/icon; internal scheme/target names intentionally retained | PASS |

Required release sequence: clean source SHA → build 3+ → Release archive → codesign/entitlement/runtime/secret/Hermes checks → export → Apple Validate App with zero blockers → owner-authorized TestFlight upload only.
