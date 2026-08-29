# AI Design-First Pipeline

Use this pipeline for new screens and major UI redesigns.

1. **Brief** — define purpose, users, FiveM context, data, constraints, and success criteria.
2. **Wireframe** — create a low-fidelity layout covering hierarchy, regions, flow, density, states, scroll ownership, and responsive behavior.
3. **Wireframe review** — test representative and worst-case content; set `Wireframe status: Approved` before visual styling.
4. **Design direction** — choose one intentional aesthetic direction and record the memorable visual idea without changing the approved structure.
5. **Design system** — reuse or update `docs/design/design-system.md`; define screen overrides only when necessary.
6. **Visual specification** — complete `docs/ui-spec/<screen>.md` and set `Visual design status: Approved`.
7. **Asset decomposition when required** — split complex approved artwork into shells, masks, static scales, textures, and state overlays while keeping live data and interaction in code.
8. **Asset approval** — validate the asset manifest, dimensions, transparency, budgets, provenance, and dynamic safe zones.
9. **Implementation** — assemble approved assets and live UI behavior using existing Svelte components and tokens.
10. **Browser validation** — verify representative states outside FiveM.
11. **Visual review** — capture screenshots and audit hierarchy, spacing, typography, interactions, accessibility, performance, and game-background readability.
12. **Refinement** — fix discrepancies by impact without redesigning approved decisions.
13. **FiveM validation** — verify bridge messages, focus, Escape, resource stop, and production build behavior.
14. **Release review** — ensure generated output, tests, registries, and documentation are current.

## Why wireframe first
Wireframes make structural changes inexpensive. They prevent color, artwork, motion, and component polish from hiding weak hierarchy or forcing expensive layout rewrites during implementation.

## Context-loading rule
Do not load every UI document for every task.

Native Codex routing starts at `.agents/skills/fivem-ui-workflow/SKILL.md`, then selects exactly one phase skill below. External design tools remain optional and on-demand.

- New screen/layout: `wireframe-ui` skill + `design.md`
- Approved wireframe needing visual direction: `design-ui` skill
- Approved visual design needing custom artwork: `assetize-ui` skill + `assets.md`
- Approved visual design with assets ready: `implement-ui` skill + `ui.md`
- Quality audit: `review-ui` skill + review checklist
- Targeted visual correction: `refine-ui` skill

## Handoff contract
Each phase hands the next phase a concrete artifact:

`brief → approved wireframe → approved visual specification → approved asset manifest when required → implementation → review findings → verified result`

Do not replace a missing approval or handoff with assumptions when the decision materially affects architecture, usability, or product behavior.
