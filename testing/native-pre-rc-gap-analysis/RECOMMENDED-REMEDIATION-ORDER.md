# Recommended remediation order

1. Founder reviews this audit and freezes scope/classification.
2. Preserve current tree; curate only required V2/media evidence. Review the complete delta, secret-scan, then commit approved V2/media/auth hardening as one or a small number of traceable commits. Do not mix release numbering.
3. Repair push failure-category preservation and add startup/manual/refresh regression tests.
4. Add Notifications collection rejection/retry behavior.
5. Make the explicit media RC decision: capability-gate while production is OFF, or complete the separate backend security activation. Never bypass policy.
6. Run full unit/lint/format/OTA/release checks and authenticated Simulator regression against a clean SHA.
7. Complete pre-archive physical checks that do not require production APNs/media activation: auth, links, Share Extension, accessibility, network transitions.
8. Advance build number, create fresh production archive, verify Hermes/signing/APNs/App Group/privacy/AASA/runtime, and Validate App.
9. Owner authorizes one internal TestFlight upload. Execute exact physical push/upgrade smoke. Fix only proven blockers; if source changes, repeat archive/validation.
10. Declare RC only when all P1 RC blockers and physical gates are closed with evidence tied to the exact SHA/build.

## Safe parallel lanes after founder review

- Push source taxonomy/tests.
- Notifications offline/error state.
- Evidence curation/source-freeze and secret scan (no overlapping product edits).
- Physical checklist preparation and release-config verification (read-only).
- Media backend/security certification is an independent backend/device lane, but native activation must wait for its GO.

Do not parallelize overlapping edits in `Discourse.js`, shared V2 components, or release project metadata without a designated owner.
