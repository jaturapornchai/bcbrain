---
title: "กฎขอบเขตงานและกฎเหล็กประจำ repo (Repo Scope & Iron Rules)"
tags: [standards, rules, scope, workspace-isolation, forward-only, nextjs]
aliases: ["ขอบเขตงาน", "scope focus rule", "ห้ามแก้นอกโฟลเดอร์", "workspace isolation", "forward-only", "กฎเหล็ก 28 ข้อ", "ทำงานเฉพาะ backend และ frontend/account", "CLAUDE.md AGENTS.md ของ repo", "Thin Client", "JSON-First"]
sources: ["AGENTS.md:1-9", "AGENTS.md:11-12", "AGENTS.md:19", "AGENTS.md:33", "AGENTS.md:45-48", "AGENTS.md:50-52", "AGENTS.md:54-57", "AGENTS.md:63", "AGENTS.md:68", "CLAUDE.md:1", "frontend/AGENTS.md:1-9", "docs/kms/KMS_AGENTS_RULES_FULL.md:3", "docs/kms/KMS_AGENTS_RULES_FULL.md:8", "docs/kms/KMS_AGENTS_RULES_FULL.md:89", "docs/BCERP_SCREEN_PORTING_STANDARDS.md"]
---

# กฎขอบเขตงานและกฎเหล็กประจำ repo

repo `d:\bcaiaccount` (BC Account Web Standard, สถาปัตยกรรม 3-Tier) มีกฎเหล็ก **28 ข้อ** ใน `AGENTS.md` (หัวข้อที่ `AGENTS.md:33`) โน้ตนี้สรุปกลุ่มกฎเรื่อง "ทำงานตรงไหนได้ ห้ามแตะอะไร และทำอย่างไร" ส่วนกฎรายหมวดอื่นแยกเป็นโน้ตของตัวเอง ดู [[standards-overview]]

## กฎขอบเขต (Scope Focus Rule, `AGENTS.md:11-12`)
- ทำงานเฉพาะ `backend/`, `BC Ai Account` (`frontend/account/`, `/home`, `/login`, `/select-database`, `/admin`, `/api/process/*`, `/api/query/*`, `/api/auth/*`, `/api/admin/*`, `/api/help/*`), `uat/` และ IssueMate โปรเจกต์ `BCAIACC` — กฎข้อ 22 (`AGENTS.md:63`) ย้ำขอบเขตเดียวกัน
- ระบบอื่นห้ามสแกน/แก้ไข/ทดสอบพ่วงเอง รอลุงจืดสั่ง: `pos`, `wms`, `tms`, `procure`, `market`, `etax`, `crm`, `autocare`, `lineoa`, `monitormap`, `workmonitor`, `fraudwarning`, `dashboard`
- Forward-Only: พัฒนาต่อยอดบนโค้ดและฐานข้อมูล BC โดยตรง (`AGENTS.md:12`, กฎข้อ 11 `:52`) คอลัมน์ที่ขาดให้ใช้ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

## กฎ Workspace Isolation (กฎข้อ 24, `AGENTS.md:68`)
- ห้ามสร้าง/แก้/ลบไฟล์นอก `d:\bcaiaccount` เด็ดขาด
- ถ้าต้องแก้นอกโฟลเดอร์ ให้เขียน **Prompt สำเร็จรูป** ให้ลุงจืดไปสั่ง AI ตัวอื่นแก้แทน โดย Prompt ต้องมี 4 อย่าง: ไฟล์เป้าหมาย, สาเหตุ, โค้ดที่ต้องแก้, วิธีตรวจรับ

## กฎวิธีทำงาน
| ข้อ | กฎ | บรรทัดใน `AGENTS.md` |
|---|---|---|
| 9 | Raw Data → Process → Rebuildable Derived Results: ข้อมูลดิบ append-only ตารางผลลัพธ์คำนวณซ้ำได้ตรงกัน 100% (idempotent และ rebuild ได้) | `:50` |
| 10 | Backend (Go, `backend/internal/application/...`) คุม validation, atomic transaction, เงิน/ภาษี/สต็อก/ต้นทุน/GL · Frontend แสดงผลและเรียก API เท่านั้น (Thin Client) | `:51` |
| 11 | Forward-Only: ต่อยอดบน `d:\bcaiaccount` ตรง ๆ · คอลัมน์ขาดใช้ `ADD COLUMN IF NOT EXISTS` | `:52` |
| 13 | JSON-First 100%: เลิกใช้ XML ใช้ JSON/JSONB ทั้ง Designer, DB และ API | `:54` |
| 14 | สงสัยให้ถามลุงจืดก่อนเสมอ ห้ามเดาหรือเพิ่มฟีเจอร์/UI เอง | `:55` |
| 15 | Verify ไฟล์/DB/Build จริงเสมอ และตรวจซ้ำด้วย UAT | `:56` |
| 16 | ทุกคำตอบอ้างโค้ดจริง (`path:line`, ฟังก์ชัน, ตาราง) ห้ามเดา | `:57` |

