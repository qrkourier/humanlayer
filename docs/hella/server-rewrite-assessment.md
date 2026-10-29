# Server scope and selective replacement assessment

2026-10-27. Research against upstream
`0dbe4f58f0df9e337783defb2928e8ab18b88725`, with downstream proxy-secret removal
at `6bb474f3`. User clarified compatibility means the existing HumanLayer UI, CLI
and daemon, not only a session-side SDK. This document proposes a direction; no
replacement server or protocol-conformance test has been implemented.

## Answer

We understand the major responsibilities well enough to choose an architecture.
We do not yet have exhaustive protocol or state-transition coverage to promise a
faster full rewrite. A smaller self-hosted server assembled from upstream modules
is plausible and worth proving. The likely shortcut is replacing hosted startup,
identity and commercial composition while retaining the application semantics
that already support the UI and daemon.

The preceding WorkOS audit was an identity audit, not a complete server audit.
Passing existing tests for the small proxy change did not prove readiness to
replace the server. There is no measured performance comparison or credible
calendar estimate for a rewrite yet.

## What the server owns

| Responsibility | Observable behavior | Proposed treatment |
| --- | --- | --- |
| Identity and access | User/session identity, organization membership, roles, invitations, PATs, worker enrollment, resource ACLs | Replace WorkOS-dependent implementation with local management and OIDC; preserve access invariants |
| Task/session coordination | Launch, continue/resume, queued messages, interrupts, approvals, task/workspace association, worker assignment | Reuse domain logic, contracts, transactions and regression tests |
| Durable state | Tasks, sessions, events, comments, artifacts, snapshots, ownership and settings | Retain PostgreSQL schema/migrations initially; make identity changes additive |
| Client synchronization | Electric shapes, row visibility, transaction acknowledgement, reconnect behavior | Retain Electric and authorizing proxy initially |
| Streaming and collaboration | Session/diff streams, replay/offsets and collaborative response editing | Retain Durable Streams/Yjs machinery and its authorization |
| Files and code review | Upload/download, artifact versions, diffs, comments, access requests and sharing | Reuse; keep private object storage behind application authorization |
| Worker supervision | Heartbeats, stale hosts, lost execution detection, restart/recovery and retention | Retain reconciliation logic; replace cloud-job packaging with local scheduled jobs |
| Auxiliary model calls | Task intent classification and title generation in launch paths | Explicitly configure through the allowed gateway or supply deterministic/disabled alternatives; audit other call sites |
| Optional integrations | Forge/ticket/chat/email imports, notifications and webhooks | Separate optional modules; absence must not prevent core startup |
| Commercial operations | Subscriptions, paid seats, billing webhooks, plan enforcement and upgrade UI | Exclude from self-hosted composition |

Agents execute on workers. The server coordinates and persists their work; it also
has auxiliary model operations of its own. Retaining the worker harness avoids
recreating tools, repository handling and session execution merely to replace the
server. It does not resolve the separate LiteLLM `auto` / thinking-disabled gate.

## Why endpoint parity is insufficient

The typed RPC contracts are valuable, but client compatibility also includes:

- API and daemon route prefixes, payloads, headers and structured error behavior.
- Auth bootstrap, refresh and organization switching expected by clients.
- PostgreSQL row schemas consumed directly by shared client code.
- Transaction IDs used to wait for synchronized writes.
- Electric shape URLs, visibility filters, subscription/reconnect semantics.
- Event ordering, duplicate-event handling, queue draining and interruption rules.
- Durable stream and collaborative document protocols.
- Auth failure semantics that can cause a daemon to shut down.

For example, task launch atomically claims a task and records its initial session
and transaction ID; event ingestion explicitly handles duplicate IDs; session
updates drain queued messages differently on completion versus interruption.
Recreating happy-path REST responses would miss those behaviors.

The UI has query-backed collection alternatives, but the inspected daemon session
collection directly consumes an Electric shape. Therefore removing Electric or
switching to SQLite/SSE is not an established shortcut for the selected client set.
A small server-only endpoint shim is not full UI/daemon compatibility.

## Compatibility includes a focused client patch

The browser UI imports WorkOS AuthKit and the CLI device-login implementation
calls WorkOS endpoints directly. A completely WorkOS-free server cannot, by merely
changing its URL, turn those unchanged login flows into generic OIDC. Retain the
existing applications, but add provider-neutral login/session interfaces in them.
Do not emulate WorkOS endpoints or invent external organization records to avoid
that focused patch.

The current session SDK packages are private workspace packages, version 0.0.0;
compatibility should be pinned to an upstream commit and verified by consumer
fixtures, not advertised as compatibility with an unspecified stable SDK version.
The legacy Python/TypeScript human-in-the-loop SDK is a different product generation.
See the companion SDK findings for concrete protocols and consumers.

## Compare the approaches

| Approach | Potential advantage | Main cost | Judgment |
| --- | --- | --- | --- |
| Incremental changes throughout hosted startup | Maximum reuse and familiar deployment path | Optional features remain entangled in imports/runtime construction | Viable, but do not spend the project patching one missing-key crash at a time |
| New self-hosted composition over reused core | Clear dependency budget, no commercial startup, upstream domain behavior retained | Refactor global runtime and provider-specific interfaces | Preferred hypothesis to validate |
| Fresh server implementing current client protocols | Full freedom in language and process architecture | Recreate synchronization, authorization and state-machine edge cases | Not justified as the faster path by current evidence |
| Small SDK-only server or new UI | Much smaller surface can be selected | Does not meet the clarified existing UI/CLI/daemon requirement | Out of scope |

