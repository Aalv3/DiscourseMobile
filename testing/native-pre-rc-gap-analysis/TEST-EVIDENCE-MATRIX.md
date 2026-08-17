# Test and evidence reconciliation

| Evidence | Current result | Can certify current dirty source? |
|---|---|---|
| Prettier / ESLint | PASS | Yes, source quality only. |
| Jest | 47 suites / 278 tests PASS | Yes, covered contracts/units only. |
| OTA readiness | PASS | Yes, structural. |
| Native release readiness | PASS with out-of-band Android signing note | Yes, structural. |
| Backend verification | PASS against production on 2026-08-17 | Yes, bounded contract availability. |
| Signed Debug iPhone 17 Pro Simulator build | PASS | Yes, simulator compilation/launch only. |
| Authenticated V2 captures | Current dirty tree; founder-approved Floor, Discussions, Topic, Ask, Lounge, Intel, You, Notifications, Search | Yes for represented visual state; not production signing. |
| Current Search runtime | `qa_test` member and `Off Duty` discussion results observed | Yes for authenticated native routing/data. |
| Media captures/tests | Current dirty tree; selection and deliberate policy rejection | Client only; not upload activation. |
| Prior physical certifications | Multiple Build 1/Build 2 tasks | Corroboration only; stale for current source. |
| TestFlight Build 2 | Processed, functional baseline; push failure observed | Must not certify current dirty V2/media source. |
| Apple validation/Hermes | Build 2 archive only | Repeat on final archive. |

## Missing evidence

- Exact current-source Release archive and Apple validation.
- Production-signed APNs registration/receipt/tap after push remediation.
- Exact-candidate physical auth/upgrade/Universal Link/Share Extension smoke.
- Enabled-backend media E2E and metadata/security proof.
- Hands-on assistive-technology and real-network-transition evidence.
