---
title: "เฝ้าและตอบใบงาน IssueMate BCAIACC (wait_for_issue.py, reply-batch, คำถาม PDF)"
tags: [standards, uat, issuemate, workflow, process]
aliases: ["IssueMate", "BCAIACC", "wait_for_issue.py", "reply-batch", "ตอบ Ticket", "[Question] PDF", "mark_deployed", "watcher 60s", "reply.json รูปแบบ"]
sources: ["docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md", "scripts/wait_for_issue.py:450", "scripts/wait_for_issue.py:869"]
---

# เฝ้าและตอบใบงาน IssueMate (`BCAIACC`)

สคริปต์ `scripts/wait_for_issue.py` เฝ้าใบงานใหม่ของโปรเจกต์ `BCAIACC` ทุก 60 วินาที (ไม่ใช้ Token ขณะรอ) เมื่อมีใบงานใหม่หรือคอมเมนต์ใหม่จะจบพร้อมคืน JSON `next_batch` เพื่อปลุก AI

## กฎ/วิธีทำ
1. **รัน Watcher เบื้องหลังตลอด**: `python scripts/wait_for_issue.py --project BCAIACC --interval 60`; ตรวจครั้งเดียว `--once`
2. **หลังส่ง `--reply-batch` ทุกครั้ง** ต้องสั่ง Watcher `--interval 60` กลับขึ้นเฝ้าต่อทันที และลบไฟล์ `reply_batch.json` ชั่วคราว
3. แยกประเภทใบงาน
   - **`[Question]`** (ขอคำอธิบาย Flow/สูตร): ห้ามแก้โค้ดระบบโดยไม่จำเป็น → ค้นโค้ดจริงอ้าง `file:line`, ชื่อฟังก์ชัน, ตาราง DB → สร้าง HTML แล้วให้ Playwright Chromium แปลงเป็น PDF ภาษาไทย (`headless: true`, `format: "A4"`, `printBackground: true`) เก็บที่ `.audit/attachments/BCAIACC-<เลขใบงาน>/<ชื่อไฟล์>.pdf` → ตอบกลับพร้อมแนบ PDF ด้วย `--reply-batch`
   - **`Bug` / UAT Fail**: อ่านโค้ดต้นเหตุ → แก้ที่ Root Cause → `go test` / `npx tsc --noEmit` → รัน Swarm ซ้ำจนผ่าน 100% ([[std-uat-swarm-dsl-and-tester-rules]]) → ตอบพร้อมหลักฐานด้วย `--reply-batch`
4. `--skip-safety-gate` **ไม่มีใน `wait_for_issue.py`** ห้ามใช้; มี `--verify` (Pre-Deploy Safety & Regression Gate) และ `--stamp-version` ให้ใช้แทน
5. Flag อื่นที่มีจริง (`argparse` บรรทัด ~855–870): `--once`, `--mark <code…> --status --note`, `--review-batch`, `--dump-md`, `--batch-size`, `--settle-seconds`

## รูปแบบไฟล์ `--reply-batch` (ตรวจกับโค้ดจริง `reply_batch_parallel`, บรรทัด 450)
ฟังก์ชันอ่านได้ 3 รูปแบบ — เอกสาร 2 ฉบับเขียนไม่ตรงกัน ให้ยึดโค้ด:
- **dict ที่คีย์เป็นรหัสใบงาน** (ตรงกับตัวอย่างใน skill): `{ "542": { "message": "...", "reviewReason": "...", "targetFiles": ["..."], "status": "deployed", "files": ["...pdf"] } }` — ค่าเป็นสตริงก็ได้ (ถือเป็น summary)
- **dict ใบเดียว** ที่มีคีย์ `code` / `key` / `issue_key` / `number`
- **list ของ object** โดยแต่ละรายการระบุรหัสด้วย `code` | `key` | `issue_key` | `number`
- ข้อความตอบอ่านจากคีย์ `summary` | `message` | `resolution` | `body` (ถ้าไม่มี ใช้ข้อความมาตรฐาน); เหตุผลรีวิวจาก `reviewReason` | `root_cause`; ไฟล์ที่แก้จาก `targetFiles` | `files_changed`; สถานะเริ่มต้น `deployed`
- **ข้อควรระวัง**: ตัวอย่างใน KMS §3.3 ใช้คีย์ `issue_id` และ `reply` — **ไม่ใช่คีย์ที่โค้ดอ่าน** (รหัสจะว่างและตอบไม่ถูกใบงาน) ให้ใช้ `code` + `summary`/`message` แทน

```json
[ { "code": "BCAIACC-542", "summary": "สรุปผลแก้ไขพร้อมอ้างอิงไฟล์จริง", "status": "deployed",
    "files": [".audit/attachments/BCAIACC-542/คู่มือ-BCAIACC-542.pdf"] } ]
```
```powershell
python scripts\wait_for_issue.py --project BCAIACC --reply-batch uat\scratch\reply_batch.json
```
ภายในทำ `submit_claude_review` → `claim_for_fix` → `mark_deployed` + `converse_on_issue` แบบขนาน และบันทึกสถานะลงไฟล์ state ของ watcher

## ข้อห้าม
- ห้ามพิมพ์รหัสผ่าน/Token ลงสคริปต์หรือแชท (ค่าเชื่อมต่อ IssueMate ดู config/env ของสคริปต์ ไม่คัดลอกลงโน้ต)
- ห้ามเขียนไฟล์นอกโฟลเดอร์โปรเจกต์ ถ้าต้องวาง PDF นอกโฟลเดอร์ให้ลุงจืดดำเนินการ ([[std-repo-scope-rules]]); KMS เดิมให้คัดลอก PDF ไปโฟลเดอร์ Artifact ของเครื่องมืออื่นซึ่งอยู่นอก repo จึงต้องขออนุมัติก่อน

## ที่มา
- `docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md` §3.1–§3.3
- `.agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md` Workflow 3, Usage example
- `scripts/wait_for_issue.py` (อ่านโค้ดจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-repo-scope-rules]] · [[process-overview]]
