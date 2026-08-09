# Adjuster Network native shared contracts

The native client is an adapter to versioned server contracts. It does not reproduce admission, permission, moderation, export, profile, or intelligence business logic.

## Product destinations

| Destination | Native state | Server contract |
| --- | --- | --- |
| Floor | existing `Home` web surface | authenticated Discourse web contract |
| Activity | existing `Notifications` route | Discourse notification contract |
| Ask | unavailable | stable compose contract required |
| CAT | contract only, no route | `an.home-intelligence.v1` |
| You | unavailable | first-party profile/onboarding contract required |

Today’s Brief and Homepage Intelligence use authenticated `GET /renaissance/intelligence`. The client accepts only schema `an.home-intelligence.v1`, displays server-provided states and provenance, ignores additive fields, and fails to an explicit unavailable state for an unknown schema or missing section. It does not infer weather impact, invent an empty-state item, or treat a source link as Network reporting.

## Authentication, links, and appearance

Authentication remains Discourse User API Key v2 in the system browser with encrypted callback data and token persistence in AsyncStorage. The server is authoritative for revocation and authorization. The upstream `discourse://auth_redirect` and `discourse://open` schemes remain development compatibility paths; an owner-controlled scheme plus HTTPS App/Universal Links is a release gate.

Light and dark follow the operating system through the existing theme boundary. Both remain release screenshot/accessibility gates.

## Restricted and future states

Closed registration, upload/image restrictions, member-message restrictions, staff access, export authorization, and departure closure are server decisions. A client must fail closed and never turn missing capability data into permission.

Onboarding and Request to Join intentionally have no native routes. Their future contract entries remain `counsel_gated`; this sprint does not implement or imply final pre-account acknowledgement semantics.
