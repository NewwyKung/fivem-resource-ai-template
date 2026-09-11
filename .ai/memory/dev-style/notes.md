# Dev Style Notes (raw intake)

Write your coding style / workflow preferences here in your own words — Thai
or English, any structure, no format required. This file is never read
directly by routine tasks; it only exists so an AI agent can compile it into
a compact rule file.

To compile: ask an AI agent to run `.ai/skills/compile-dev-style/SKILL.md`
(or say "compile dev style notes"). It reads every `*.md` file in this
folder except this instruction block and produces/updates
`.ai/rules/dev-style.md` in the same terse-bullet format as the other files
under `.ai/rules/` — the only version routine tasks actually load.

Multiple developers can each add their own file here (e.g. `alice.md`,
`bob.md`); the compile step merges and dedupes them, and asks you in chat
about anything genuinely contradictory rather than guessing.

---

<!-- Example — replace with your own notes, or delete this block entirely.

- ตั้งชื่อตัวแปรแบบ camelCase เสมอ ยกเว้น constant ใช้ SCREAMING_SNAKE_CASE
- ชอบ early return มากกว่า nested if
- ไม่ใช้ print() ทิ้งไว้ debug ให้ใช้ Debug.Info/Debug.Error
- อยากให้ทุก PR มี commit message แบบ Conventional Commits

-->
