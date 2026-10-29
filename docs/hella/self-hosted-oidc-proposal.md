# Complete self-hosted identity and access for HumanLayer

Status: proposed contribution design, 2026-10-27. Initial preparatory sync-proxy implementation is in progress; no upstream
submission yet. This supersedes the earlier suggestion to stop at a restricted
one-owner adapter: the user has expanded planning to a complete self-hosted
feature set. The Hella deployment gate remains closed until implementation and
acceptance evidence exist.

## Decision

Build a self-hosted edition with generic OIDC login and application-owned access
management. Organizations represent collaboration and isolation, not paying
customers. Preserve useful collaboration and administration features; omit the
commercial control plane. WorkOS remains an available hosted implementation,
not a required dependency of the self-hosted installation.

A provider needs discovery, authorization-code login and standard identity claims.
It does not need a management API, organization claims, group claims, device flow,
SCIM, or a WorkOS-compatible interface. Keycloak is the first integration fixture,
not the architecture. This proposal's standards profile is narrower than every
optional feature in the OIDC family; it does not claim OIDC certification.

## Feature decisions

| Capability | Self-hosted decision |
| --- | --- |
| Browser, desktop, mobile login | OIDC authorization code with PKCE; server-managed application session |
| SSO, MFA, password recovery | Delegate to configured identity provider; document optional authentication-assurance policy |
| Organizations and switching | Local organizations and memberships; switching checks current membership and changes application context |
| Teams, tasks, comments, plans, reviews, artifacts | Retain existing collaboration and resource ACL semantics |
| Roles and permissions | Local, explicit role-to-permission policy; migrate existing role semantics rather than infer access from names |
| Member administration | List, invite, change role, suspend, reactivate, remove, transfer ownership; protect last administrator |
| Invitations and access requests | Local records and workflows; authenticated acceptance; optional SMTP and operator-copyable links |
| User profiles and attribution | Local profile, updated from verified login claims; retain author identities after removal |
| CLI and remote workers | Browser-approved enrollment with local scoped, expiring and revocable credentials |
| Personal API tokens | Locally issued, scoped, expiring, revocable; intersect with current user permissions |
| Security audit and usage visibility | Retain security events and operational/model usage; no billable-seat requirement |
| Feature availability | Explicit self-hosted capabilities and operator policy; no subscription checks |
| Resource/concurrency limits | Operator configuration and enforcement, independent of paid plans |
| Domain verification / WorkOS admin portal | Replace with operator-managed issuer/client configuration and optional explicit admission rules; no automatic email-domain membership |
| Subscriptions, trials, checkout, invoicing, seats, upgrades | Exclude from self-hosted routes, jobs, UI and startup dependency graph |
| Stripe and commercial WorkOS webhooks | Not registered in self-hosted mode; no fake customers, plans or webhook successes |
| GitHub, Slack, Linear, Jira integrations | Optional and disabled when unconfigured; independent of core login and collaboration |
| OIDC group mapping / SCIM | Optional later provisioning integrations; local administration supplies the complete baseline |

Public artifact sharing, where supported, remains an explicit resource policy.
Self-hosted default is private; turning on a public-link feature does not expose
private metadata or make every authenticated user an organization member.

## Interfaces and data ownership

Use three deep modules rather than cloning the WorkOS SDK interface:

1. **Identity** completes login, binds a verified external identity, manages
   application sessions and resolves a human principal. OIDC protocol libraries,
   discovery, JWKS rotation and provider tokens stay inside its implementation.
2. **Access** authorizes a principal's operation on an organization/resource and
   performs membership/invitation lifecycle operations with their invariants.
   Role checks, local suspension, invitation redemption, audit records and
   revocation are centralized here. Callers do not combine WorkOS-shaped claims.
3. **Credentials** enrolls workers and issues/authenticates/revokes API and worker
   credentials. It produces distinct typed principals, not interchangeable human
   tokens. Its implementation checks Access before granting authority.

A normal request resolves a principal, then asks Access to authorize an action on
an explicit resource. Principal kinds are human-session, personal-token and worker;
worker context includes its host and organization. Never accept an organization
ID from the client as proof of membership. UI availability is advisory; the
server enforces capabilities and authorization independently.

Suggested persistence additions (final schema names subject to repository review):
users; login_identities with unique `(issuer, subject)`; memberships with unique
`(organization, user)`; invitations; application_sessions; personal_tokens;
worker_enrollments; worker_credentials; audit_events; revocation/outbox records.
Keep existing organization UUIDs. Make `workos_organization_id` optional only for
local organizations, with a hosted invariant requiring a valid external mapping.

The existing `user_identities` table is for GitHub attribution tied to WorkOS user
IDs; do not repurpose it for login or treat GitHub CLI identity as login proof.
Preserve opaque existing user IDs as local IDs where possible, backfilling users
and explicit issuer/subject mappings. Audit every ownership/ACL/history reference
before choosing any ID rewrite. New users get independent local IDs. Email is a
mutable profile field, never the login key or an automatic account-linking key.

## Login and application sessions

