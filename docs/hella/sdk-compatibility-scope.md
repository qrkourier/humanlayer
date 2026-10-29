# HumanLayer SDK compatibility scope

Source audit: upstream `0dbe4f58f0df9e337783defb2928e8ab18b88725`, inspected through
Hella worktree `e9916ac7`. No implementation or runtime compatibility test performed.

## Facts: “the SDK” is not a single target

The current source contains six **private, version 0.0.0** session-side workspace
packages: base, auth, sessions, artifacts, diffs and tools. They support plugins
running inside coding agents. Pi, OpenCode and Claude Code plugin packages consume
all six; riptide-daemon consumes the artifacts/diffs/sessions subset. These are
reusable source modules, but their manifests do not establish a stable public SDK
release/compatibility promise. Sources: [packages/session-sdk-base/package.json](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/package.json), [packages/session-sdk-auth/package.json](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-auth/package.json), [apps/riptide-pi-extension/package.json](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-pi-extension/package.json), [apps/riptide-daemon/package.json](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-daemon/package.json).

The older checkout's commit `e8d0c6f1f3ce5648872aa9f5d3b501f0260fdd5f` contains
`humanlayer/` Python and `humanlayer-ts/` (package `humanlayer`, 0.5.4-rc1), aimed at
human-in-the-loop tool approvals. Those directories are absent from the current
source tree. Compatibility with that old SDK would be a separate product/protocol
objective, not proof of compatibility with the current coding-agent workspace.
Sources: [legacy README](https://github.com/humanlayer/humanlayer/blob/e8d0c6f1f3ce5648872aa9f5d3b501f0260fdd5f/README.md),
[legacy TS manifest](https://github.com/humanlayer/humanlayer/blob/e8d0c6f1f3ce5648872aa9f5d3b501f0260fdd5f/humanlayer-ts/package.json).

## Facts: current compatibility has several protocols

| Surface | What a compatible server must preserve |
| --- | --- |
| Endpoint selection | API, sync and app origins can be overridden with `HUMANLAYER_API_URL`, `HUMANLAYER_SYNC_URL`, `HUMANLAYER_APP_URL`; channels remain prod/beta/dev/local |
| RPC | POST JSON to `/rpc/api/v1/{path}` with Bearer token and `/rpc/daemon/v1/{path}` with `x-daemon-authorization`; response schemas and error status/code/data semantics matter |
| Authentication | PAT mode bypasses interactive WorkOS login and mints daemon credentials through `auth/daemon/token/create`. Device mode uses WorkOS form endpoints, organization selection, refresh, and `sub`, `org_id`, `internal_org_id` claims |
| Session lifecycle | `automation/run/prepare` creates/ensures the task/session association; session updates, conversation-event writes, repository reports, host heartbeats and command reports drive mirrors |
| Web follow-up / cancellation | Clients consume Electric shapes, not a bespoke WebSocket command endpoint. Session transitions to `resuming` and `interrupt_requested` trigger host actions |
| Approvals | Clients follow `/v1/daemon/approvals` and react to pending → approved/denied changes |
| Artifacts | Text upserts use daemon RPC; binary upload requests return a signed upload URL, then the client performs HTTP PUT with the specified content type |
| Diffs | Direct HEAD/PUT/POST requests to `/v2/streams/organizations/{orgId}/tasks/{taskId}/{stream}` carry daemon auth and durable-stream state messages |
| Agent-facing tools | Comment/diff-comment read/reply/update and `agents/research` are daemon-plane contracts |

Sources: [packages/session-sdk-base/src/channels.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/src/channels.ts), [packages/session-sdk-base/src/rpc.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/src/rpc.ts), [packages/session-sdk-auth/src/client.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-auth/src/client.ts), [packages/session-sdk-auth/src/login.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-auth/src/login.ts), [packages/session-sdk-sessions/src/inbox.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-sessions/src/inbox.ts), [packages/session-sdk-sessions/src/commands.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-sessions/src/commands.ts), [packages/session-sdk-artifacts/src/sync.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-artifacts/src/sync.ts), [packages/session-sdk-diffs/src/sync.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-diffs/src/sync.ts), [packages/session-sdk-tools/src/tools.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-tools/src/tools.ts).

The route types derive from the shared `RiptideApiContract` and
`RiptideDaemonApiContract`. A replacement should reuse these contracts, not infer
payloads from request examples. Type compatibility alone is insufficient: the
client interprets 401/403 as credential or binding failures, 402 as stop-all,
transient failures as retries, and some 500s as limited retries. Events have
stable IDs for deduplication; server replies include transaction IDs. Sources:
[packages/session-sdk-base/src/routes.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/src/routes.ts), [packages/session-sdk-base/src/rpc.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/src/rpc.ts), [packages/session-sdk-base/src/outbox.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-base/src/outbox.ts), [packages/session-sdk-sessions/src/events.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-sessions/src/events.ts), [contracts/riptide-api-contract/src/daemon/events/create.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/contracts/riptide-api-contract/src/daemon/events/create.ts).

The Electric reader retains row state across partial updates, tracks handle,
offset and cursor headers, interprets up-to-date/must-refetch controls, and handles
409 shape rotation. Replacing Electric with “just JSON polling” while leaving
clients unchanged would require reproducing these semantics. Source:
[packages/session-sdk-sessions/src/shape.ts](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/packages/session-sdk-sessions/src/shape.ts).

## Required target clarified: existing UI, CLI and daemon

The owner clarified that compatibility means the existing HumanLayer UI, CLI and
daemon. The smaller plugin-only target below is a comparison, not the selected
requirement.

**Unchanged released binaries plus WorkOS-free login are not a supported path in
the inspected source.** The CLI directly calls hard-coded WorkOS device endpoints
in `apps/cli/src/auth/workos-device-auth.ts`; changing the server URL cannot
redirect those requests. UI login is built around `AuthKitProvider` / `useAuth` in
`apps/riptide-ui/src/integrations/workos/AuthProvider.tsx`, with WorkOS organization
context consumed by application code. WorkOS emulation or network interception
would add risk and should not be the compatibility strategy.

**Preserving application behavior and main RPC/sync contracts while rebuilding
the existing clients with new authentication adapters is plausible.** Keep the
UI, CLI command surface and daemon execution machinery; replace login/session/
organization-context adapters and credential handling. This is source-compatible
continuity, not a claim of zero changes to existing binaries.

Sources: [CLI device auth](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/cli/src/auth/workos-device-auth.ts),
[CLI refresh/login lifecycle](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/cli/src/auth/index.ts),
[UI auth provider](https://github.com/humanlayer/humanlayer/blob/0dbe4f58f0df9e337783defb2928e8ab18b88725/apps/riptide-ui/src/integrations/workos/AuthProvider.tsx).

## Inference: a smaller compatible server is plausible, with a bounded target

The smallest credible target is **pinned current session plugins using local PATs**,
plus a deliberately small task/review UI. That avoids WorkOS's device-login wire
protocol while retaining real application authorization and separate daemon tokens.
A custom server may issue its own PATs and daemon tokens with the fields the client
reads, without treating arbitrary externally supplied token claims as authority.
An OIDC login UI can mint/manage those local credentials. This does not by itself
make the plugins' existing interactive `/humanlayer login` flow OIDC-compatible.

A full compatibility target for unmodified UI and daemon is substantially larger:
the UI queries many shared database-shaped collections; the daemon runs additional
workspace setup, agent state, event, execution, provider-login and recovery
protocols. Supporting the session plugin subset is not proof the full daemon can
launch Codex tasks from the mobile UI.

For the clarified UI/CLI/daemon requirement, recommendation: reuse shared contracts/schemas, event/idempotency logic, artifact
logic, stream conventions and tests. Retain Postgres + Electric + durable streams
initially rather than rewriting sync semantics alongside identity. Replace the
composition root and identity/membership/credential implementation, remove the
commercial dependency graph, then shrink remaining services only when measured.
This is a selective server extraction, not a clean-room implementation.

## Unknowns and tests before estimating a rewrite

- Exact pinned UI/CLI/daemon versions and whether any independently distributed
  third-party plugin versions must remain compatible as well.
- Complete call inventory per selected agent plugin, including optional tools,
  approvals, hydration, resume and repository-report branches.
- End-to-end ordering/idempotency/reconnect behavior across API, Electric and
  streams under crashes and duplicate requests.
- Whether upstream offers or plans a stable public server protocol version.
- Actual effort saved by rewriting versus introducing a different composition
  root; neither source size nor endpoint count measures this reliably.

A compatibility spike should pin one plugin/daemon version and demonstrate:
local credential enrollment; prepare task; publish tool/result events; reconnect
without duplicate events; browser follow-up and cancellation; approval reply;
artifact upload/download; diff stream replay; revocation across open shapes.
Use the existing test suites and add protocol traces, then decide expansion.
