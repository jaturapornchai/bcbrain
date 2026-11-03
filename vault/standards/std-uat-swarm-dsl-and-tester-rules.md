---
title: "UAT Swarm 32 บอท: คำสั่ง DSL และกติกาผู้ทดสอบขี้สงสัย (UAT Swarm DSL, Skeptical Tester)"
tags: [standards, uat, testing, playwright, process]
aliases: ["UAT Swarm", "32-Bot", "bot-01 bot-32", "ui.demoLogin", "ui.openMenu", "bc.auditScreen", "bc.probeButtons", "bc.auditReport", "ui.expectClean", "UI UAT Tester 3051", "Fire-and-Forget", "tester ขี้สงสัย", "scripts api/runs"]
sources: ["docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md", "AGENTS.md", "uat/openhands-swarm/uat-scripts", "uat/scratch/mcp-ui-uat.mjs"]
---

# UAT Swarm 32 บอท: คำสั่ง DSL และกติกาผู้ทดสอบ

ระบบทดสอบบนเครื่อง Local เป็นตัวตรวจหลักหลังแก้โค้ด (ไม่ใช้ Token, รัน Playwright DOM ขนานสูงสุด 32 บอท `bot-01`..`bot-32`) ผู้ทดสอบต้อง "ขี้สงสัย" คืออ่านโค้ดจริงก่อนวางแผนและตรวจครบทุกมิติ (กฎข้อ 23 ใน `AGENTS.md`)

## บริการที่เกี่ยวข้อง
| บริการ | ที่อยู่ | บทบาท |
|---|---|---|
| Go Backend | `localhost:8081` | API, Validation, SQL, PDF |
| Next.js Frontend | `localhost:3001` | หน้าจอ BC Ai Account |
| Local UAT Swarm | `localhost:3050` (โฟลเดอร์ `uat/openhands-swarm`) | ตัวตรวจหลัก ขนาน 32 บอท |
| UI UAT Tester (MCP) | `localhost:3051/api/mcp` (`uat/scratch/mcp-ui-uat.mjs`) | ตัวเสริม **Fire-and-Forget เท่านั้น** — ยิงแล้วไม่รอผล (`.catch(() => {})`) ห้ามวน loop รอพอร์ต 3051 |

## ลำดับการทดสอบหลังแก้โค้ด
1. Typecheck/test แคบสุดก่อน: Backend `go vet ./... && go test ./internal/application/process -run "<TestName>"` แล้ว build เป็น `bcaiaccount-api-new.exe` ย้ายทับ `bcaiaccount-api.exe`; Frontend `npx tsc --noEmit`
2. เขียนสคริปต์ JSON ที่ `uat/openhands-swarm/uat-scripts/uat-<topic>.json` → ลงทะเบียน `POST /api/scripts` → สั่งรันขนาน `POST /api/runs` ด้วย `{ scriptIds: [...] }`
3. ตรวจครบ: **Screen + ทุกปุ่ม + DB CRUD + API + Report/PDF** และจบด้วย `ui.expectClean` (ตรวจ HTTP >= 400, JS error, SQLSTATE)
4. ตรวจไม่ผ่าน → เปิด Ticket เข้า IssueMate (`BCAIACC`) → แก้ที่ต้นเหตุ → รันซ้ำจนผ่าน 100% ([[std-uat-issuemate-workflow]])
5. งานขนาน/หลายโมดูล แตก Subagent หลายตัวใน Turn เดียว (skill ระบุ `invoke_subagent` `TypeName: "research" | "self"`, `Model: "flash"`)

## โครง Script และคำสั่ง `cmd`
```json
{ "id": "uat-example-01", "name": "UAT Example Screen Check", "targetUrl": "http://localhost:3001",
  "steps": [ { "cmd": "ui.demoLogin" }, { "cmd": "ui.openMenu", "args": ["P0017"] },
             { "cmd": "bc.auditScreen" }, { "cmd": "bc.probeButtons" }, { "cmd": "ui.expectClean" } ] }
```
| `cmd` | args | ทำอะไร |
|---|---|---|
| `ui.demoLogin` | – | ล็อกอินฐานข้อมูลสาธิตอัตโนมัติ |
| `ui.openMenu` | `["<รหัสเมนู>"]` | เปิดหน้าจอ เช่น `P0017`, `IC003`, `CancelPO` |
| `ui.goto` | `["/path"]` | เปิด path ตรง |
| `ui.wait` | `[ms]` | รอ |
| `bc.searchList` | `["<คำค้น>"]` | ค้นในช่อง DataList ซ้าย |
| `ui.clickRow` / `ui.click` | `["<ข้อความ>"]` / `["<selectorOrText>"]` | คลิกแถว / ปุ่ม |
| `ui.expectVisible` / `ui.expectValue` | `["<text>"]` / `["<selector>","<val>"]` | ตรวจข้อความ / ค่าช่อง |
| `bc.auditScreen` | – | ห้ามมี `_` ในวงเล็บ, ห้าม `F1`–`F12`, ห้าม `undefined`/`NaN`, ตรวจระนาบ Baseline ([[std-input-controls-and-labels]]) |
| `bc.probeButtons` | – | คลิกปุ่ม/แท็บย่อย/Modal ต้องไม่เกิด JS Error หรือ HTTP >= 400 |
| `bc.auditReport` | – | รันรายงานและตรวจ PDF: ไม่มี `..` ตัดข้อความ, คอลัมน์รวม 100% ([[std-report-engine-standard]]) |
| `ui.expectClean` | – | ตลอดรันไม่มี Console Error / Page Error / HTTP >= 400 |

## กติกาข้อมูลและความลับ
- ข้อมูลทดสอบ CRUD ใช้รหัสขึ้นต้น `UAT-` ในฐานข้อมูลสาธิต (`bcdemo`) **ห้ามลบข้อมูลที่ไม่ขึ้นต้นด้วย `UAT`**
- ห้ามพิมพ์รหัสผ่าน/Token ลงสคริปต์หรือแชท ค่าลับอยู่ที่ env เท่านั้น
- repo นี้ระบุให้ไม่รัน Playwright verify อัตโนมัติเมื่อจบงานโดยไม่ได้สั่ง (รอลุงจืดสั่ง — ตามที่ KMS และ skill เขียน) และมีสคริปต์ตัวอย่างอยู่จริงที่ `uat/openhands-swarm/uat-scripts/*.json`

## ที่มา
- `docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md` §1–§2
- `.agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md` Workflow 1–2, Config, Limitation
- `AGENTS.md` กฎข้อ 23

## ดูเพิ่ม
[[standards-overview]] · [[std-uat-issuemate-workflow]] · [[std-repo-scope-rules]] · [[process-overview]]