Use one configured issuer initially, with exact HTTPS callbacks and server-side
client configuration. Support confidential code-flow clients with PKCE S256.
Use a maintained OIDC library and validate configured issuer, signature algorithm,
keys, audience/authorized party, expiry, nonce, state and code-verifier binding.
Do not derive the trusted issuer from the incoming token. Discovery endpoints
come from operator configuration, never arbitrary user input.

The backend exchanges the authorization code and stores any refresh token
server-side encrypted. Browser clients use Secure, HttpOnly, SameSite cookies
and CSRF protection on mutations. Prefer one origin for UI/API/sync; never require
OIDC tokens in browser storage or stream query strings. The backend resolves a
local session; arbitrary provider access tokens are not accepted as HumanLayer
API credentials, and ID tokens are never used as API bearer tokens.

The native desktop client uses the system browser and a one-time, short-lived
application login exchange bound to the initiating client. Avoid sending reusable
credentials through custom-scheme URLs. Headless enrollment displays an approval
URL and confirmation code; the logged-in browser confirms the exact worker and
organization. This does not require provider device-grant support.

Initial design defaults: application sessions have 12-hour absolute and 1-hour
idle lifetimes; privileged administration requires authentication within 15
minutes. These are operator-tunable security defaults, not commercial tiers.
The application must not silently renew beyond absolute lifetime. Local logout
revokes its application session immediately; provider logout is additionally used
when supported. Closing a browser never cancels an agent session.

OIDC alone does not guarantee immediate notice of upstream user suspension.
Support validated back-channel logout where offered, and document that IdP-only
disablement otherwise takes effect on reauthentication or notification, bounded
by session lifetime. Local suspension takes effect immediately. Do not advertise
universal real-time deprovisioning; optional SCIM/events can improve it later.

## Admission, membership and revocation

Start closed: the operator bootstraps an organization and administrator by exact
issuer/subject through a server-local administrative command. Do not grant admin
to the first person who logs in. The command also provides audited lockout recovery
without a publicly exposed fallback password or bypass login endpoint.

Invitations are expiring, single-use, random bearer secrets stored hashed. An
invite targets an organization, role and verified email or exact login identity.
Email-targeted redemption requires a verified claim from the configured trusted
issuer, explicit invitation possession, and an authenticated user. Providers
without verified email use identity-targeted invitations or administrator approval.
Being logged in or matching an email domain never grants membership by itself.

For invites, identity linking, and reactivation: explicit local suspension wins.
Do not recreate removed membership automatically at next login. Any later group
provisioning must record provenance, reconcile removals, and respect local denial;
no group string becomes an administrator role without explicit operator mapping.

Protect the last active administrator transactionally, including concurrent
removals and role changes. Keep historical authorship and ACL references after
membership removal. Organization removal is an explicit administrative operation
with state/export handling, not a side effect of billing or identity-provider events.

Revocation updates authorization state and durable invalidation events in the same
transaction. API requests consult current membership/credential state. Long-lived
sync/stream connections receive invalidation and recheck at most every 30 seconds;
protected deliveries stop if their authorization cannot be refreshed. Events
accelerate revocation; they are not the only check. Audit and cancellation latency
are measurable acceptance requirements.

User suspension/removal revokes their sessions and PATs for the affected scope,
revokes user-sponsored workers in that organization, and prevents new commands.
Cancel affected running executions through the worker protocol and preserve
partial output. An unreachable worker cannot be promised instantly stopped:
report cancellation pending, reject reconnect results/commands pending authorization,
and retain evidence rather than silently replaying actions. Global user suspension
applies to all memberships; organization suspension is scoped to that organization.

## Worker and API credentials

Reuse the existing daemon enrollment concept, but add strict token purpose,
issuer, audience, expiry, credential ID and revocation checks. The inspected daemon
signer currently emits a token without expiry; it cannot be the new default.
Human, launch, personal and worker credentials must be rejected in each other's
contexts. An ID token cannot enroll a worker by being pasted into an API field.

Enrollment approval is single-use and expires in five minutes. Worker access
tokens expire in five minutes; rotating renewal credentials are server-tracked,
revocable and limited to 30 days by default, with replay detection. Renewal
requires an active host and sponsor membership. Persist identity securely across
restart; re-enrollment must be explicit after revocation. No provider refresh
credentials are copied to workers.

PATs are high-entropy opaque values with a lookup prefix and stored secret hash,
displayed once, default expiry 30 days and maximum configurable by the operator.
Scope them to one organization and allowed actions. Effective access is token
scope intersected with current user/resource permissions; role elevation does not
expand a pre-existing token's scope. Workers cannot administer users or mint new
credentials merely because their sponsor is an administrator.

## Sync, artifacts and operational events

API, Electric proxy, artifact delivery and durable streams must consume the same
Access decisions. Enforce organization/resource filtering server-side; private
Electric and storage endpoints cannot be reached around the authorizing proxy.
Cache keys include principal, organization and authorization version. Role changes
must invalidate both server authorization caches and client-visible collections.

For private artifacts, proxy bytes through an authorized endpoint where immediate
revocation matters. If signed object URLs are offered, cap their validity at 60
seconds and document that already-issued URLs remain usable until expiry. No
system can revoke bytes already downloaded; test future access, not erasure.

