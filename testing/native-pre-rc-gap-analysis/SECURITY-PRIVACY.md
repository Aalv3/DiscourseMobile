# Security, privacy and moderation

## Pass

- Members-only canonical host and native first-party routing remain enforced.
- User API tokens are Keychain-backed and omitted from serialized Site JSON; auth client ID, APNs token and installation identity remain distinct.
- Malformed stale RSA material is now locally remediated by an uncommitted change and tested.
- Push/backend URLs and route payloads are allowlisted; nonce and authentication remain server-authorized.
- Adjuster Card member responses remain server visibility-filtered; résumé/contact/account data is not rendered in member Search/cards.
- No Message/DM/Contact/Connections action is exposed.
- No-claim-data guidance remains in Welcome, Ask and attachment workflow.
- Share Extension contract excludes credentials and uses consume/delete App Group handoff.
- Search and evidence scans found no credential/bootstrap bundle in the current untracked product/evidence list.

## Open

- Media security/metadata/storage lifecycle is activation-gated; see `MEDIA-ACTIVATION.md`.
- Native reporting/escalation for another member’s topic/chat content is not obvious; own edit/delete is not a substitute for moderation.
- Legacy operational console logging should be minimized; no direct token logging was found.
- Suspended/hidden/system member exclusion is server contract evidence, not independently reproduced with current fixtures.
- Current dirty evidence must receive a final secret scan before commit/archive.
