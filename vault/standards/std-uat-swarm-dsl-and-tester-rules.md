---
title: "BC Ai Tester (:3050): สคริปต์ UAT, คำสั่ง do, Smart Delta Patrol และกติกาผู้ทดสอบขี้สงสัย"
tags: [standards, uat, testing, playwright, process]
aliases: ["UAT Swarm", "BC Ai Tester", "32-Bot Swarm", "35 บอท", "bot-01 bot-35", "ui.demoLogin", "ui.openMenu", "bc.auditScreen", "bc.probeButtons", "bc.auditReport", "ui.expectClean", "tester ขี้สงสัย", "api/runs", "api/code-changed", "Smart Delta Patrol", "verdict ready", "uat-scripts"]
sources: ["AGENTS.md:45-48", "AGENTS.md:64-67", "AGENTS.md:73-77", "docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:14-15", "docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:22", "docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:29", "docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:25-59", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md:14-29", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md:47", "uat/openhands-swarm/src/lib/swarm-data.ts:28", "uat/openhands-swarm/src/lib/swarm-data.ts:119", "uat/openhands-swarm/src/lib/swarm-data.ts:129", "uat/openhands-swarm/src/lib/swarm-data.ts:142-150", "uat/openhands-swarm/runner/run.mjs:134-147", "uat/openhands-swarm/runner/run.mjs:493", "uat/openhands-swarm/runner/run.mjs:767", "uat/openhands-swarm/runner/run.mjs:948", "uat/openhands-swarm/runner/run.mjs:979", "uat/openhands-swarm/runner/run.mjs:1376-1377", "uat/openhands-swarm/runner/run.mjs:1397-1398", "uat/openhands-swarm/runner/run.mjs:1440", "uat/openhands-swarm/src/lib/uat-scripts.ts:8", "uat/openhands-swarm/src/lib/uat-scripts.ts:30-37", "uat/openhands-swarm/src/app/api/scripts/route.ts:5", "uat/openhands-swarm/src/app/api/runs/route.ts:22-35", "uat/openhands-swarm/src/app/api/delivery/route.ts:5", "uat/openhands-swarm/src/lib/delivery.ts:17", "uat/openhands-swarm/src/lib/delivery.ts:70", "uat/openhands-swarm/src/app/api/code-changed/route.ts:22-40", "uat/openhands-swarm/src/lib/chaos-engine.ts:2444", "uat/openhands-swarm/src/lib/chaos-engine.ts:2822-2824", "uat/openhands-swarm/src/lib/chaos-engine.ts:2993", "uat/openhands-swarm/src/lib/chaos-engine.ts:3004", "uat/openhands-swarm/src/lib/chaos-engine.ts:3487-3489", "uat/openhands-swarm/uat-scripts/reports-menu-smoke.json:7-34", "uat/openhands-swarm/package.json:6"]
---

# BC Ai Tester (`:3050`): สคริปต์ UAT, คำสั่ง `do`, Smart Delta Patrol

ระบบทดสอบบนเครื่อง Local ชื่อ **BC Ai Tester** ตัวเดียวครบวงจรที่ `http://localhost:3050` (โฟลเดอร์ `uat/openhands-swarm`, `next dev -p 3050` ที่ `package.json:6`) เป็นตัวตรวจหลักหลังแก้โค้ด พอร์ต `:3051` และ `:3055` ปิดถาวร (`AGENTS.md:47`) ผู้ทดสอบต้อง "ขี้สงสัย" คืออ่านโค้ดจริงก่อนวางแผนและตรวจครบ `Screen + ทุกปุ่ม + DB CRUD + API + Report/PDF` (กฎข้อ 23, `AGENTS.md:64-67`) งานขนานแตก Subagent หลายตัวใน Turn เดียวและกระจายสคริปต์ไปบอท `bot-01`..`bot-35` (จำนวนบอทดูหัวข้อ "ฝูงบอท 35 ตัว")

