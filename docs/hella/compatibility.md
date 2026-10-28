# HumanLayer pilot compatibility gate

Date: 2026-10-27. Decision: **STOP — do not deploy this candidate.**

Planning update: the owner has now expanded the contribution scope to complete
self-hosted identity and access without commercial dependencies. See
[self-hosted OIDC proposal](self-hosted-oidc-proposal.md). The source findings below
remain valid; the prior recommendation to wait for broader scope is superseded.
Deployment remains gated on implementation and verification.

The requested pilot cannot proceed within the authorized focused Keycloak patch
boundary on the inspected source. WorkOS is an application identity and
organization dependency, not simply an OIDC issuer setting. This invokes the
plan's explicit stop/reassess condition. No authentication bypass, hosted WorkOS
substitution, placeholder credentials, or silent reasoning fallback was added.

This is a pre-deployment source audit, not a completed pilot. The report originated in forgyro-runtime and is now maintained in the
canonical HumanLayer downstream worktree under docs/hella; see README.md. No runtime project, forge record, image, deployment,
Keycloak client, gateway credential, or deck proposal was created.

## Reproducible candidate

Upstream: https://github.com/humanlayer/humanlayer

Inspected commit: `0dbe4f58f0df9e337783defb2928e8ab18b88725`; CLI package version `0.40.0`.
The daemon is a private workspace package without its own version field; its
candidate pin is the same source revision. These are audit pins, not approved
production image pins. No Codex binary version or container digest is approved.
The selected code includes CodeLayer/Fold execution backends; a Codex CLI pin and
user-level config alone cannot establish their effective provider behavior.

A clean shallow HTTPS clone was inspected in `/tmp/humanlayer-pilot-upstream`.
The existing `/home/kbingham/Sites/humanlayer` checkout is an older revision with
pre-existing staged/unstaged `kentest.py` work and was left untouched. The current
forgyro checkout was initially clean. No upstream scripts or dependencies ran.
`source-audit.json` records SHA-256 hashes of the principal inspected files.

## Blocking identity findings

| Surface | Source observation | Required work |
| --- | --- | --- |
| Browser | AuthProvider and many UI callers use WorkOS AuthKit, including organization switching | Replace the provider contract and preserve all authorization behavior, not just change callback URLs |
| API credentials | WorkosService creates, lists, validates and deletes user API keys; personal-access-token authorization calls it | Implement a separate local credential lifecycle and authorization mapping |
| Membership and artifacts | WorkosService queries active memberships; shared-artifact access and owner reassignment consume it | Replace membership authority consistently across protected resources |
| Synchronization | Electric proxy requires WorkOS client ID, redirect URI and API key, and obtains JWKS through its SDK | Add independent trusted issuer/audience configuration and equivalent organization-scoped sync checks |
| CLI enrollment | Device authorization and polling call `api.workos.com` directly | Replace enrollment, refresh and credential storage flows; retain separate scoped worker identity |
| Claims | Shared token schema requires `sid` and carries WorkOS `org_id` plus `internal_org_id` | Define stable issuer/subject mapping to the pilot organization across all consumers |

The inspected API and sync JWT validators obtain their issuer comparison from the
token itself and do not supply an audience in the shown verification calls.
This is not a claim that signatures are bypassed: verification still uses JWKS.
It does mean an issuer URL substitution alone does not meet the requested fixed
issuer/audience validation contract.

Judgment: replacing these connected credential, membership, browser and enrollment
paths is a substantial identity adaptation. A one-owner allowlist does not remove
the need to maintain authorization on API, streams and artifacts. Reassess the
scope before implementing that replacement.

## Independent reasoning/provider gate

`execute-codelayer.ts` accepts Codex efforts `low`, `medium`, `high`, `xhigh`, and
`max`; its guard excludes `none`. Unsupported effort becomes null and the launch
options omit `reasoningEffort`, while requesting a detailed reasoning summary.
Omission is not proof of thinking disabled. Shared capability definitions also
exclude `none`. The execution path derives model and effort from session state
and selects a research-subagent model separately.

