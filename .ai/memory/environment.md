# Server Environment Profile

Status: Partially configured
Last updated: 2026-09-11

This file stores confirmed server-wide choices so AI agents do not ask the same integration questions for every feature. Update only from user-confirmed information. Never store secrets.

## Core

| Setting | Selected value | Status | Notes |
|---|---|---|---|
| Framework | unset | unresolved | `standalone`, `esx`, `qbcore`, `qbox`, or custom |
| Database driver | oxmysql | confirmed | Confirmed for [mcp-dev-bridge](../../examples/capabilities/mcp-dev-bridge/README.md)'s read-only `inspect_db_schema`/`/mcp/db/schema` (SHOW TABLES/DESCRIBE only). No runtime CRUD adapter has been created for it — do not assume one exists for other features without confirming scope. |
| Shared library | unset | unresolved | e.g. `ox_lib`, custom, or none |

## Capabilities

| Capability | Resource/provider | Runtime | Profile | Status |
|---|---|---|---|---|
| Inventory | unset | client/server | — | unresolved |
| Notify | unset | client/server | — | unresolved |
| Logger | unset | client/server | — | unresolved |
| Progress | unset | client | — | unresolved |
| Target/Interaction | unset | client | — | unresolved |
| Appearance | unset | client/server | — | unresolved |
| Other | unset | — | — | unresolved |

## Rules

- Ask only about unresolved capabilities required by the current resource or feature.
- Do not ask about an integration already confirmed here unless new behavior exceeds its registered profile.
- Provider API documentation belongs in `.ai/integrations/providers/<provider>.md`.
- Selecting a provider here does not create a runtime adapter automatically.
- Create runtime adapters only for capabilities used by the approved feature.
- Remove generated adapters, configs, dependencies, and manifest entries that are not used by the completed resource.