ตัวอย่างกฎ 9-10 ในโค้ดจริงดู [[std-inventory-costing-rules]] (rebuild สต็อกจากรายการเคลื่อนไหว) และ [[std-data-integrity-money-transactions]] (เงิน/ธุรกรรมฝั่ง backend)

## Git และ Services (กฎข้อ 7, `AGENTS.md:45-48`)
- branch `main`; Backend `http://127.0.0.1:18090` (หรือ `:8081`), Frontend `http://localhost:3001`, PostgreSQL `127.0.0.1:5432/bcdemo`
- ห้าม deploy ไป production จนกว่าลุงจืดสั่ง
- ตรวจ UX/UI ด้วย BC Ai Tester ตัวเดียวที่ `http://localhost:3050` ส่วนพอร์ต `:3051` และ `:3055` **ปิดถาวร** (`AGENTS.md:47`) — รายละเอียดดู [[std-uat-issuemate-workflow]]
- ห้ามพิมพ์รหัส/token ลงสคริปต์/แชท/log/git และห้ามแก้ข้อมูลใน `bcdemo` ยกเว้นแถวที่ขึ้นต้นด้วย `UAT` (`AGENTS.md:48`)

## บล็อก Next.js Agent Rules (`AGENTS.md:1-9`)
- `AGENTS.md` และ `frontend/AGENTS.md` (ไฟล์นี้มีแค่บล็อกนี้ 9 บรรทัด) เริ่มด้วยบล็อก "This is NOT the Next.js you know": Next.js เวอร์ชันของ repo มี breaking change ให้อ่านคู่มือใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด
- บล็อกถูกเขียน/เติมกลับโดย `next dev` (ที่มา `node_modules/next/dist/server/lib/generate-agent-files.js`) ลบออกจาก diff ก็จะถูกสร้างใหม่ ถ้า commit ไปพร้อมงานจะทำให้ tree สะอาด
- ตรวจแล้วมี `frontend/node_modules/next/dist/docs/` จริง (โฟลเดอร์ `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) และ `frontend/node_modules/next/dist/server/lib/generate-agent-files.js`

## CLAUDE.md ของ repo
`CLAUDE.md` เริ่มด้วย `@AGENTS.md` (import, `CLAUDE.md:1`) แล้วต่อด้วยมาตรฐานเฉพาะ Claude Code ด้าน UX/UI/Motion ทั้งหมด 6 ข้อ (ข้อ 1-6, ไฟล์ 22 บรรทัด) ดังนั้นกฎกลางแก้ที่ `AGENTS.md` ที่เดียว ส่วนข้อ 4 (ขอภาพจาก Gemini) และข้อ 6 (สภาที่ปรึกษา) ดู [[std-ai-advisors-and-visual-audit]]

## หมายเหตุเรื่องเอกสาร (doc drift)
- `docs/kms/KMS_AGENTS_RULES_FULL.md` คือฉบับเต็มของกฎก่อนย่อเป็น Tier-1 แต่ยังเขียนว่า "ทั้ง 24 ข้อ" (`:8`) และจบที่ข้อ 24 (`:89`) ขณะที่ `AGENTS.md` ปัจจุบันมี 28 ข้อ — ข้อ 25-28 (ตั้งชื่อ PG, Smart Delta Patrol, สภาที่ปรึกษา, Gemini visual audit) อยู่ใน `AGENTS.md` ที่เดียว ให้ยึด `AGENTS.md`
- `AGENTS.md:19` ชี้ `docs/BCERP_SCREEN_PORTING_STANDARDS.md` เป็น Tier-3 ของหมวดโครงสร้างหน้าจอ แต่ไฟล์จริง (25 บรรทัด) มีเฉพาะ §23 (UAT Tester ขี้สงสัย + กระจายงาน Subagent) และ §24 (Workspace Isolation) ไม่มีรายละเอียดวิธีเพิ่มหน้าจอ — ขั้นตอนเพิ่มหน้าจอที่ตรวจกับโค้ดแล้วอยู่ที่ [[std-add-screen-workflow]]

## ที่มา
- `AGENTS.md` (Tier-1 Router + Iron Invariants), `CLAUDE.md`, `frontend/AGENTS.md`
- `docs/kms/KMS_AGENTS_RULES_FULL.md`, `docs/BCERP_SCREEN_PORTING_STANDARDS.md`

## ดูเพิ่ม
[[standards-overview]] · [[std-three-tier-knowledge-architecture]] · [[std-add-screen-workflow]] · [[std-screen-header-toolbar-theme]] · [[std-uat-issuemate-workflow]] · [[std-ai-advisors-and-visual-audit]] · [[backend-overview]] · [[frontend-overview]]
