---
task: self-hosted-oidc
type: design-discussion
repo: qrkourier/humanlayer
branch: hella/self-hosted-oidc
sha: 0dbe4f58f0df9e337783defb2928e8ab18b88725
---

### Summary of change request

Make HumanLayer a complete self-hosted collaboration server using standard OIDC
identity providers, without requiring WorkOS or a paid-service control plane.
Contribute small compatible changes upstream where maintainers want them.

### Current State

Operators cannot configure only their identity provider and run the whole product.
Login, membership, invitations and credentials depend on WorkOS; membership changes
also trigger commercial seat synchronization. Public-key verification in the sync
proxy unnecessarily requires a management API secret and callback URL.

### Desired End State

An operator can bootstrap an organization, configure an OIDC provider, invite
colleagues, manage permissions, enroll workers and continue the same task from
multiple devices. Suspension revokes access across requests, streams and
credentials. No WorkOS or Stripe credential is required for self-hosted startup.

### What we're not doing

Recreating a billing platform, bypassing authorization, automatically deploying
Hella infrastructure, or treating the first signed-in user as administrator.
Generic OIDC does not imply universal SCIM/group-management support.

### Proposed End State Architecture

OIDC supplies verified identity to an Identity module; HumanLayer owns Access and
Credentials modules. Hosted WorkOS remains a separate implementation. Local
membership and revocation events maintain security without billing subscribers.
See [the complete proposal](self-hosted-oidc-proposal.md) for contracts, lifecycles,
migrations and acceptance gates.

### Design Questions

Maintainer input is not yet obtained. Before upstream submission, settle:

- Whether the proposed deployment composition and application-owned membership
  direction match the upstream self-hosting roadmap.
- Which slices maintainers want to accept and where they prefer the module seams.
- Which existing hosted configurations and historical data migrations need
  compatibility fixtures beyond the inspected repository tests.

These are upstream coordination questions, not requests to the owner to repeat
already-decided Hella requirements. Work on reversible downstream slices can
proceed. This draft does not claim all upstream contribution checkboxes are met.

### Resolved Design Questions

#### Who owns organizations and permissions?

HumanLayer does. The owner selected a complete self-hosted feature set independent
of WorkOS, retaining collaboration and excluding resale/commercial behavior.
Using provider group or organization APIs as the sole authority was rejected
because those APIs are not generic OIDC and would require privileged vendor
credentials. Local access invariants are independent of login provider claims.

#### Which commercial features belong in the self-hosted runtime?

None of subscriptions, checkout, trial limits, paid seats or upgrade paths are
required. Security audit, revocation and operational quotas remain. Simulating a
paid plan was rejected because it preserves unnecessary external dependencies
and can conflate feature availability with permission.

#### Do we replace hosted WorkOS all at once?

No. Retain it while introducing local implementations through explicit interfaces.
A large fork was rejected because it is expensive to review and track upstream.
The first proposed code slice removes only unnecessary privileged configuration
from public signing-key verification in the sync proxy.

#### How do existing users retain authorship and permissions?

Use local stable IDs and explicit issuer/subject mappings. Preserve existing
opaque IDs where feasible and validate all ownership references during migration.
Automatic email-based linking was rejected because email can change or be reused.

#### Is a successful browser login enough for release?

No. API, sync, artifacts, administration and worker credentials must pass the same
access tests. Existing sessions must lose access after revocation. Keycloak and
an independent OIDC implementation must pass; provider-specific APIs are optional.

### Patterns to follow

The sync proxy already separates JWKS configuration, fetching and JWT validation
with Effect layers. Its configuration layer can supply the same public endpoint
without a management client, keeping verification and resource checks intact.
Use scoped ConfigProvider fixtures and the existing root service-test runner.

New database schemas use the repository's Drizzle generators, never handwritten
SQL migrations. Hosted regression tests and the negative access matrix accompany
any change to authentication or membership behavior.
