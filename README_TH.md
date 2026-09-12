# FiveM Resource AI Framework

> 🇹🇭 ภาษาไทย | 🇺🇸 [English](README.md)

Template สำหรับสร้าง FiveM Resource ที่ช่วยให้ Developer และ AI ทำงานร่วมกันอย่างมีมาตรฐาน โดยโหลดเฉพาะ Context ที่จำเป็น

โปรเจกต์นี้ไม่ใช่ Framework แทน ESX, QBCore หรือ Qbox แต่เป็นฐานสำหรับสร้าง Resource แบบ Standalone หรือเชื่อมเฉพาะ Framework, Database, Library และ Integration ที่ใช้งานจริง

## จุดเด่น

- Requirements discovery และ Environment memory
- Client / Server / Shared / Config boundaries
- Server-authoritative design
- AI rules, skills, recipes และ context budget
- LuaLS type-safety practice และ FiveM type definitions
- Svelte 5 feature-state lifecycle
- NUI timeout, cancellation, structured errors และ listener cleanup
- Optional i18n, database migration และ FXServer runtime tests
- Wireframe-first UI workflow พร้อมขั้นแยกภาพ UI เป็นชิ้นส่วนและตรวจ Asset Manifest ก่อนประกอบใน Svelte
- CI validation และ production release builder
- (Optional) MCP dev bridge — ปิดลูป write → build → restart → อ่าน log อัตโนมัติกับ FXServer จริงผ่าน AI agent พร้อมคำสั่งติดตั้ง/เช็คสถานะให้เอง (`npm run mcp:init`)
- คำสั่ง sync เทมเพลตกลับเข้า resource ที่ clone ไปแล้ว และ workflow แปลงสไตล์การเขียนโค้ดของเดฟ (freeform text) ให้เป็นไฟล์ rule ที่ AI ใช้จริง

## เริ่มต้นใช้งาน

```bash
git clone https://github.com/NewwyKung/FiveM-Resource-AI-Framework.git my_resource
cd my_resource
npm ci --prefix resource/ui
npm run build --prefix resource/ui
```

แก้ metadata ใน `resource/fxmanifest.lua` และ `resource.json` จากนั้นเริ่มงานกับ AI:

```text
Use .ai/skills/discover-requirements/SKILL.md.
Help me define the feature and environment before implementation.
```

AI จะถามเฉพาะสิ่งที่ Feature ต้องใช้ เช่น Framework, Database, Inventory, Integration, ภาษา, Migration และ Runtime tests

Repository รองรับ GPT/OpenAI Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot และ Kimi Code ผ่าน `AGENTS.md` ชุดเดียว โดยมี adapter แบบสั้นเพื่อไม่ทำให้ context ซ้ำ อ่านวิธีตรวจว่าแต่ละ agent โหลดกฎสำเร็จได้ที่ [docs/ai-agents.md](docs/ai-agents.md)

## Type Safety

Repository มี `.luarc.json`, `types/fivem.lua` และแนวทาง annotation สำหรับ Public API, Events, Config, Repositories, Adapters และ nullable values

Static type ไม่แทน Runtime validation โดยเฉพาะข้อมูลจาก Client, NUI, Database และ External Resource

อ่านเพิ่ม: [docs/type-safety.md](docs/type-safety.md)

## UI State และ NUI Resilience

State lifecycle มาตรฐาน:

```text
idle → loading → ready → submitting → success/error → reset
```

ไฟล์หลัก:

```text
resource/ui/src/js/createFeatureState.svelte.js
resource/ui/src/js/NuiBridge.js
```

NUI bridge รองรับ timeout, AbortController, pending-request limit, response contract, structured errors, disposable listeners และ cleanup

## Optional capabilities

ระบบต่อไปนี้ไม่ถูกโหลดเข้า Runtime หลักโดยอัตโนมัติ:

```text
examples/capabilities/i18n/
examples/capabilities/database-migrations/
examples/capabilities/runtime-tests/
```

AI จะใช้เมื่อ Requirements เลือกเท่านั้น

- **i18n:** ใช้เมื่อรองรับหลายภาษา
- **Database migrations:** ใช้เมื่อ Resource ใช้ Database และเป็นเจ้าของ Schema
- **Runtime tests:** ใช้เมื่อต้องตรวจ FiveM natives, lifecycle, state bags, CEF หรือ providers บน FXServer จริง
- **MCP dev bridge:** ใช้เมื่อต้องการให้ AI agent build/restart/อ่าน log/ทดสอบในเกมกับ FXServer จริงได้เอง อ่านเพิ่มที่ [examples/capabilities/mcp-dev-bridge/README.md](examples/capabilities/mcp-dev-bridge/README.md)

Lua hot reload ไม่อยู่ใน Scope ให้ใช้ Vite HMR สำหรับ NUI และออกแบบ Lua ให้ restart-safe

## Responsive UI

```css
:root {
    --scale: 1;
    --base-screen-height: 1440;
    --px-to-vh: calc(1vh / var(--base-screen-height) * 100 * var(--scale));
}

.panel {
    width: calc(720 * var(--px-to-vh));
}
```

ตัวเลขแทน pixel จาก Design แต่ไม่ใส่ `px` ภายใน `calc()`

## Release

```bash
node scripts/create-release.mjs
```

ผลลัพธ์อยู่ที่:

```text
release/<resource_name>-<version>/
```

## เอกสาร

- [docs/development.md](docs/development.md)
- [docs/releasing.md](docs/releasing.md)
- [docs/ci-cd.md](docs/ci-cd.md)

## Credits

ขอบคุณ **Byte Labs Studio** และ **BL Svelte Template** สำหรับแนวคิดด้าน Developer Experience เช่น browser debugging, NUI event helpers, disposable listeners และ local development workflow

โปรเจกต์นี้ไม่ได้นำ UI design, UI components หรือ visual assets ของ Byte Labs มาใช้

## เบื้องหลังการพัฒนา

โปรเจกต์นี้เริ่มจาก Hobby Project ที่ตั้งใจสร้างไว้ใช้เอง ก่อนตัดสินใจเปิดเป็น Open Source เผื่อมีประโยชน์กับ Developer คนอื่น

ผมใช้ **Kimi K2.6** รวบรวม Best Practices และความรู้ FiveM แล้วใช้ **ChatGPT** สรุปและแปลงเป็น AI Skills, Agent instructions, Rules, Recipes, Memory, Validators และ Workflow ภายใน Repository ปัจจุบันยังใช้ **Claude** เป็นผู้ช่วยหลัก และอาจย้ายไปใช้ **Kimi K3** ในอนาคตจากประสบการณ์ทดสอบส่วนตัว

Kimi ไม่ได้จ่ายนะ 😄

> เป้าหมายของโปรเจกต์นี้ไม่ใช่การแทนที่ Developer ด้วย AI แต่คือการช่วยให้ Developer สร้าง FiveM Resource ได้เร็วขึ้นและมีคุณภาพสม่ำเสมอขึ้น ไม่ว่าจะเลือกใช้ AI โมเดลใด
