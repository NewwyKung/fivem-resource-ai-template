# Template Sync + Dev Style Compilation

## Status
Delivered

## Last updated
2026-09-11

## Source
User request (Thai): (1) how to push template updates into resources
already cloned from it; (2) a way for developers to set coding
standards/style, specifically: a file a dev can write freeform text into,
which an AI then converts into an AI/token-efficient format.

## Problem and outcome
- Problem 1: this template is copy-once (`scripts/init-template.mjs` runs
  once); a resource cloned from it has no path to pull later template
  improvements (bug fixes, new capability packs) without manual copying.
- Problem 2: no mechanism existed for a developer's own style/workflow
  preferences to become something an AI agent actually follows, in the
  repo's existing token-efficient `.ai/rules/*.md` format.
- Outcome: `npm run sync:template` pulls template-owned plumbing paths from
  a pinned ref without touching resource-specific state or game code;
  `.ai/skills/compile-dev-style/SKILL.md` turns freeform notes under
  `.ai/memory/dev-style/` into `.ai/rules/dev-style.md`.

## Recommended solution
### Template sync
`git checkout <remote>/<ref> -- <paths>` against a fixed default path list
of template-owned directories/files only (`.ai/rules`, `.ai/skills`,
`.ai/examples`, `.ai/integrations`, `.ai/matrices`, `AGENTS.md`, `CLAUDE.md`,
`examples`, `scripts`, `types`, config files, GitHub/Gemini adapters, etc).
Chosen over a full `git remote + merge` because `checkout -- <paths>` never
touches files outside the given paths and never conflicts with resource
code it wasn't asked to sync, at the cost of not being a "real" merge (no
history reconciliation) — acceptable since the paths are meant to be
template-owned, not co-edited.

Explicitly excluded from the default list and guarded behind `--yes` even
when named directly: `resource/` (the dev's own game code), `.ai/memory/`
(this resource's own confirmed environment/requirements — syncing it would
silently overwrite a resource's actual confirmed choices with the
template's), `.ai/work/` (temp task state), `.ai/index.json` (regenerate
locally instead of overwriting), `integrations.json` and `package.json`/
`package-lock.json` (resource-specific selections/dependencies).

### Dev style compilation
Raw freeform notes live in `.ai/memory/dev-style/*.md` (never read by
routine tasks). `.ai/skills/compile-dev-style/SKILL.md` is the only thing
that reads them, and it produces `.ai/rules/dev-style.md` in the same
terse-bullet format as `.ai/rules/lua.md`/`security.md`, so routine
implementation tasks can load it cheaply the normal way instead of parsing
prose every time. Genuine contradictions between two developers' notes are
surfaced to the user rather than silently resolved.

## Contracts
- CLI: `npm run sync:template` (`scripts/sync-template.mjs`); flags
  `--remote-url`, `--remote-name`, `--ref`, `--paths`, `--dry-run`, `--yes`,
  `--help`. Writes `.template-sync.json` (remote/ref/commit/timestamp) after
  a successful sync.
- Skill: `.ai/skills/compile-dev-style/SKILL.md`, registered in
  `.ai/skills/INDEX.md` and `.ai/rules/INDEX.md`; `AGENTS.md`'s Lua/FiveM
  context-routing line now points to `.ai/rules/dev-style.md` when present.

## Testing and acceptance criteria
- `scripts/sync-template.mjs --help`: prints usage.
- Dry-run against `origin/main` (this repo standing in for a template
  remote) with the default `.ai/rules` path: correctly reported "already up
  to date" (no drift, as expected).
- Guarded-path refusal: `--paths resource --dry-run` without `--yes`
  correctly refused with the resource-specific-state warning.
- Path-existence filtering verified directly: `git cat-file -e
  FETCH_HEAD:<path>` returns 0 for an existing directory and a non-zero
  exit (with a "does not exist" message) for a missing one, matching the
  script's `existingPaths` filter.
- Not exercised: an actual non-dry-run sync that performs the `git
  checkout FETCH_HEAD -- <paths>` step against a real divergent remote —
  no second template/resource repo pair was available to test the full
  round trip against.
- `npm run check:skills`, `npm run validate:fast`, `npm run check:secrets`:
  passed after both features were added.

## Decisions and rationale
| Decision | Chosen option | Alternatives considered | Rationale |
|---|---|---|---|
| Update propagation mechanism | `git checkout <remote>/<ref> -- <paths>` via a dedicated script | `git remote add` + full merge | User picked the sync-script option; checkout-of-paths avoids merge conflicts against resource-owned files the sync was never supposed to touch |
| Default sync scope | Fixed allowlist of template-owned paths, resource state guarded behind `--yes` | Sync everything; let the user pass `--paths` every time | A default that could silently overwrite a resource's confirmed environment/requirements/game code would be actively dangerous; an allowlist plus an explicit guard for the rest is the safer default |
| Dev style format | Raw freeform notes compiled by an AI skill into terse `.ai/rules/dev-style.md` bullets | Have devs hand-write the compact rule file directly | User specifically asked for freeform-in, AI-normalizes-to-token-efficient-out; matches the existing `add-integration` Register-mode pattern for intake-then-normalize |

## Assumptions
- `sync-template.mjs` assumes the target repo's git remote for the template
  is reachable (network/auth); it does not vendor or cache the template.
- No resource currently has `.ai/memory/dev-style/*.md` notes beyond the
  instructional example in `notes.md`, so `.ai/rules/dev-style.md` does not
  exist yet in this repo — it is created the first time a developer runs
  the compile skill with real notes.

## Unresolved questions
- Full end-to-end sync (two real repos, one syncing from the other with an
  actual divergent commit) has not been run; only the individual mechanics
  (fetch, path-existence check, guarded-path refusal, dirty-tree check) were
  verified in isolation against this repo's own `origin`.

## Approval
- Approved by: repository owner, via in-chat question (sync-script
  approach chosen over git-remote-only) and free-text answer for the
  dev-style compile approach.
- Approval date: 2026-09-11.
