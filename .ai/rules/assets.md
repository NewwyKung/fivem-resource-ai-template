# Asset Rules

- Keep raw/source assets separate from optimized runtime assets.
- For UI artwork, keep approved references and generated masters under `docs/ui-spec/assets/<screen>/`; keep runtime files under `resource/ui/public/assets/<screen>/`.
- Declare assetized UI parts in `docs/ui-spec/assets/<screen>/asset-manifest.json` and validate them with `npm run check:ui-assets`.
- Optimize images to target dimensions and prefer WebP where supported.
- Use SVG for simple icons and scalable vectors.
- Lazy-load noncritical NUI media; preload only critical UI assets.
- Avoid oversized textures, audio, and streamed models.
- Request assets/models before use and release them afterward.
- Track asset ownership; use reference counts when multiple consumers can acquire the same runtime asset.
- Give asynchronous loads a deadline and cancellation/cleanup path for resource stop and owner disposal.
- Maintain explicit memory/performance budgets for large asset sets.
- Bound asset caches, queues, and metrics by count and lifetime.
- Use sprite sheets/atlases only when they materially reduce overhead.
- Never put dynamic text into raster UI artwork.
- Keep complex decorative shells, fill masks, static scales, and state overlays as separate layers when live data or interaction must remain code-driven.
- Record the consuming component, natural dimensions, transparency, behavior, provenance, and byte budget for every manifested runtime asset.
- Validate names, formats, dimensions, transparency, and generated output paths.
- Do not force garbage collection to compensate for leaked assets or unbounded caches.
