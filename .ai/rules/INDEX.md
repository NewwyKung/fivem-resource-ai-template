# Rule Index

Load only rules relevant to the current task.

| Domain | Rule |
|---|---|
| FiveM boundaries, manifests, lifecycle | `fivem.md` |
| Lua style, performance, modules | `lua.md` |
| Events, trust boundaries, exploits | `security.md` |
| Frameworks, database, libraries, external resources | `integrations.md` |
| Svelte NUI and browser/FiveM bridge | `ui.md` |
| Visual direction, hierarchy, interaction craft | `design.md` |
| Faults, cleanup, degraded operation | `fault-handling.md` |
| Exports, events, callbacks, versions | `api.md` |
| High-risk contract shapes, schemas, error codes | `contracts.md` |
| Tests and release validation | `testing.md` |
| Images, audio, models, streaming | `assets.md` |
| Lua and NUI translations | `localization.md` |
| Cross-cutting implementation/review gate | `engineering-quality.md` |
| Supplied guides and volatile external claims | `source-trust.md` |
| Personal/team coding style preferences (optional; may not exist yet) | `dev-style.md` |

Do not load all rule files by default.

For implementation or review, load `engineering-quality.md` plus only the domain rules selected by the task characteristics in `.ai/matrices/quality-gates.json`.

For UI work:
- Visual design or review: load `design.md`.
- Svelte/NUI implementation: load `ui.md`.
- Tasks spanning both may load both files.

For integration work:
- Registering docs: load `integrations.md` and the provider template only.
- Activating a provider: additionally load only the selected provider profile and affected runtime source.
