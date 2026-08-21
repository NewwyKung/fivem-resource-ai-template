# FiveM Loading Screen UI Rebuild Prompt

You are a Senior Frontend Engineer, Svelte Developer, and UI Motion Designer.

I will provide a visual reference image for a FiveM loading screen. Your task is to recreate the provided design as accurately as possible using **Svelte, HTML, CSS, SVG, Canvas, and JavaScript**. The reference image is the **visual source of truth**. Do not redesign it into your own interpretation.

## Tech Stack

Use Svelte, JavaScript, HTML, CSS, SVG where appropriate, and Canvas for particle/weather effects where appropriate. Do not use React, Vue, Tailwind CSS, Bootstrap, jQuery, or heavy animation libraries unless absolutely necessary. Prefer native Svelte + CSS animations + Canvas. Keep the project lightweight and optimized for FiveM CEF.

## Design Direction

- Dark cinematic tactical shooter / gunfight theme
- Cyberpunk / dystopian atmosphere
- Minimal premium game loading screen
- Black / charcoal base
- Purple / violet / magenta accent lighting
- Atmospheric rather than information-heavy
- Environment/background remains the visual focus
- Loading UI stays subtle and compact

The UI should feel like a professional AAA shooter loading screen, not a gaming dashboard, website landing page, admin panel, or RGB-heavy HUD.

## Reference Image

Use `docs/reference/loading-screen-reference.png` as the primary visual reference. Analyze it before implementing anything: foreground/background objects, depth layers, lighting, UI position, HUD decoration, progress dimensions, spacing, dark overlays, glow intensity, empty areas, and composition balance. Reproduce the composition deliberately rather than loosely approximating it.

## Target Resolution

Design primarily for 1920x1080 (16:9), while scaling gracefully to other FiveM resolutions. The root application should use `width: 100vw; height: 100vh; overflow: hidden;`. Prefer %, vw, vh, `clamp()`, and CSS custom properties over excessive fixed-pixel positioning.

## Svelte Architecture

Do not put the entire implementation into one giant `App.svelte`. Separate responsibilities into components such as:

```text
src/
├── App.svelte
├── components/
│   ├── LoadingIndicator.svelte
│   ├── HudOverlay.svelte
│   ├── AmbientEffects.svelte
│   └── BackgroundScene.svelte
├── effects/
│   ├── RainCanvas.svelte
│   ├── ParticleCanvas.svelte
│   ├── FogLayer.svelte
│   └── LightningLayer.svelte
├── lib/
│   └── loading.js
└── app.css
```

Modify this structure if the existing repository architecture suggests a cleaner integration. Do not over-engineer it.

## Visual Layer Architecture

Build the screen in layers:

Background Image → Background Color Grading → Atmospheric Fog → Distant Effects → Rain → Foreground Particles / Embers → HUD Decorations → Loading UI → Film Grain / Final Screen Treatment.

Use absolute positioning and clear z-index management.

## Background Treatment

Use the supplied reference/background asset full-screen with cover behavior and centered positioning. Do not distort it. Add a subtle dark vignette, restrained purple color grading, and a bottom gradient so the loading indicator remains readable while the environment remains visible.

## Loading UI

Position the loading UI at the **bottom center**, approximately 4%-7% from the bottom. It must NOT be in the center of the screen. Keep it small and understated.

Display only:

```text
67%
──────── progress ────────
◇  L O A D I N G  ◇
```

No server name, logo, player count, Discord, website, social media, music player, tips, news, buttons, navigation, cards, or stats.

Use white/light gray for the percentage with clean geometric typography and only subtle glow. The progress track should be thin, with a purple-violet-magenta progress line approximately 260-340px wide depending on viewport. Add a tiny glowing endpoint with restrained bloom. Render the LOADING label with wide letter spacing, small lavender/purple text, and reduced opacity. A subtle breathing animation is acceptable; blinking is not.

## Loading State and FiveM Integration

Expose a clean `setLoadingProgress(value)` API clamped to 0-100. Updating progress must update both percentage and bar width smoothly. Keep browser mock loading separate from production FiveM integration.

