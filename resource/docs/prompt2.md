# FiveM Loading Screen UI Rebuild Prompt — 2.5D Parallax V2

You are a Senior Frontend Engineer, Svelte Developer, UI Motion Designer, and interactive graphics engineer.

Build the FiveM loading screen as a lightweight cinematic 2.5D scene using Svelte, CSS 3D transforms, Canvas effects, and mouse-driven parallax.

The visual reference is a stormy purple industrial rooftop overlooking a city at night. The implementation must preserve that composition. Do not redesign the scene.

## Tech Stack

Use Svelte, JavaScript, HTML, CSS, CSS 3D transforms, SVG where useful, and Canvas for rain/particles. Do not use React, Vue, Tailwind, Bootstrap, jQuery, or heavy animation libraries. Prefer native Svelte + CSS + Canvas for FiveM CEF performance.

## Critical V2 Asset Strategy

Do NOT expect generative AI to independently recreate many pixel-perfect city layers. Use only FOUR coherent image planes derived from the SAME master scene:

```text
static/assets/scene/
  00-master-reference.webp   # development/debug only
  01-sky.webp                # opaque reconstructed sky
  02-city.png                # complete distant/mid city silhouette on transparency
  03-rooftop.png             # complete rooftop/environment plane on transparency
  04-foreground.png          # nearest tactical props on transparency
```

Optional runtime assets:

```text
  05-fog.png
  depth-map.png
```

The visible pixels of extracted objects should remain as close to the master as possible. AI/inpainting should primarily reconstruct areas hidden behind nearer objects, not redesign visible objects.

### Exclusive ownership rule

Every physical object belongs to ONE image layer only. Never duplicate a crane, antenna, tower, fence, crate, rifle, helmet, barrier, or building across two independently moving image layers.

If an object is visually attached to the city skyline, keep it in City. If it is part of the playable rooftop structure, keep it in Rooftop. If it is a very near framing/tactical prop, keep it in Foreground.

Do not bake atmospheric fog into multiple moving image layers. Prefer runtime fog between planes.

## Layer Ownership for This Scene

### 01 Sky
Only storm clouds, sky illumination, distant lightning glow and atmospheric sky. No buildings, cranes, towers, fences, rooftop, props, fog strip copied from city, or UI. Reconstruct sky behind removed structures.

### 02 City
Treat the distant and mid-distance urban skyline as ONE coherent city plane. Include skyscrapers, distant industrial buildings, the tall radio/communication towers that visually belong to the skyline, construction crane(s) that belong to the distant city, antennas, distant rooftops and city lights. Do not split the city into separate far-city and mid-city generated images. No main playable rooftop, foreground concrete barriers, foreground fence, weapon crate, rifle or helmet.

### 03 Rooftop
Include the continuous wet rooftop floor and structural environment: rooftop perspective plane, puddles/reflections, permanent rooftop walls/barriers, railings/fences that belong to the rooftop, industrial rooftop equipment, cables/pipes, vents and structural debris. Reconstruct/inpaint the floor and structures hidden behind Foreground props. This must remain visually complete when Foreground moves by roughly ±14px.

### 04 Foreground
Only the nearest tactical/framing props: left weapon crates/ammo boxes, leaning rifle, nearby bullet casings/debris, right helmet, closest rubble and any truly near framing object that should move most strongly. Preserve exact master position, scale, perspective and lighting. Transparent background. Do not include city or general rooftop floor.

## Scene Order

Recommended runtime composition:

```text
Sky
City
Far Fog / atmospheric Canvas or CSS layer
Rooftop
Near Fog
Far Rain Canvas
Foreground
Near Rain Canvas
Particles / Embers
HUD Overlay
Loading UI
Film Grain
```

HUD and Loading UI remain screen-space and MUST NOT inherit world parallax.

## Virtual Camera

Normalize pointer coordinates to -1..+1. Smooth target/current camera state with requestAnimationFrame instead of binding directly to raw pointer events.

Recommended maximum rotation:

```text
rotateY: -1.5deg .. +1.5deg
rotateX: -1.0deg .. +1.0deg
```

Recommended translation strengths:

```text
Sky:        ±2px
City:       ±4px
Rooftop:    ±7px
Foreground: ±14px
Near rain:  apparent ±20px
```

These are starting values, not hard requirements. Tune visually. Near layers move more than far layers. Keep motion cinematic and restrained; it must not resemble a tilted 3D card.

Use perspective around 1200px as a starting point. If translateZ is used, compensate scale so apparent neutral-camera composition remains aligned.

## Overscan

Every moving world layer must have enough overscan that camera movement never reveals empty edges. Target roughly 105–115% coverage, tuned per layer. Do not blindly scale all transparent PNGs with object-fit: cover if that changes their master alignment; preserve a common master coordinate system/canvas and apply consistent transforms.

## Smoothing

Use target/current interpolation in a single rAF loop where practical:

