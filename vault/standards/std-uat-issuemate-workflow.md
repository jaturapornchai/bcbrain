---
title: "เฝ้าและตอบใบงาน IssueMate BCAIACC (wait_for_issue.py, reply-batch, คำถาม PDF)"
tags: [standards, uat, issuemate, workflow, process]
aliases: ["IssueMate", "BCAIACC", "wait_for_issue.py", "reply-batch", "ตอบ Ticket", "[Question] PDF", "mark_deployed", "watcher 60s", "reply.json รูปแบบ", "ask_brain", "watchdog 3050"]
sources: ["docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:63-98", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md:30-42", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md:55-67", "AGENTS.md:68", "scripts/wait_for_issue.py:37", "scripts/wait_for_issue.py:49-54", "scripts/wait_for_issue.py:411-461", "scripts/wait_for_issue.py:520-660", "scripts/wait_for_issue.py:663", "scripts/wait_for_issue.py:681-732", "scripts/wait_for_issue.py:735", "scripts/wait_for_issue.py:788", "scripts/wait_for_issue.py:891-898", "scripts/wait_for_issue.py:1092-1108", "scripts/wait_for_issue.py:1123-1146"]
---

# เฝ้าและตอบใบงาน IssueMate (`BCAIACC`)

สคริปต์ `scripts/wait_for_issue.py` เฝ้าใบงานใหม่ของโปรเจกต์ `BCAIACC` ทุก 60 วินาที (ค่าเริ่มต้น `--interval 60` ที่ `:1097`, ไม่ใช้ Token ขณะรอ) เมื่อมีใบงานใหม่หรือคอมเมนต์ใหม่ จะจบพร้อมพิมพ์ JSON `next_batch` เพื่อปลุก AI (`wait_loop`, `:891`) รันได้ทีละ instance เพราะมี lock file (`acquire_lock` `:735`, `LOCK_FILE` `:37`)

## กฎ/วิธีทำ
1. **รัน Watcher เบื้องหลังตลอด**: `python scripts/wait_for_issue.py --project BCAIACC --interval 60`; ตรวจครั้งเดียว `--once`
2. **หลังส่ง `--reply-batch` ทุกครั้ง** ต้องสั่ง Watcher `--interval 60` กลับขึ้นเฝ้าต่อทันที และลบไฟล์ `reply_batch.json` ชั่วคราว (`SKILL.md:41-42`)
3. แยกประเภทใบงาน
   - **`[Question]`** (ขอคำอธิบาย Flow/สูตร): ห้ามแก้โค้ดระบบโดยไม่จำเป็น → ค้นโค้ดจริงอ้าง `file:line`, ชื่อฟังก์ชัน, ตาราง DB → สร้าง HTML แล้วให้ Playwright Chromium แปลงเป็น PDF ภาษาไทย (`headless: true`, `format: "A4"`, `printBackground: true`) เก็บที่ `.audit/attachments/BCAIACC-<เลข>/` แล้วตอบด้วย `--reply-batch` (`SKILL.md:34-38`)
   - **`Bug` / UAT Fail**: อ่านโค้ดต้นเหตุ → แก้ที่ Root Cause → `go test` / `npx tsc --noEmit` → รัน BC Ai Tester ซ้ำจนผ่าน 100% ([[std-uat-swarm-dsl-and-tester-rules]]) → ตอบพร้อมหลักฐานด้วย `--reply-batch` (`SKILL.md:39-40`)
4. `--skip-safety-gate` **ไม่มีใน `wait_for_issue.py`** ห้ามใช้ (`KMS_UAT_SWARM_AND_ISSUEMATE.md:94`); มี `--verify` และ `--stamp-version` ให้ใช้แทน (`:1106-1107`)
5. Flag ที่มีจริง (`argparse` `:1094-1108`): `--repo`, `--project`, `--state-file`, `--interval`, `--settle-seconds` (รอให้คลื่นใบงานนิ่ง ค่าเริ่มต้น 15 วินาที), `--batch-size` (50), `--once`, `--mark <code…> --status --note`, `--review-batch`, `--reply-batch`, `--verify`, `--stamp-version`, `--dump-md`
6. `--mark` ที่ใช้สถานะ `deployed` หรือ `wont_fix` ถูกส่งต่อเข้า `reply_batch_parallel` ผ่านไฟล์ชั่วคราว ส่วนสถานะอื่นแค่บันทึกใน state file (`:1123-1146`)