Keep FiveM message handling isolated so visual components are not tightly coupled to FiveM APIs. The UI must remain previewable in a normal browser.

## Ambient Effects

Add subtle cinematic effects that create depth without clutter:

- sparse diagonal rain, preferably Canvas
- sparse floating embers/particles in violet, magenta, and rare warm orange
- slow fog/smoke using lightweight gradients or textures
- occasional low-opacity distant lightning at randomized intervals
- optional slow searchlight beams
- extremely subtle film grain
- rare micro-glitches limited to HUD decorations

Do not use constant full-screen glitches, heavy VHS effects, rainbow lighting, excessive blur, aggressive motion, bouncing, spinning, or rapid blinking.

## HUD Decorations

Create restrained tactical HUD elements around screen edges using HTML/CSS/SVG: thin corner brackets, tiny crosses, dots, calibration ticks, short lines, targeting marks, and subtle scan segments. Concentrate them near top-left, top-right, side edges, and bottom corners. Keep the central 60%-70% mostly clean and use low opacity so decorations never compete with the loading indicator.

## Depth System

Use three atmospheric zones:

- Far: fog, distant light flicker, searchlights, lightning
- Mid: rain and subtle haze
- Near: embers, particles, occasional debris

Movement may become slightly faster toward the camera while remaining restrained. Optional mouse parallax may affect atmospheric layers by only a few pixels. Never move the loading UI.

## Performance

Target smooth 60 FPS in FiveM CEF. Avoid hundreds of DOM particles, excessive animated box shadows, multiple full-screen blur filters, and unnecessary reactive updates. Use Canvas for high-count effects, account for `window.devicePixelRatio`, and cap DPR if useful. Respect `prefers-reduced-motion` by reducing or disabling atmospheric motion while keeping the loading indicator functional.

## No Logo

There must be **NO center logo**. Do not place any emblem, mascot, server logo, FiveM logo, or brand icon in the center. The center should remain environmental imagery.

## Visual Balance

Balance **minimal** with **not empty**. Achieve richness through depth, weather, lighting, subtle HUD details, particles, and background composition—not information panels. If unsure whether to add another UI element, do not add it; improve lighting, spacing, depth, contrast, edge decoration, or motion instead.

## Responsive Validation

Verify at least 1920x1080, 2560x1440, 3440x1440, 1600x900, and 1366x768. Do not stretch the background on ultrawide displays. Keep the loading indicator viewport-centered and use safe-area spacing around screen edges.

## Accessibility

Mark decorative elements `aria-hidden="true"` and give the loading indicator proper progress semantics with `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`.

## Rendering Validation — Mandatory

After the first implementation, **run the application and render the page**. Do not stop after writing code. Capture a screenshot and compare it visually against `docs/reference/loading-screen-reference.png`.

Compare loading bar position/width, percentage size and spacing, label spacing, bottom offset, background brightness, vignette strength, purple intensity, HUD density, empty areas, atmospheric depth, and overall composition.

Repeat:

**Implement → Run → Screenshot → Compare → Identify differences → Modify → Screenshot again**

Continue until the result is convincingly close to the reference. Do not assume the first implementation is good enough.

## Existing Project Integration

Before changing files, inspect the existing repository structure, package configuration, Svelte version, current loading implementation, FiveM manifest/configuration, and existing event/message handling. Preserve working FiveM behavior and integrate the new UI into the existing project rather than replacing unrelated functionality. Do not remove or rewrite unrelated Lua/FiveM logic.

## Final Deliverables

Provide a complete working implementation, not pseudo-code. Actually create/modify the project files, run the project, inspect the rendered result, fix visual differences, and report:

1. Files created or modified
2. How loading state works
3. How major visual effects work
4. Where the reference/background asset is used
5. Where FiveM loading progress connects
6. Performance considerations
7. Validation/build results

Most importantly: **Do not merely build something inspired by the reference. Reproduce the reference design as closely as possible while keeping the implementation clean, performant, and practical for the existing FiveM Svelte project.**