## บริการที่เกี่ยวข้อง
| บริการ | ที่อยู่ | บทบาท |
|---|---|---|
| Go Backend | `127.0.0.1:18090` (หรือ `:8081`) | API, Validation, SQL, PDF (`AGENTS.md:46`) |
| Next.js Frontend | `localhost:3001` | หน้าจอ BC Ai Account |
| BC Ai Tester | `localhost:3050` | หน้าสั่งรัน, ฝูงบอท, สมอง AI/MCP (`/api/mcp`), `/api/code-changed`, `/api/delivery` |

## ฝูงบอท 35 ตัว (ตรวจกับโค้ดและ API 2026-11-03)
- บอทสร้างจาก 12 โมดูล (`MODULES`, `swarm-data.ts:28`) × มุมตรวจ (`LENSES`, `:143`) ใน `INITIAL_BOTS` (`:150`) โดยตัดมุม `e2e` ออก และโมดูลเงินสด/ธนาคารมีเพียงมุม `screen` กับ `data` (`:129`) → 11 โมดูล × 3 มุม + 2 = **35 ตัว** (`bot-01`..`bot-35`)
- `GET http://localhost:3050/api/bots` ตอบ 35 รายการ (ตรวจ 2026-11-03)
- เลขบอทมาจากลำดับ จึงต้องเพิ่มโมดูลใหม่ **ต่อท้าย** เสมอ ห้ามแทรกกลางเพราะ id ของบอทเดิมจะเลื่อน (คอมเมนต์ `swarm-data.ts:119`)

## ลำดับการทดสอบหลังแก้โค้ด
1. Typecheck/test แคบสุดก่อน: Backend `go vet ./... && go test ./internal/application/process -run "<TestName>"` แล้ว build ทับ binary ที่รันอยู่; Frontend `npx tsc --noEmit` (`SKILL.md:15-17`)
2. ส่งรายชื่อไฟล์ที่แก้เข้า `POST /api/code-changed` (หัวข้อถัดไป) แล้วเขียนสคริปต์เจาะจงเพิ่มเมื่อสร้างฟีเจอร์/เมนูใหม่
3. ตรวจครบ: Screen, ทุกปุ่ม/แท็บ/Modal, DB CRUD (ข้อมูลทดสอบ `UAT-`), API, รายงาน/PDF และจบด้วย `ui.expectClean`
4. ตรวจไม่ผ่าน → เปิด Ticket เข้า IssueMate (`BCAIACC`) → แก้ที่ต้นเหตุ → รันซ้ำจนผ่าน 100% ([[std-uat-issuemate-workflow]])
5. หลังหน้าจอ/รายงาน/PDF ผ่านแล้ว ยังต้องเปิดดูภาพจริงซ้ำอีกรอบ ([[std-ai-advisors-and-visual-audit]])

