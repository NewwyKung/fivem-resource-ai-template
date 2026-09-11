---
name: compile-dev-style
description: Turn freeform developer style/workflow notes under .ai/memory/dev-style/ into a compact, token-efficient .ai/rules/dev-style.md rule file. Use when a developer writes or updates their raw notes and asks for them to be compiled, or a rule file drifting from the raw notes needs regenerating.
---

# Compile Dev Style

## Goal
Developers write style/workflow preferences as freeform prose in
`.ai/memory/dev-style/*.md`. This skill normalizes that prose into
`.ai/rules/dev-style.md`, matching the compact bullet format every other
file in `.ai/rules/` already uses, so routine implementation tasks can load
it cheaply alongside `lua.md`/`fivem.md`/`ui.md` instead of parsing prose.

## Read first
- Every `.md` file under `.ai/memory/dev-style/` except instructional
  scaffolding (the example block in `notes.md` is not a preference).
- `.ai/rules/lua.md` and `.ai/rules/security.md` as the target format/tone
  to match — short imperative bullets, no headers beyond the title, no
  rationale prose.
- The existing `.ai/rules/dev-style.md`, if present, so an edit updates it
  rather than silently dropping previously compiled rules the raw notes no
  longer mention.

## Steps
1. Collect every bullet/preference stated across the raw notes files. Note
   which developer file each came from only if it matters for step 3.
2. Deduplicate restatements of the same rule; merge near-duplicates into one
   bullet.
3. If two notes genuinely conflict (not just differently worded — actually
   contradictory, e.g. one says tabs and another says spaces), do not guess
   a winner. List the conflict in chat and ask which one applies, or whether
   both should be scoped (e.g. "in `resource/server/`: X; in `resource/ui/`: Y").
4. Drop anything that isn't an actionable rule (venting, uncertain
   maybes, questions) — this file is instructions for an AI agent to follow,
   not a journal.
5. Rewrite survivors as short imperative statements in the style of
   `.ai/rules/lua.md` (e.g. "Prefer local variables/functions; avoid
   accidental globals." not "I think it's usually nicer to use locals").
6. Write/update `.ai/rules/dev-style.md`:
   ```
   # Dev Style Rules

   - <bullet>
   - <bullet>
   ```
7. If `.ai/rules/dev-style.md` did not previously exist, add a row for it to
   `.ai/rules/INDEX.md` (domain: "Personal/team coding style preferences")
   and confirm `AGENTS.md`'s context-routing section already points to it
   under "Lua/FiveM" (it does as of this skill's introduction — check it is
   still there rather than re-adding a duplicate line).
8. Report a short summary of what changed: bullets added, removed, merged,
   and any conflicts you asked about.

## Token discipline
- The compiled file should stay short — a few dozen bullets at most. If raw
  notes are sprawling, that is a signal to ask the developer to prioritize,
  not to compile everything verbatim.
- Never copy long prose or rationale into `.ai/rules/dev-style.md`; the
  reasoning can stay in the raw notes file if the developer wants it, but
  routine tasks only ever load the compiled bullets.
- Do not re-read raw notes files on every implementation task — only when
  actually running this compile step.

## Safety rule
Only compile what the raw notes actually say. Do not invent style rules the
developer didn't write, and do not silently resolve a genuine contradiction
between two developers' notes — surface it and ask.
