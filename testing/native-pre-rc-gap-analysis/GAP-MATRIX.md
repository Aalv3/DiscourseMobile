# Gap matrix

| ID | Priority | Area | Finding | Required disposition |
|---|---|---|---|---|
| RC-01 | P1 RC | Source freeze | V2/media exists only as a large dirty delta on Build 2 SHA; no immutable provenance. | Review diff, retain evidence policy, commit/push only after founder approval, clean tree. |
| RC-02 | P1 RC | Push | Startup `.catch` maps every failure to `push_registration_failed`; APNs/token/install/backend/nonce/network stages are lost. Manual enable also omits status-specific backend and nonce categories. | Preserve a privacy-safe structured failure category end-to-end and add startup tests. |
| RC-03 | P1 RC / DEVICE | Push | No production-signed physical proof after Build 2 registration failure. | Exact next TestFlight build: permission, production token, registration owner/environment/topic, receipt, background receipt, tap, token refresh. |
| RC-04 | P1 RC | Notifications | `NotificationsScreen._fetchNotifications()` has no rejection handler. Offline/401/5xx can leave the placeholder or prior state without a recoverable error. | Add bounded error state/retry while preserving prior items. |
| RC-05 | P1 RC decision | Media | Attachment actions are present while production rejects all extensions. This is truthful after rejection but permits wasted selection/composition. | Before RC, explicitly choose capability-gated unavailable UI or complete activation certification; do not silently fail. |
| RC-06 | P1 RC / RELEASE | Distribution | Current source has never produced an archive; Build 2 is consumed and current plist remains build 2. | After source freeze use build 3+, fresh archive, Hermes UUID check, Validate App, then bounded TestFlight. |
| CL-01 | Commercial launch | Media security | EXIF request uses `exif:false`, but original selected URI is uploaded; metadata stripping is not proven. Type/size are not prevalidated and malware/storage/retention are server dependencies. | Complete `MEDIA-ACTIVATION.md` before enabling uploads. |
| CL-02 | Commercial launch | Moderation | Native topic/Lounge surfaces expose own edit/delete but no clear report/flag escalation for another member’s content. | Product/security decision: native report route or explicit safe support path. |
| CL-03 | Commercial launch / DEVICE | Accessibility | Structural labels exist, but current V2 has no hands-on VoiceOver, Switch Control, reduced-motion, or accessibility-extra-large physical certification. | Complete representative device accessibility walk. |
| P2-01 | P2 | Offline | No last-known read cache; many destinations show empty/error after network loss. | OTA-safe post-RC unless launch policy requires offline reading. |
| P2-02 | P2 | Collections | Intelligence/category collections have bounded initial loads but limited pagination/refresh affordance. | OTA-safe. |
| P2-03 | P2 | Lounge | Ten-second active-only polling rather than MessageBus realtime; reconnect preserves history but can lag. | Founder-approved for current scope; monitor. |
| P2-04 | P2 | Navigation accessibility | Six fixed tab labels disable font scaling to fit. VoiceOver labels remain; visual text does not honor Dynamic Type. | Founder-approved constraint; seek accessible alternative post-RC. |
| P2-05 | P2 | Search | No pagination/recent queries/suggestions. Current real topic/member results and privacy are correct. | Explicitly non-blocking. |
| P2-06 | P2 | Orientation | iPhone portrait is certified; Info.plist declares landscape and upside-down without current V2 evidence. | Either test supported orientations or narrow declaration in a future binary review. |
| P2-07 | P2 | Logs | Legacy background/site/discover paths retain operational `console` statements. No tokens were found, but release log minimization is incomplete. | Privacy-safe log review before commercial launch. |
| P2-08 | P2 | Evidence | Many intermediate/stale screenshots coexist with founder captures and have no per-file source provenance. | Curate manifests during source freeze; never use Build 2 evidence for current source. |

## Approved future work (not RC blockers)

- Request Access/enrollment expansion: current closed enrollment remains intentional.
- ZIP/coarse location and Adjuster Map, richer résumé, recruiter visibility, deployment availability: future product gates.
- Direct member messaging: intentionally not exposed.
