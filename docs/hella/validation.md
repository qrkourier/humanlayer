# Initial proxy decoupling validation

2026-10-27, upstream base `0dbe4f58f0df9e337783defb2928e8ab18b88725`.
Local toolchain: Bun 1.3.14 (repository pin), Node 24.10.0 (CI major 24).

- Frozen dependency installation: passed. Removing the proxy's older WorkOS SDK
  prunes its unused transitive lockfile entries; no dependency upgrades included.
- Proxy package typecheck through the root Turbo script: passed.
- Repository `bun --bun run quality`: passed.
- Root service-test runner: API 2,144; proxy 312; billing 15; test-fixtures 5;
  stale-daemon-sweeper 39 tests passed (2,515 total).
- Final daemon database portion: 11 tests passed on a separate rerun using the
  same root service setup/wait/cleanup helpers (2,526 total across these suites).
- `git diff --check`: passed.

The first service attempt lacked Node and failed the runtime canary; it is not
counted as successful validation. The Node rerun passed all five service packages,
then failed daemon test collection because logs targeted the read-only home.
After redirecting logs, one Fold test still attempted to extract a plugin into
home. The final daemon rerun used existing source plugin paths and passed all 11.
No production application config or test assertion was changed to suppress those
failures. Full-monorepo typecheck/unit/build checks remain unrun; this is not a
claim that all upstream CI jobs passed.

Tests used Compose project `humanlayer_hella_oidc`, ports 57432/15030/20642/19000,
and explicitly named project volumes. The runner stopped its containers and
network afterward; it retained isolated test volumes. Existing containers and
services were not stopped. No Hella cluster workload was deployed.

Reproduction uses the repository's root `test:local:services` script with a private
Compose project and matching `DEVSTACK_TEST_*` / `HUMANLAYER_TEST_*` URLs, not a
package test command that bypasses service setup. In restricted shells also set:

- `TURBO_CACHE_DIR` to a writable worktree cache.
- `BUN_TMPDIR`, `BUN_INSTALL_CACHE_DIR`, `npm_config_devdir`, and `BUILDX_CONFIG`
  to task-specific writable directories as needed.
- `LOG_BASE` and `RIPTIDE_STATE_DIR` to task-specific writable test directories.
- `RIPTIDE_RPI_PLUGIN_PATH` and `RIPTIDE_HUMANLAYER_PLUGIN_PATH` to this worktree's
  corresponding source plugin directories for the daemon database tests.

The changed configuration tests cover operation with only a client ID, missing
and empty client IDs, concurrent scoped config isolation and path-segment encoding.
Existing proxy verification/ACL tests pass. No generic OIDC login, local membership,
provider migration, Hella model routing or mobile acceptance is claimed.
