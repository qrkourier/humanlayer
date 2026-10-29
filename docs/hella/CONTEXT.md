# HumanLayer self-hosted identity

Language for the proposed self-hosted HumanLayer contribution. This glossary is
scoped to this proposal, not the enclosing forgyro project.

## Language

**Operator**: The person responsible for a HumanLayer installation and its identity-provider configuration.
_Avoid_: Customer, reseller

**User**: A person with a persistent HumanLayer identity, independent of their login provider.
_Avoid_: WorkOS user, account

**Login identity**: A provider's identity for a user. A user may deliberately bind more than one login identity.
_Avoid_: Email identity

**Organization**: A collaboration and access-isolation space within an installation.
_Avoid_: Subscription, billing account

**Membership**: A user's active, suspended, or removed relationship with an organization and its assigned role.
_Avoid_: Seat

**Worker**: An enrolled agent host authorized to execute assigned work within an organization.
_Avoid_: Human session

**Application session**: A revocable period of authenticated access to HumanLayer.
_Avoid_: Agent session

**Agent session**: An execution conversation associated with a task, independent of whether any browser remains open.
_Avoid_: Login session