The Fold path reads `CODELAYER_CODEX_*` environment settings and otherwise calls
its Codex provider. This is not evidence that a dedicated worker's user-level
Codex provider configuration governs every backend. Custom endpoint configuration
has a useful partial-configuration failure guard, but route enforcement, `auto`,
new/resumed/child sessions and thinking-off controls remain unverified.

Do not substitute `low`, hide summaries, or assume omitted reasoning means `none`.
Before acceptance, the chosen backend must explicitly reject incompatible launches
and demonstrate `auto` plus supported thinking-off controls at the gateway/provider
boundary. Hella's actual gateway route and credentials were not inspected or changed
because the identity gate already stops this pilot.

## Preliminary service and persistence inventory

| Component | Observed candidate | Outstanding requirement |
| --- | --- | --- |
| UI/API/daemon/sync proxy | Monorepo apps; devstack generates local API and daemon origins | Verify all routes, assets and callbacks under tailnet HTTPS, without hosted fallback |
| Database | PostgreSQL 18 with logical WAL; `packages/db/drizzle` migrations | Immutable image, migration ordering, isolated DB, consistent backup/restore |
| Sync | Electric 1.7.12 | Private upstream, protected proxy, replication state/recovery review |
| Artifacts | S3-compatible MinIO and bucket setup in Compose | Pin images (currently `latest`), private storage and authorized artifact delivery |
| Streams | Durable Streams image `0.3.0-cebb50e`, source commit in Compose, persistent volume | Auth routing, consistent restore, bounded memory; Compose sets a roughly 175 GiB maximum, unsuitable unchanged |
| Cache/queues | Redis 7 alpine with AOF and volume | Immutable image and determine durable queue/replay semantics |
| Worker | CLI/daemon checkout and credentials | Persist isolated identity and workspace, one session, no operational credentials |

Compose is a development dependency stack, not an accepted Kubernetes workload.
Self-update can be disabled using the CLI flag/environment capability in the
inspected source. Telemetry disablement and every optional integration startup
path have not been exhaustively tested. WorkOS has concrete required-service
configuration; Slack/Linear paths also reference credentials, but their full
startup optionality is not established by this audit. Do not provide dummy keys
to claim these integrations are disabled.

## Deferred work and acceptance

No capacity probe or live health baseline was performed, since deployment is
already prohibited by the compatibility gate. No namespace, quota, PVC, network
policy, secret or Flux source was applied. No existing service was restarted.
The canonical deck, its dirty subtree, dev server and CLI sessions were untouched.

After identity scope is resolved, all original requirements still apply: an
owner-controlled runtime proposal, accepted-source-only Flux publication,
`humanlayer` and `humanlayer-worker` isolation, no API token automount, no GPU,
SSD Longhorn with two storage replicas and `longhorn+git` recovery, and aggregate
ceilings of 6 CPU / 12 GiB memory / 40 GiB storage. Capacity and image digest
verification must precede deployment. Do not reuse the development Compose sizing.

All live acceptance remains **NOT RUN**: mobile continuity, gateway routing,
thinking-disabled provider fixtures, negative authorization cases, containment,
restart/isolated restore, and non-disruption. Three desktop-to-phone tasks over
seven days cannot be claimed from a source audit. No rollback is required because
nothing was deployed; the eventual rollback must preserve pending decisions,
diffs and persistent state while stopping ingress and new sessions.

Next decision: wait for an upstream self-hosted identity abstraction, or explicitly
expand scope to a maintained identity/authorization fork with a security test
matrix. Neither option relaxes the `auto` and thinking-disabled requirements.

## Pinned evidence