## Smart Delta Patrol (กฎข้อ 26, `AGENTS.md:73-77`)
- ทุกครั้งที่แก้ไฟล์ใน BC Ai Account (`frontend/src/app/(system)/account/**`, `frontend/src/components/**`, `frontend/src/app/api/**`, `backend/**`) ต้องส่งรายการไฟล์เข้า `POST http://localhost:3050/api/code-changed` ด้วย `{ "files": [...], "summary": "...", "source": "ai_webhook" }` ทันทีหลัง build/แก้เสร็จ
- route รับ `files`, `summary`, `source` (`git_watcher_auto` | `ai_webhook` | `manual`) แล้วเรียก `notifyAiCodeChanged` (`uat/openhands-swarm/src/app/api/code-changed/route.ts:22-40`, `uat/openhands-swarm/src/lib/chaos-engine.ts:2993`); ถ้าไม่ส่ง `files` มา route ใช้ไฟล์ตั้งต้นของ backend แทน (`uat/openhands-swarm/src/app/api/code-changed/route.ts:30-32`) และใช้ได้ไม่เกิน 25 ไฟล์ต่อครั้ง (`uat/openhands-swarm/src/lib/chaos-engine.ts:3004`)
- `mapChangedFilesToImpactedScripts` (`chaos-engine.ts:2444`, ไฟล์ `uat/openhands-swarm/src/lib/chaos-engine.ts`) แปลงชื่อไฟล์เป็นสคริปต์ที่ได้รับผลกระทบ; `runSmartDeltaPatrolTick` (`:2822`) ทำงานเฉพาะเมื่อโหมด autopilot เป็น `running_24x7` (`:2824`) และตั้ง timer ทุก 15 วินาที (`:3487-3489`) เพื่อไล่ตรวจจุดที่โดนแก้/ยังไม่ผ่าน
- ห้ามบอกลุงจืดว่า "เสร็จ" จนกว่าจุดที่กระทบทั้งหมดผ่านครบและ `/api/delivery` ตอบ `verdict: "ready"` (`AGENTS.md:77`, `SKILL.md:25`)
- `GET /api/delivery` (`uat/openhands-swarm/src/app/api/delivery/route.ts:5`) สรุปผลล่าสุดต่อเมนู/รายงาน/สคริปต์: **`blocked`** ถ้ามีรายการล้มเหลวระดับ S1/S2 (`uat/openhands-swarm/src/lib/delivery.ts:17`), **`incomplete`** ถ้ายังมีรายการที่ไม่เคยทดสอบ, **`conditional`** ถ้าเหลือแค่ล้มเหลวระดับรอง, มิฉะนั้น **`ready`** (`uat/openhands-swarm/src/lib/delivery.ts:70`)

## โครงสคริปต์และคำสั่ง `do` (ตามโค้ดที่รันจริง)
สคริปต์คือไฟล์ `uat/openhands-swarm/uat-scripts/<id>.json` ที่ระบบอ่านสดทุกครั้ง (`uat/openhands-swarm/src/lib/uat-scripts.ts`) ตัวอย่างจริง `reports-menu-smoke.json:7-34`:
```json
{ "id": "reports-menu-smoke", "title": "รายงาน: เปิดรายงานแล้วไม่มีข้อผิดพลาดแฝง",
  "module": "reports", "severityOnFail": "S3",
  "steps": [ { "title": "เข้าสู่ระบบแบบ Demo", "do": "ui.demoLogin" },
             { "title": "ล้างตัวนับข้อผิดพลาด", "do": "ui.expectClean", "reset": true },
             { "title": "เปิดเมนู", "do": "ui.openMenu", "key": "menu_report_sum_purchase_by_vat" },
             { "title": "ไม่มีข้อผิดพลาดแฝง", "do": "ui.expectClean" } ] }
```
- ตัวโหลดบังคับ: `id` เป็น `a-z 0-9 -` เท่านั้น, ต้องมี `title`, `module` ต้องตรงกับบอทตัวใดตัวหนึ่ง, `steps` ห้ามว่าง (`uat-scripts.ts:30-33`); `lens` เลือก `screen` / `data` / `api` / `e2e` ถ้าไม่ระบุจะเป็น `data` เมื่อมีขั้น `db.*` นอกนั้น `screen` (`:37`); `cleanup[]` รันท้ายเสมอแม้ขั้นก่อนหน้าล้ม (`run.mjs:1440`)
- สคริปต์ id ขึ้นต้น `ask-` หรือ `auto-` คือสคริปต์ที่ AI เขียน (`uat-scripts.ts:8`) ผลตรวจถูกติดป้ายให้คนยืนยันก่อนสรุป (`uat/openhands-swarm/src/lib/delivery.ts:76`)
- ตัวรันเรียกฟังก์ชันตามค่า `step.do` ถ้าไม่รู้จักจะล้มด้วยข้อความ "ไม่รู้จักประเภทขั้นตอน" (`run.mjs:1397-1398`) ตาราง `ACTIONS` เริ่มที่ `run.mjs:493`

