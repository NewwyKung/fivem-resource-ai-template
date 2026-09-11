---
name: sync-template
description: Pull template updates into a resource cloned from this template, deciding which changed files are genuinely safe template plumbing to bring in versus resource-specific state or intentionally diverged local work. Use when the user asks to update/sync the template, or to pull in the latest template changes.
---

# Sync Template

## Goal
`scripts/sync-template.mjs`'s default path list is a fixed, conservative
guess at what's template plumbing. This skill replaces that guess with
actual judgment: list every file that differs from the template ref, decide
per file whether it's safe to pull in, and only then apply that exact set —
instead of the user hand-picking `--paths` themselves.

## Read first
- `.template-sync.json` if it exists, for the ref/commit last synced from.
- `scripts/sync-template.mjs` itself — specifically `GUARDED_PREFIXES` and
  `GUARDED_EXACT` — so you enforce the same resource-state boundary the
  script does, not a reinvented one.

## Steps
1. Run `node scripts/sync-template.mjs --list-only` (repo-wide; add
   `--ref <ref>` if the user named a specific branch/tag/release instead of
   the template's default branch). This changes nothing — it only fetches
   and prints a name-status diff, each line marked `[guarded]` or not.
2. Classify every listed file:
   - **Template plumbing, safe to pull in:** docs/rules/skills/examples/
     scripts/config that are clearly generic tooling, not specific to this
     resource's own gameplay — new or updated `.ai/rules/*.md`,
     `.ai/skills/*`, `examples/*`, `scripts/*.mjs` (excluding one this
     resource has clearly hand-edited for itself), `docs/schemas/*`,
     `AGENTS.md`, adapter files, CI/config files.
   - **Guarded — do not include without asking:** anything the script
     already marks `[guarded]` (`resource/`, `.ai/memory/`, `.ai/work/`,
     `.ai/index.json`, `integrations.json`, `package.json`,
     `package-lock.json`). Only include one of these if the user explicitly
     names it after you point it out — never decide this on their behalf.
   - **Ambiguous — ask instead of guessing:** a file that isn't guarded but
     where you can't tell if the local copy was intentionally customized
     for this resource (e.g. `scripts/dev-watch.ts` if this resource's own
     ignore list or debounce value looks hand-tuned, or a `.ai/rules/*.md`
     whose local version already differs in a way that looks deliberate
     rather than just older). Read the local file and the diff shape before
     deciding; when still unsure, list it for the user rather than silently
     including or excluding it.
3. Build the final comma-separated `--paths` list from the "safe" bucket
   only.
4. Run `node scripts/sync-template.mjs --paths "<list>" --dry-run` first
   and show the user the resulting diff stat.
5. On confirmation (or immediately, if the user's original request already
   authorized applying whatever you judged safe), re-run without
   `--dry-run`. Add `--yes` only for paths you and the user explicitly
   agreed to include despite being guarded.
6. Never commit the result. Tell the user to review with `git diff
   --cached`, run `npm run validate`, regenerate `.ai/index.json`
   (`node scripts/build-ai-index.mjs`) if any rule/skill file changed, check
   the template's `package.json` by hand for new dependencies (never
   auto-synced), and commit themselves.
7. Report a short summary: what was pulled in, what was left out and why,
   and what needs the user's manual attention (guarded/ambiguous files).

## Safety rule
The guarded list exists because syncing those paths can silently overwrite
this resource's own confirmed environment, in-flight requirements, or actual
game code. Never resolve "ambiguous" or "guarded" classifications by
guessing in the direction of including more files — when in doubt, leave it
out and ask.