## สิ่งที่ Watcher ทำเพิ่ม (ตรวจกับโค้ด)
- **เติมบริบทจาก BC Brain**: ทุกใบงานที่ดึงมา `fetch_bcbrain_for_issue` (`:411-461`) ยิง MCP tool `ask_brain` ด้วยหัวข้อ+ปัญหา (ตัดที่ 400 ตัวอักษร, timeout 5 วินาที, URL ตั้งได้ด้วย env `BCBRAIN_MCP_URL`) แล้วคืน `matched_slugs` (รูป `folder/slug` จากบรรทัด `slug: … | folder: …`), `sources` ไม่เกิน 8 รายการ (path ขึ้นต้น `backend|frontend|docs`) และ `excerpt` 600 ตัวอักษร — ถ้าเรียกไม่ได้จะคืนค่าว่างและงานเดินต่อ ดังนั้นโน้ตในคลังนี้ที่ใส่ `slug` และ `sources` ครบจะถูกดึงไปแนบกับใบงานโดยตรง
- **เฝ้าสคริปต์ UAT ค้าง**: `scan_3050_stuck_or_failed_scripts` (`:788`) อ่าน `GET http://localhost:3050/api/runs?limit=80` หาสคริปต์ที่ค้างสถานะรัน (> 180 วินาที) หรือไม่ผ่านซ้ำ แล้วปลุก AI ด้วย `wakeup_reason: "stuck_or_failed_uat_on_3050"`
- **Safety Gate `--verify`** (`:681-732`): 3 ขั้น — สแกนบรรทัดที่เพิ่มใน `git diff HEAD` หา private key, Google API key และชื่อฐานข้อมูล/บริษัทลูกค้า (`FORBIDDEN_PATTERNS` `:49-54`) → `go test ./internal/application/process/...` ใน `backend` → `npx tsc --noEmit` ใน `frontend`

## รูปแบบไฟล์ `--reply-batch` (ตรวจกับโค้ดจริง `reply_batch_parallel` `:520`)
ฟังก์ชันอ่านไฟล์เป็น UTF-8 (รองรับ BOM) ได้ 3 รูปแบบ (`:526-547`) — เอกสาร 2 ฉบับเขียนไม่ตรงกัน ให้ยึดโค้ด:
- **dict ที่คีย์เป็นรหัสใบงาน** (ตรงกับตัวอย่างใน skill): `{ "542": { "message": "...", "reviewReason": "...", "targetFiles": ["..."], "status": "deployed", "files": ["...pdf"] } }` — ค่าเป็นสตริงก็ได้ (ถือเป็น summary)
- **dict ใบเดียว** ที่มีคีย์ `code` / `key` / `issue_key` / `number`
- **list ของ object** โดยแต่ละรายการระบุรหัสด้วย `code` | `key` | `identifier` | `issue_key` | `number` | `id` (`:552-559`)
- ข้อความตอบอ่านจากคีย์ `summary` | `message` | `resolution` | `body` (ถ้าไม่มีใช้ข้อความมาตรฐาน, `:565-571`); เหตุผลรีวิวจาก `reviewReason` | `root_cause`; ไฟล์ที่แก้จาก `targetFiles` | `files_changed`; สถานะเริ่มต้น `deployed` (`:572-574`)
- ไฟล์แนบอ่านจาก `files` | `attachments` | `screenshots` เฉพาะ path ที่มีอยู่จริง ไฟล์ข้อความส่งเป็นเนื้อหา ไฟล์อื่นส่งเป็น base64 (`:587-602`)
- **ข้อควรระวัง**: ตัวอย่างใน `KMS_UAT_SWARM_AND_ISSUEMATE.md:82-87` ใช้คีย์ `issue_id` และ `reply` — **ไม่ใช่คีย์ที่โค้ดอ่าน** (รหัสจะว่างและตอบไม่ถูกใบงาน) ให้ใช้ `code` + `summary`/`message` แทน

```json
[ { "code": "BCAIACC-542", "summary": "สรุปผลแก้ไขพร้อมอ้างอิงไฟล์จริง", "status": "deployed",
    "files": [".audit/attachments/BCAIACC-542/คู่มือ-BCAIACC-542.pdf"] } ]
```
```powershell
python scripts\wait_for_issue.py --project BCAIACC --reply-batch uat\scratch\reply_batch.json
```
ภายในใบงานที่สถานะ `open`/`reviewing` และตั้ง `deployed` จะผ่าน `submit_claude_review` → `claim_for_fix` ก่อน (`:604-628`) แล้ว `mark_deployed` + `converse_on_issue` (`:641-655`); ประมวลผลขนานสูงสุด 6 ใบพร้อมกัน (`:663`)

## ข้อห้าม
- ห้ามพิมพ์รหัสผ่าน/Token ลงสคริปต์หรือแชท (ค่าเชื่อมต่อ IssueMate ดูที่ config/env ของสคริปต์ ไม่คัดลอกลงโน้ต)
- ห้ามเขียนไฟล์นอกโฟลเดอร์โปรเจกต์ (`AGENTS.md:68`, [[std-repo-scope-rules]]): `KMS_UAT_SWARM_AND_ISSUEMATE.md:74` และ `SKILL.md:36` ให้คัดลอก PDF ไปโฟลเดอร์ Artifact ของเครื่องมืออื่นซึ่งอยู่นอก repo จึงต้องขออนุมัติลุงจืดก่อนหรือทำ Prompt สำเร็จรูปให้ลุงจืดสั่งต่อ

## ที่มา
- `docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md` §3.1–§3.3
- `.agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md` Workflow 3, Usage example
- `scripts/wait_for_issue.py` (อ่านโค้ดจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-repo-scope-rules]] · [[process-overview]] · [[sys-uat-overview]]