| `do` | พารามิเตอร์หลัก | ทำอะไร |
|---|---|---|
| `ui.demoLogin` | – | ล็อกอินฐานสาธิตอัตโนมัติ (`run.mjs:494`) |
| `ui.openMenu` | `key` (หรือ `menu`/`submenu`) | เปิดเมนูผ่าน `/home?open=<key>` แล้วรอแผงเมนู (`:526-537`) |
| `ui.goto` | `url`/`path` | เปิด path ในโดเมนเดียวกัน ล้มถ้า HTTP >= 400 (`:518`) |
| `ui.click` / `ui.fill` / `ui.select` / `ui.press` | `selector`, `value`, `key`, `nth` | โต้ตอบกับ element (`:538-566`) |
| `ui.expectText` / `ui.expectVisible` / `ui.expectValue` / `ui.expectUrl` | `selector`, `text`/`value`, `op` | ตรวจข้อความ/การแสดงผล/ค่า/URL (`:567-591`) |
| `ui.expectClean` | `reset`, `ignore[]` | ตลอดรันต้องไม่มี console error, page error, HTTP >= 400 หรือข้อความ DB error บนจอ (`:599`) |
| `ui.screenshot` | `name` | เก็บภาพหน้าจอเป็นหลักฐาน (`:610`) |
| `bc.searchList` | `query` | พิมพ์ค้นในช่องค้นหา DataList ซ้าย (`:743`) |
| `bc.toolbar` | `action` (`add`/`edit`/`save`/`delete`/`close`) | กดปุ่ม Toolbar ตามชื่อ (`:733`) |
| `bc.auditScreen` | `menuKey` | ตรวจมาตรฐานหน้าจอ: ห้ามมี `(ชื่อ_ตัวแปร)`, ห้ามมี `undefined`/`NaN`/`[object Object]`, ห้ามมีปุ่ม `F1`-`F12`, ห้ามปุ่มไม่มีข้อความ/title/aria-label (`:767-787`) และระนาบ baseline เหลื่อม (S4, `:274-337`) |
| `bc.probeButtons` | `menuKey`, `buttons[]` | คลิกปุ่ม/แท็บ/Modal ที่ระบุ ต้องไม่เกิด JS Error หรือ HTTP >= 400 (`:948`) |
| `bc.auditReport` | `menuKey`, `startDate`, `endDate`, `filters` | เรียก `/api/process/report/run` ตรวจผลรายงาน (`:979`) |
| `api.request` | `method`, `path`, `body`, `expectStatus`, `expect[]`, `save` | ยิง API ตรวจสถานะ/JSON (`:674`) |
| `report.pdf` / `ui.pdf` | `body` / `selector`, `contains` | ขอ/ดาวน์โหลด PDF ต้องขึ้นต้น `%PDF-` แล้วหาข้อความที่ต้องมี (`:702`, `:710`) |
| `db.query` / `db.exec` | `sql`, `rows`, `expect[]`, `affected` | อ่าน/เขียนฐานทดสอบ (`:717`, `:1357`) |
| `wait` / `set` | `ms` (ไม่เกิน 30 วินาที) / `name`, `value` | รอ / เก็บตัวแปร (`:1364`) |

นอกจากนี้มี `bc.auditAccounting`, `bc.auditThreeWay`, `bc.auditStrictUx`, `bc.auditTaxBoundary`, `bc.auditSecurityAndLock`, `bc.auditSchemaAndCoverage` (`run.mjs:1021-1305`) และ `ui.adminLogin`, `ui.readText`, `ui.act`, `ui.see`, `ui.play`

ขั้นที่อ่านอย่างเดียว (เช่น `ui.openMenu`, `ui.expectVisible`, `report.pdf`, `api.request` แบบ GET) ลองซ้ำได้สูงสุด 2 ครั้ง เว้น 3 วินาที (`run.mjs:1376-1377`, `:1389`); ขั้นกดปุ่ม/`db.exec`/API ที่ไม่ใช่ GET ห้ามลองซ้ำเพราะอาจสร้างเอกสารซ้ำ