- [docker-compose.yaml](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/docker-compose.yaml)
- [apps/cli/package.json](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/cli/package.json)
- [apps/cli/src/auth/workos-device-auth.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/cli/src/auth/workos-device-auth.ts)
- [apps/cli/src/commands/self-update-capability.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/cli/src/commands/self-update-capability.ts)
- [apps/riptide-ui/src/integrations/workos/AuthProvider.tsx](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-ui/src/integrations/workos/AuthProvider.tsx)
- [apps/riptide-api/src/effects/services/workos/workos.service.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/effects/services/workos/workos.service.ts)
- [apps/riptide-api/src/auth/personal-access-tokens.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/auth/personal-access-tokens.ts)
- [apps/riptide-api/src/auth/jwt-validator.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/auth/jwt-validator.ts)
- [apps/riptide-electric-proxy/src/auth/effect/workos.service.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-electric-proxy/src/auth/effect/workos.service.ts)
- [apps/riptide-electric-proxy/src/auth/effect/jwt-validator.service.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-electric-proxy/src/auth/effect/jwt-validator.service.ts)
- [packages/schemas/src/effect/workos-access-token.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/schemas/src/effect/workos-access-token.ts)
- [apps/riptide-daemon/src/agents/codelayer/execute-codelayer.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-daemon/src/agents/codelayer/execute-codelayer.ts)
- [apps/riptide-daemon/src/effects/services/fold-sessions/fold-model-selection.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-daemon/src/effects/services/fold-sessions/fold-model-selection.ts)
- [packages/ai/src/config/index.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/ai/src/config/index.ts)
- [apps/devstack/src/lib/env-block.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/devstack/src/lib/env-block.ts)

## Follow-up: generic OIDC contribution scope

Further source tracing confirms coupling beyond login and authorization:

- `packages/db/src/tables/organizations.ts` requires a non-null
  `workos_organization_id` for each organization.
- `apps/riptide-api/src/lib/workos-service.ts` exposes organization creation and
  updates, membership creation/update/deletion, and organization-domain management.
- `apps/riptide-api/src/webhooks/workos.ts` consumes membership lifecycle events,
  updates Stripe seat quantities, and backfills access-request user identities.
- `apps/riptide-api/src/lib/seat-sync.ts` obtains billable membership counts from
  WorkOS. User profile lookup also supplies artifact-comment author display names.

OIDC Core standardizes user authentication and identity claims; it does not
replace these organization, invitation, billing-event, or application API-key
services. Reference: https://openid.net/specs/openid-connect-core-1_0.html

Recommendation: do not scope an upstream PR as merely a generic OIDC adapter.
A viable proposal would first separate three responsibilities: external identity
verification; application-owned users/organizations/membership; and application
credential issuance/revocation. Retain the existing WorkOS implementation for
hosted users and add a deliberately limited self-hosted implementation.

If maintainers support this direction, proposed contribution sequence:

1. Introduce provider-neutral interfaces and contract tests while preserving
   WorkOS behavior, including existing billing and membership events.
2. Add local stable user IDs with explicit `(issuer, subject)` bindings and local
   membership persistence. Preserve historical ownership references through an
   explicit migration; never auto-link identities by email or invent WorkOS IDs.
3. Add generic OIDC browser login with PKCE and a common application authorization
   context for API and sync. Keep ID tokens distinct from API credentials. Test
   configured issuer/audience, expiry, state/nonce, key rotation and session
   revocation, including an already-connected stream.
4. Add separately scoped worker enrollment and credential revocation. Initially
   disable unsupported invitations, organization creation, domains and hosted
   billing in self-hosted mode at both UI and API boundaries; preprovision the
   pilot organization and owner. No live WorkOS client may be required in this mode.
5. Verify Keycloak plus a second standards-compliant OIDC test provider, negative
   cross-user/cross-organization cases, artifact/stream authorization, and a cold
   startup with WorkOS network access blocked. Preserve WorkOS regression tests.

This is a conditional contribution outline, not authorization to implement a
broader identity fork or a claim of upstream agreement. No upstream message or
issue has been sent. Deployment and reasoning compatibility remain blocked.