Retain local events for membership changed, invitation redeemed, credential
revoked, worker disabled, task access changed and session invalidated. Use a
transactional outbox, idempotent consumers and observable retry. These events
serve access consistency, notifications and audit, independent of paid-service
events. Audit principal, operation, resource and outcome without tokens or private
reasoning. Membership changes must succeed without Stripe or WorkOS.

## Commercial decoupling

Introduce explicit deployment composition (`self_hosted` / existing hosted mode)
with validated configuration and separate dependency construction. In self-hosted
mode do not construct WorkOS/Stripe clients, register billing handlers, run seat
synchronizers or initialize subscription caches. A missing key must not crash a
module import. Move optional integration construction out of import-time code.

Replace paid-entitlement checks with a self-hosted capability policy for features
that exist in the shipped code. This policy enables product capability, not user
permission: it must never replace Access or grant every user admin. Preserve
operator quotas, rate limits, concurrency limits and abuse controls. Billing UI
and paid-plan upsells disappear; unavailable integration UI explains configuration.

Keep hosted commercial behavior intact behind its existing implementation for a
reviewable upstream contribution. WorkOS membership webhooks can still feed hosted
behavior; self-hosted local mutations publish their own access events. Neither
mode needs simulated paid subscriptions. Removing hosted code entirely is not a
prerequisite for the self-hosted contribution.

## Contribution sequence and release gates

| Slice | Deliverable | Required evidence |
| --- | --- | --- |
| 1. Independent startup | Deployment composition, capability policy, lazy optional integrations; self-hosted DB can initialize without WorkOS/Stripe | Cold start with keys absent and those hosts blocked; no billing routes/jobs; protected routes still deny anonymous users |
| 2. Local identity and access | Additive schema, bootstrap/recovery CLI, membership and policy module, hosted adapter | Migration fixtures preserve ownership; last-admin race tests; hosted regression tests |
| 3. Browser-to-task path | OIDC login, session handling, organization context, API/sync/artifact authorization | Login and same-task desktop/mobile access with Keycloak and a second independent OIDC implementation; cross-org denial |
| 4. Complete administration | Local invites, access requests, roles, suspension/removal, org switching, profiles and audit | No SMTP required for copy-link flow; invitation replay/mismatch rejection; revoked access ends on active streams within bound |
| 5. Credentials and workers | PAT lifecycle, native/headless enrollment, worker token renewal/revocation | Token-purpose isolation, replay/expiry tests, restart persistence, revoked sponsor stops authorization and requests cancellation |
| 6. Recovery and packaging | Migration/export tools, pinned release images, backup/restore and provider setup docs | Isolated restore of waiting task and identity; revoked credentials stay revoked; no commercial endpoint traffic |

Each slice preserves hosted behavior and has a separate reviewable change set.
Self-hosted mode remains explicitly experimental until all six gates pass; the
first successful browser login does not make the feature set complete. Hella may
exercise a one-owner pilot, but the contribution must test multiple users and
organizations and ship their administration flows.

For existing installations: take an application-consistent backup, stage additive
schema changes, backfill known identity references, validate ownership/ACL counts,
then switch mode in a maintenance window. Import external membership only through
an explicit reviewed mapping; quarantine unmapped identities without guessing by
email. Invalidate old credentials and require deliberate re-enrollment at cutover.
Once local-only records exist, old hosted binaries are not a safe automatic
rollback: restore a consistent pre-cutover backup or use a tested forward repair.
A restore must also reconcile subsequent revocations or invalidate all credentials
to avoid resurrecting revoked access.

## Source anchors and verification scope

Based on upstream commit `0dbe4f58f0df9e337783defb2928e8ab18b88725`:

- `apps/riptide-api/src/lib/workos-service.ts`: broad vendor-shaped interface.
- `apps/riptide-api/src/orpc/api/auth/`: membership, invitation, organization,
  token and daemon workflows that need local implementations.
- `apps/riptide-api/src/orpc/api/auth/admin/users-update-role.ts`: membership
  mutation directly invokes seat synchronization today.
- `apps/riptide-api/src/orpc/base.ts`: paid-feature dependency in request policy.
- `apps/riptide-api/src/auth/context.ts`: human and daemon credential resolution.
- `apps/riptide-api/src/auth/daemon-token-core.ts`: token-purpose/expiry work.
- `packages/db/src/tables/user-identities.ts`: GitHub attribution, not OIDC login.
- `packages/db/src/tables/organizations.ts`: required WorkOS organization field.
- `apps/riptide-api/src/webhooks/workos.ts`: mixed billing and access-request events.

These are source observations, not results of running the proposed design.
Before coding, refresh the upstream revision and contribution guidance. No upstream
acceptance, issue, PR, runtime test or deployed adapter is claimed here.

Protocol references: [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html),
[OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html), and
[OIDC back-channel logout](https://openid.net/specs/openid-connect-backchannel-1_0.html).
Timeouts and product policies above are design choices, not protocol requirements.

The Hella-specific `auto` model and thinking-disabled execution requirement remains
a separate unresolved compatibility gate; this identity design does not waive it.