## สั่งรันผ่าน API
- `GET /api/scripts` แสดงรายการสคริปต์ที่โหลดได้ (อ่านอย่างเดียว, `uat/openhands-swarm/src/app/api/scripts/route.ts:5`) — สคริปต์ใหม่ทำโดยวางไฟล์ JSON ใน `uat-scripts/`
- `POST /api/runs` รับ `{ scriptIds?: string[], botIds?: string[], all?: boolean }` (`uat/openhands-swarm/src/app/api/runs/route.ts:22-35`) `botIds` หมายถึงทุกสคริปต์ที่ module+lens ตรงกับบอทนั้น

## กติกาข้อมูลและความลับ
- ข้อมูลทดสอบ CRUD ใช้รหัสขึ้นต้น `UAT-` ใน `bcdemo` และห้ามแก้แถวที่ไม่ขึ้นต้นด้วย `UAT` (`AGENTS.md:48`)
- ขั้น `db.*` ถูก guard: ยอมเฉพาะฐานใน `TEST_DBS` (`bcdemo`, `bcuatadmin`, `bcerpmainuatadmin`) และฐาน `uat_<ชื่อ>` ที่มี `COMMENT ON DATABASE` เป็น `uat-tester`; ตัวแปรสภาพแวดล้อมจำกัดได้เท่านั้น ขยายไม่ได้ (`run.mjs:134-147`)
- ห้ามพิมพ์รหัสผ่าน/Token ลงสคริปต์หรือแชท ค่าลับอยู่ที่ env เท่านั้น

## ความคลาดเคลื่อนของเอกสาร (doc drift)
ให้ยึดโค้ดตามตารางข้างบน:
- จำนวนบอท: `AGENTS.md:47`, `:64`, `:67`, `SKILL.md:9`, `:20`, `:46`, `KMS_UAT_SWARM_AND_ISSUEMATE.md:3`, `:14`, `:15` และคอมเมนต์ `swarm-data.ts:142` ยังเขียน 32 ตัว แต่โค้ดและ `/api/bots` ให้ 35
- ตัวอย่างสคริปต์ใน `KMS_UAT_SWARM_AND_ISSUEMATE.md:29` มีคีย์ `targetUrl` ซึ่งไม่พบทั้งใน `runner/run.mjs` และ `src/lib/uat-scripts.ts` (ไม่ถูกอ่าน) ฐาน URL กำหนดตอนรันไม่ใช่ในไฟล์สคริปต์
- `KMS_UAT_SWARM_AND_ISSUEMATE.md:25-59` เขียนสคริปต์เป็น `cmd` + `args` (เช่น `ui.clickRow`, `ui.expectVisible` ด้วยข้อความ) แต่ตัวรันอ่าน `do` + พารามิเตอร์ชื่อเต็ม (`key`, `selector`, `query`) และไม่มี `ui.clickRow` ใน `ACTIONS`
- `KMS_UAT_SWARM_AND_ISSUEMATE.md:22` ให้ลงทะเบียนสคริปต์ด้วย `POST /api/scripts` แต่ route นั้นมีเฉพาะ `GET` (`uat/openhands-swarm/src/app/api/scripts/route.ts:5`)
- `SKILL.md:47` ยังระบุ UI UAT Tester ที่ `:3051/api/mcp` ขัดกับ `AGENTS.md:47` ที่ปิดพอร์ตนี้ถาวร; สคริปต์ `uat/scratch/mcp-ui-uat.mjs` ยังตั้งค่าเริ่มต้นไปพอร์ตนั้น
- สมองคุย MCP ปัจจุบันอยู่ในแอป `:3050` เอง (`uat/openhands-swarm/src/app/api/mcp/route.ts`)

## ที่มา
- `AGENTS.md` กฎข้อ 7, 23, 26
- `docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md`, `.agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md`
- โค้ด `uat/openhands-swarm/` ตามรายการ `sources`

## ดูเพิ่ม
[[standards-overview]] · [[std-uat-issuemate-workflow]] · [[std-ai-advisors-and-visual-audit]] · [[std-repo-scope-rules]] · [[std-display-readability-rules]] · [[process-overview]] · [[sys-uat-overview]] · [[sys-tests-overview]]
