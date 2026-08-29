---
name: assetize-ui
description: Decompose an approved FiveM visual design into separate, validated runtime image assets before Svelte implementation. Use for custom raster shells, masks, textures, illustrations, and state overlays; skip for ordinary HTML/CSS layout or existing SVG/icon-library work.
---

# Assetize UI

## Read
- `AGENTS.md`
- `.ai/rules/design.md`
- `.ai/rules/ui.md`
- `.ai/rules/assets.md`
- approved `docs/ui-spec/<screen>.md`
- approved reference image and only the affected existing assets/components
- `docs/schemas/ui-asset-manifest.schema.json`

## Preconditions
- Wireframe and visual design statuses are `Approved`.
- The exact selected reference is recorded in the screen specification.
- Layout measurements and dynamic content regions are resolved.

If these conditions are missing, return to `design-ui`. Do not generate artwork while layout or visual direction is still changing.

## Outcome
Produce individually usable image parts and an `asset-manifest.json` that lets implementation assemble live HTML/Svelte data over stable artwork without recreating complex geometry in CSS.

## Workflow
1. Inventory every visible element and classify it as HTML/CSS or dynamic data, existing SVG/icon-library asset, supplied artwork, new raster artwork, alpha mask for a dynamic fill, or state overlay.
2. Measure each artwork slot on the approved 1440px-high design canvas. Record its natural width, height, layer order, alignment anchor, safe content region, and scaling behavior.
3. Keep raw references and generated masters under `docs/ui-spec/assets/<screen>/`. Put optimized runtime files under `resource/ui/public/assets/<screen>/`.
4. Create `docs/ui-spec/assets/<screen>/asset-manifest.json` using the canonical schema. Every runtime asset needs a unique ID, source, consumer, dimensions, transparency declaration, behavior, and byte budget.
5. Reuse supplied artwork when it already matches the approved design. Use an available image-generation capability only for genuinely custom raster artwork; never assume that a particular external tool, account, credential, or model is installed.
6. Generate or edit one distinct asset per request. Ask for genuine transparency when required. Preserve the approved geometry, palette, density, crop, and focal point. Do not bake dynamic or localized text, live numbers, player data, or interaction state into base artwork.
7. Inspect every result. Remove transparent padding, halos, unintended backgrounds, mock data, watermarks, and unrelated HUD parts. Preserve a non-destructive source/master copy.
8. Optimize runtime dimensions and encoding. Prefer SVG for simple scalable icons, WebP where it preserves the required quality, and PNG for masks or sharp alpha artwork that does not survive conversion cleanly.
9. Run `npm run check:ui-assets`. Fix missing paths, duplicate IDs, size/dimension mismatches, invalid alpha declarations, source/runtime mixing, and budget failures.
10. Update the screen specification with the manifest path, asset approval status, prompts or provenance summaries, remaining implementation notes, and approval owner/date.

## Composition contract
- Decorative shell art sits behind semantic HTML/Svelte content.
- Dynamic fills may use a separate alpha mask or an approved clipped active-state asset.
- Static scale markings may be artwork only when they are not localized or data-dependent.
- Interactive controls remain semantic elements with focus, hover, active, disabled, and error states in code.
- Source/reference images are never loaded by the runtime.
- Runtime code references only assets declared in the manifest.

## Stop conditions
- If image generation or the required source artwork is unavailable, return an actionable asset brief and stop before `implement-ui` for the affected custom artwork.
- If generated output cannot preserve the approved geometry or clean transparency after a focused retry, request a supplied editable asset instead of approximating it with div/CSS art.
- Asset approval does not authorize layout or product changes.

## Output
- Screen specification path and asset status.
- Manifest path.
- Source/master and runtime asset paths.
- Asset dimensions, behaviors, consumers, and budgets.
- Generation/edit provenance summaries.
- Validation results and unresolved asset blockers.