```text
current += (target - current) * smoothing
```

Start around 0.05–0.12. No bounce. On pointer leave, smoothly return to center. With no pointer, keep center or use extremely subtle idle drift.

## Atmospheric Depth

Use runtime atmosphere to sell depth rather than generating more city image planes.

- Far rain: small, sparse, slow, low opacity.
- Near rain: larger, faster, sparse.
- Far fog: between City and Rooftop.
- Near fog: between Rooftop and Foreground where visually useful.
- Particles/embers: sparse near-camera particles.
- Lightning: occasional low-opacity illumination focused on background/world, not strong UI flashes.

Avoid duplicating fog/haze strips inside City and Rooftop assets where they will separate during parallax.

## Loading UI

Bottom-center, fixed screen-space. Display only percentage, a thin progress bar, and `◇ L O A D I N G ◇`. No logo, server name, Discord, social links, tips, music player, cards, news, player count, or extra information.

Expose a clean loading API such as `setLoadingProgress(value)`. Keep FiveM message integration independent from camera/rendering logic. Preserve existing Lua/resource behavior unless UI integration requires a minimal change.

## Suggested Svelte Structure

```text
src/
  App.svelte
  components/
    Scene3D.svelte
    SceneLayer.svelte
    LoadingIndicator.svelte
    HudOverlay.svelte
    AmbientEffects.svelte
  effects/
    RainCanvas.svelte
    ParticleCanvas.svelte
    FogLayer.svelte
    LightningLayer.svelte
  lib/
    parallax.js
    loading.js
  app.css
```

Do not over-engineer. Inspect the existing repository first and adapt to its current structure.

## Mandatory Development Consistency Mode

Implement a development/debug mode specifically for validating generated layers.

It must support:

- Parallax ON/OFF
- Master reference overlay ON/OFF
- Master overlay opacity control (default around 50%)
- Individual visibility toggles for Sky, City, Rooftop and Foreground
- Neutral-camera/reset button or equivalent debug state
- Optional exaggerated parallax test mode for revealing holes/seams

At neutral camera with parallax OFF, composite all four layers and overlay `00-master-reference.webp` at 50%. Misalignment should appear as double edges/ghosting.

Use this to detect shifted skyline geometry, duplicated cranes/towers, wrong object scale, alpha halos, rooftop perspective mismatch, and missing/inpainted regions.

Do not ship an intrusive debug panel in production; gate it behind a development flag/query parameter or remove it from the production UI.

## Hole / Seam Stress Test

After neutral alignment passes, test all four pointer corners and temporarily exaggerate translation enough to expose hidden areas. Verify that removing/moving Foreground reveals valid reconstructed rooftop beneath it, moving Rooftop reveals coherent environment/background, no transparent holes appear, no duplicated physical objects separate into ghosts, and no black matte/background is present in transparent assets.

## Transparent Asset Validation

For `02-city.png`, `03-rooftop.png`, and `04-foreground.png`, confirm that empty pixels have real alpha transparency. Do not assume a black image viewer background means transparency; inspect alpha or render the asset over a bright checkerboard/debug color. Reject assets with baked black matte, dark fringe, white fringe, or obvious haloing.

## Performance

Target 60 FPS in FiveM CEF. Avoid hundreds of DOM particles, many animated full-screen blur filters, excessive box-shadow animation and unnecessary Svelte reactive updates every frame. Use Canvas for rain/particles and cap DPR around `Math.min(devicePixelRatio, 2)` if needed.

Respect `prefers-reduced-motion`: disable/reduce camera rotation, parallax, rain, particles, fog animation and glitches while keeping loading progress functional.

## Responsive Validation

Validate at 1920x1080, 2560x1440, 3440x1440, 1600x900 and 1366x768. Preserve composition and do not stretch imagery on ultrawide displays.

## Final Validation Workflow

1. Run the Svelte app.
2. Disable parallax.
3. Reset camera to neutral.
4. Composite Sky + City + Rooftop + Foreground.
5. Overlay Master at 50%.
6. Fix visible double edges, duplicated objects, halos and scale/position mismatch.
7. Disable Master overlay.
8. Enable parallax.
9. Test all pointer corners.
10. Run exaggerated motion stress test.
11. Repair any revealed holes/inpainting seams.
12. Return to restrained production motion values.
13. Confirm Loading UI remains fixed.
14. Inspect FiveM CEF performance.

## Acceptance Criteria

The neutral composite must closely reconstruct the master reference. No physical object may appear in multiple independently moving planes. Transparent layers must contain genuine alpha. Foreground movement must reveal plausible completed rooftop behind it. City and rooftop must not produce obvious seams. Mouse movement must create perceptible depth without gimmicky tilt. Rain/fog/particles should reinforce depth. Loading UI stays stable and readable. Performance remains smooth.

Most importantly: use a small number of coherent, master-aligned planes. Four clean layers are better than seven inconsistent AI-generated layers.