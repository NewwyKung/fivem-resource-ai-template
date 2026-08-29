---
name: fivem-ui-workflow
description: Route FiveM NUI and Svelte UI work through the repository's approved wireframe, visual-design, implementation, motion, browser-validation, review, and refinement phases. Use for new screens, redesigns, UI code, screenshots, animation, gaming aesthetics, responsive 1080p/4K behavior, v0, frontend-design, UI/UX Pro Max, Emil Kowalski motion guidance, Impeccable-style polish, or UI performance/resmon requests.
---

# FiveM UI Workflow

Use this skill as a router. Load one primary project skill for the current phase, not the entire UI stack.

## Phase router

| Task state | Read exactly this primary skill |
|---|---|
| New screen, changed layout, or unresolved information hierarchy | `.ai/skills/wireframe-ui/SKILL.md` |
| Approved wireframe needing visual direction | `.ai/skills/design-ui/SKILL.md` |
| Approved visual design needing custom raster shells, masks, textures, or state artwork | `.ai/skills/assetize-ui/SKILL.md` |
| Approved specification with all required assets ready, or no custom artwork required | `.ai/skills/implement-ui/SKILL.md` |
| Existing implementation or screenshots needing audit | `.ai/skills/review-ui/SKILL.md` |
| Approved findings needing targeted fixes | `.ai/skills/refine-ui/SKILL.md` |
| NUI transport-only change without redesign | `.ai/skills/create-nui/SKILL.md` |

Read `AGENTS.md`, `.ai/CONTEXT_BUDGET.md`, the selected primary skill, its required rules, one affected UI specification, and affected source only. Do not preload adjacent phase skills.

## Optional lenses

- Read `.ai/matrices/ui-tool-routing.json` only when the user names an external design tool or the selected project skill cannot resolve a design question.
- Read `references/motion.md` only when motion is an acceptance criterion, animation is explicitly requested, or review evidence shows a motion defect.
- Treat external outputs as references. Normalize approved decisions into `docs/ui-spec/` and `docs/design/design-system.md`; never make an external tool a second source of truth.
- Never combine multiple broad design packs by default. Their overlapping aesthetic rules add tokens and conflicting defaults.

## Evidence boundary

Follow the selected phase skill's checks. Use browser automation or Computer Use only when available; otherwise report the manual click path. Never claim click, animation, 4K, CEF, or `resmon 0.00 ms` evidence without running the corresponding tool/runtime. Keep external style and stack suggestions subordinate to the approved FiveM specification.

Image generation is optional capability, not a repository dependency. When it is unavailable, `assetize-ui` must stop at an actionable asset brief or use approved supplied artwork; it must not replace missing artwork with approximate CSS drawings.
