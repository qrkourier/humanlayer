---
status: proposed
---
# HumanLayer owns collaboration access; OIDC supplies login identity

For the self-hosted contribution, HumanLayer will own users, organizations,
memberships, invitations, application sessions and worker credentials. OIDC will
supply verified login identities, allowing providers without organization,
invitation or API-key management interfaces to work without vendor-specific
administration credentials. This requires local lifecycle and revocation logic,
but avoids reimplementing the WorkOS SDK and preserves collaboration features
without subscription, resale or billing dependencies.

Existing hosted WorkOS behavior remains a separate implementation during upstream
migration. Provider-specific claims cannot silently grant local administrator
privileges; local suspension overrides provisioned access.