"More efficient" needs separate measurements: development effort, operational
complexity, CPU/memory, and long-term upstream maintenance. Removing billing and
mandatory integrations should reduce setup/dependency burden; no source reading
proves a lower memory footprint or faster task execution. Rewriting in another
language does not remove client protocol obligations.

## Recommended implementation shape

Create a self-hosted composition entrypoint in the same monorepo. Reuse contracts,
DB schema, persistence and lifecycle logic, sync/stream implementations, worker
harnesses, UI and regression suites. Supply local identity/directory/credential
implementations, capability policy and optional integration wiring. Initially
retain separate worker and private data-store processes for isolation; "smaller"
does not require a monolithic process or access to the host filesystem.

This requires an actual seam refactor, not only a new `main.ts`:
`orpc/effect-base.ts` imports the global hosted `appRuntime` and binds Effect
implementers to it. `app.ts` eagerly constructs commercial and integration clients;
`app-runtime.ts` unconditionally builds their layers. Parameterize composition and
bind route factories to the selected runtime while preserving current hosted
exports as wrappers. Avoid a WorkOS-shaped local SDK imitation and unchecked
casts to satisfy the old context types.

Keep the upstream source as the source of reusable modules, rather than copying
large trees into a second codebase. New local behavior gets neutral interfaces;
hosted adapters remain available. Contribute those interfaces and startup
improvements separately from Hella deployment documents when upstream accepts the
direction. The repository identifies Apache-2.0 and vendored MIT code in LICENSE
and NOTICE; preserve those files and per-module provenance during reuse.

## Decisive proof before a broader rewrite

Build one end-to-end branch using the existing UI, CLI and daemon:

1. Cold start with no WorkOS, Stripe, Resend, Slack, Jira or Linear keys and blocked
   outbound access to those services. Required self-hosted storage and OIDC remain
   available. Authenticate through Keycloak and establish local membership.
2. Enroll a worker using the revised login interface; create and launch a task.
   Confirm actual API, sync and stream traffic uses only the local endpoints.
3. Close desktop; view the same task on phone; send follow-up, interrupt/resume,
   review an artifact/diff and inspect approval state.
4. Replay requests/events, reconnect clients, restart server/worker and verify
   no duplicate launch, missing history, silent re-execution or queue corruption.
5. Revoke membership/worker credentials; confirm denial across RPC, shapes,
   streams, artifacts and execution requests.

Alongside it, build a consumer-contract inventory from UI/CLI/daemon call sites and
wire captures in this isolated fixture. Run preserved business tests against both
compositions; add differential tests for error codes, transaction acknowledgements,
ACL filtering and replay. Record reachable imports and external configuration;
measure idle/run resources against the original candidate using the same workload.

Success means the new composition can reuse the hard parts without pulling in
commercial runtime. If it still requires a near-total route/state-machine rewrite,
return to provider-neutral changes in the existing composition. This experiment
answers whether selective replacement is actually faster, without prematurely
committing to a replacement product.

## Evidence and remaining unknowns

All source links below pin the inspected upstream revision:
- [README.md](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/README.md)
- [apps/riptide-api/src/app.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/app.ts)
- [apps/riptide-api/src/effects/app-runtime.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/effects/app-runtime.ts)
- [apps/riptide-api/src/orpc/base.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/orpc/base.ts)
- [apps/riptide-api/src/orpc/effect-base.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/orpc/effect-base.ts)
- [apps/riptide-api/src/orpc/index.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/orpc/index.ts)
- [contracts/riptide-api-contract/src/contract-router.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/contracts/riptide-api-contract/src/contract-router.ts)
- [apps/riptide-api/src/effects/services/task-launch/task-launch.persistence.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/effects/services/task-launch/task-launch.persistence.ts)
- [apps/riptide-api/src/effects/services/task-launch/task-launch.live.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/effects/services/task-launch/task-launch.live.ts)
- [apps/riptide-api/src/orpc/daemon/sessions/events/create.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/orpc/daemon/sessions/events/create.ts)
- [apps/riptide-api/src/orpc/daemon/sessions/update.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-api/src/orpc/daemon/sessions/update.ts)
- [apps/riptide-ui/src/components/providers/SyncProvider.tsx](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-ui/src/components/providers/SyncProvider.tsx)
- [apps/riptide-daemon/src/collections/electric/sessions.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-daemon/src/collections/electric/sessions.ts)
- [apps/riptide-daemon/src/orpc/client.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-daemon/src/orpc/client.ts)
- [apps/riptide-electric-proxy/src/routes/response-editor-collaboration.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-electric-proxy/src/routes/response-editor-collaboration.ts)
- [apps/stale-daemon-sweeper/index.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/stale-daemon-sweeper/index.ts)
- [apps/stale-daemon-sweeper/lost-sessions.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/stale-daemon-sweeper/lost-sessions.ts)
- [apps/database-maintenance-function/index.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/database-maintenance-function/index.ts)
- [apps/riptide-ui/src/integrations/workos/AuthProvider.tsx](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-ui/src/integrations/workos/AuthProvider.tsx)
- [apps/cli/src/auth/workos-device-auth.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/cli/src/auth/workos-device-auth.ts)
- [packages/session-sdk-base/package.json](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/package.json)
- [LICENSE](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/LICENSE)
- [NOTICE](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/NOTICE)

Remaining unknowns: exhaustive endpoint/shape coverage by supported client versions;
all optional-feature import edges; complete identity migration and revocation
behavior; public artifact and desktop shell edge cases; all server-side model
calls; production performance and recovery under load. Existing unit/service tests
are useful evidence, not a replacement for this full compatibility experiment.
