# AN Preview lane

A founder-only build that installs beside Production on the same iPhone and
talks to the **real production server**. Uncertified candidates are validated
here instead of on the production OTA channel.

## Identity

| | Production | AN Preview | Staging |
| --- | --- | --- | --- |
| Bundle ID | `org.adjusternetwork.app` | `org.adjusternetwork.app.preview` | `org.adjusternetwork.app` |
| Display name | Adjuster Network | **AN Preview** | Adjuster Network |
| URL scheme | `adjusternetwork://` | `anpreview://` | `adjusternetwork://` |
| Auth redirect | `adjusternetwork://adjusternetwork.org/auth_redirect` | `anpreview://adjusternetwork.org/auth_redirect` | `adjusternetwork://adjusternetwork.org/auth_redirect` |
| App group | `group.org.adjusternetwork.app` | `group.org.adjusternetwork.preview` | `group.org.adjusternetwork.app` |
| OTA channel | `production` | `preview` | `staging` |
| Xcode config | Release | **Preview** | Debug |
| Server | adjusternetwork.org | **adjusternetwork.org** | staging.adjusternetwork.org |

The display name is `AN Preview`, not `Adjuster Network Preview`: iOS truncates
home-screen labels around twelve characters, and the long form renders as
"Adjuster Netw…" — indistinguishable from Production, which defeats the point.

## Why the isolation holds

Everything below is isolated because the bundle identifier differs. No
namespacing code was added, and none is needed.

- **Keychain** — no `keychain-access-groups` entitlement is declared anywhere,
  so items land in the default per-bundle-ID access group. RSA keys, site
  tokens and the push installation ID separate automatically despite sharing
  hardcoded service names.
- **AsyncStorage, cookies, Expo Updates state** — inside the app sandbox.
- **User API client ID** — `@ClientId` is per-sandbox, so Preview mints its own
  32-byte identity and receives its own User API key. Revoking one leaves the
  other valid.
- **Push tokens** — issued by APNs per bundle ID. Preview registers no device
  at all in V1 (see below).

Three things had to differ explicitly, and do:

- **URL scheme.** Two installed apps claiming `adjusternetwork://` is undefined
  behaviour on iOS: the auth callback could be delivered to the wrong app.
- **Auth redirect.** Follows the scheme, and must be allowlisted server-side.
- **App group.** A genuinely shared container, so Preview gets its own.

## Channel isolation is structural

The channel is written into the built `Expo.plist` by an Xcode build phase and
sent as the `expo-channel-name` request header. There is no runtime switch.

```
case "$channel" in
  staging)    embedded=false ;;
  preview)    embedded=true ;;
  production) embedded=true ;;
  *) echo "error: invalid Adjuster Network OTA channel" >&2; exit 1 ;;
esac
```

A Production binary cannot request `preview` updates because it cannot request
anything but `production`, and vice versa. An unrecognised channel still fails
the build. `verify:ota` asserts all four arms.

## V1 boundaries

**Push is off.** The server pins `TOPIC = "org.adjusternetwork.app"` behind a
`raise`, and `apns-topic` must equal the receiving app's bundle ID. Rather than
weaken that pin, Preview sets `pushDelivery: false` and registers no device, so
it never creates registrations that could not be delivered to. Preview's
entitlements carry no `aps-environment`. **V2:** make the server topic
per-registration instead of a constant.

**Universal links are off.** The server AASA lists only
`<team>.org.adjusternetwork.app`. Preview's entitlements carry no
`associated-domains`, so it never appears in link disambiguation. **V2:** add a
second AASA entry.

Both are deliberate omissions that also keep the Apple setup small: the Preview
App ID needs only the App Groups capability.

## Workflow

```
feature branch → fast CI → preview OTA → iPhone validation in AN Preview
              → founder approval → promote exact content to production
```

Publish a candidate:

```
AN_OTA_CHANNEL=preview AN_OTA_GIT_SHA=$(git rev-parse HEAD) \
  npx eas-cli@latest update --branch preview --platform all \
  --message "Preview $(git rev-parse --short=12 HEAD) <what changed>" \
  --non-interactive
```

Verify what the phone actually runs:

```
yarn device:harness ota-status     # update ID must match the publish output
```

After founder PASS, promote the **validated group** to production rather than
rebundling, so the artifact approved is the artifact that ships:

```
yarn ota:promote --group=<preview group UUID>
```

**Provenance tags are for production artifacts only.** A Preview publish gets
no `ota-*` tag; the tag is created at promotion, as today. A Preview candidate
is already identified by its PR head SHA.

## Removal

Delete AN Preview from the phone; remove the `preview` channel; revoke the
Preview User API key from the founder account; run
`testing/an-preview/rollback-preview-auth-redirect.rb`. Production shares no
storage, credential or channel with Preview and is unaffected at every step.
