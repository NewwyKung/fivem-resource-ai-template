# <Screen Name>

## Status
- Wireframe status: Draft | Review | Approved
- Visual design status: Not started | Draft | Review | Approved
- Asset status: Not required | Not started | Draft | Review | Approved
- Implementation status: Not started | In progress | Implemented | Reviewed

## Objective
What player problem does this screen solve? What must the player accomplish quickly?

## Context
- Trigger/open condition:
- Gameplay situation:
- Primary users:
- Base viewport:
- Maximum screen coverage:

## Information hierarchy
1. Primary information/action
2. Secondary information/action
3. Supporting information
4. Destructive or exceptional action

## Wireframe
Provide a low-fidelity region diagram or structured box layout. Use labels and dimensions, not final colors, artwork, shadows, or decorative effects.

### Layout regions
Describe dimensions, alignment, scroll ownership, safe areas, overlay behavior, and responsive behavior.

### Primary flow
Describe the shortest path from opening the screen to completing the main task and closing safely.

### Wireframe state coverage
- Initial/loading
- Default
- Empty/sparse/dense
- Selected/active
- Disabled
- Error/recovery
- Modal/context menu
- Closed/resource stopped

### Wireframe review evidence
- Representative content:
- Worst-case Thai content:
- Open product decisions:
- Approval owner/date:

## Design direction
Complete only after the wireframe is Approved.

- Aesthetic direction:
- Memorable visual idea:
- Master design system:
- Screen-specific overrides and rationale:
- Typography:
- Palette roles:
- Shape, border, and depth:
- Iconography/artwork:

## Component tree
List existing components first. Mark genuinely new components.

## Data and contracts
- Data displayed:
- NUI messages received:
- NUI callbacks sent:
- Authority and validation owner:
- Feature/event registry links:

## Interaction
- Mouse:
- Keyboard:
- Escape/close:
- Focus behavior:
- Drag/drop if applicable:
- Error recovery:

## Motion
Entry, exit, feedback, duration, easing, interrupt behavior, and reduced-motion behavior.

## Assets
Complete this section after visual approval when custom artwork is required. Skip `assetize-ui` and set `Asset status: Not required` when existing HTML/CSS/SVG assets are sufficient.

- Approved reference:
- Asset manifest: `docs/ui-spec/assets/<screen>/asset-manifest.json`
- Source/master directory: `docs/ui-spec/assets/<screen>/`
- Runtime directory: `resource/ui/public/assets/<screen>/`
- Approval owner/date:

### Asset decomposition

| Element | Kind | Source size | Runtime size | Alpha | Behavior | Layer | Consumer | Dynamic content kept in code |
|---|---|---:|---:|---|---|---:|---|---|
| Example shell | shell | 1560×410 | 780×205 | yes | static | 0 | `Example.svelte` | yes |
| Example fill mask | mask | 560×104 | 280×52 | yes | mask | 1 | `Example.svelte` | yes |

### Dynamic safe zones
Describe the measured rectangles reserved for live values, localized labels, icons, focus rings, and interaction states. Use 1440px-source coordinates and identify the owning component.

### Asset provenance
Record whether each asset is supplied, generated, derived from an approved reference, or authored locally. For generated assets, keep a concise prompt summary and the selected output path in the manifest. Do not store secrets, credentials, or provider-specific request payloads.

No dynamic or localized text, live numbers, player data, or interactive state may be baked into base raster artwork.

## Localization
Keys, fallback behavior, long Thai text, numbers, currency, dates, and plural requirements.

## Acceptance criteria
Write measurable visual, interaction, accessibility, performance, browser-mode, and FiveM-mode checks.

## Final review evidence
- Reference image/spec:
- Browser screenshots:
- FiveM screenshots:
- Remaining deviations:
