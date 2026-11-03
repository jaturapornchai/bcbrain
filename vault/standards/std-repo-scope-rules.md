---
title: "กฎขอบเขตงานและกฎเหล็กประจำ repo (Repo Scope & Iron Rules)"
tags: [standards, rules, scope, workspace-isolation, forward-only]
aliases: ["ขอบเขตงาน", "scope focus rule", "ห้ามแก้นอกโฟลเดอร์", "workspace isolation", "forward-only", "กฎเหล็ก 24 ข้อ", "ทำงานเฉพาะ backend และ frontend/account", "CLAUDE.md AGENTS.md ของ repo"]
sources: ["AGENTS.md", "CLAUDE.md", "frontend/AGENTS.md", "docs/kms/KMS_AGENTS_RULES_FULL.md", "docs/BCERP_SCREEN_PORTING_STANDARDS.md"]
---

# กฎขอบเขตงานและกฎเหล็กประจำ repo

repo `d:\bcaiaccount` (BC Account Web Standard, สถาปัตยกรรม 3-Tier) มีกฎเหล็ก 24 ข้อใน `AGENTS.md` ที่ AI/นักพัฒนาต้องยึดทุกครั้ง โน้ตนี้สรุปกลุ่มกฎเรื่อง "ทำงานตรงไหนได้ ห้ามแตะอะไร และทำงานอย่างไร" ส่วนกฎเรื่องหน้าจอ/ตาราง/รายงาน/ความปลอดภัยแยกอยู่ในโน้ตอื่น (ดูท้ายโน้ต)

## กฎขอบเขต (Scope Focus Rule, ลุงจืด 2026-10-28)
- ทำงานเฉพาะ `backend/`, `BC Ai Account` (`frontend/account/`, `/home`, `/login`, `/select-database`, `/admin`, `/api/process/*`, `/api/query/*`, `/api/auth/*`, `/api/admin/*`, `/api/help/*`), `uat/` และ IssueMate โปรเจกต์ `BCAIACC` (กฎข้อ 22)
- ระบบอื่นห้ามสแกน/แก้ไข/ทดสอบพ่วงเอง รอลุงจืดสั่ง: `pos`, `wms`, `tms`, `procure`, `market`, `etax`, `crm`, `autocare`, `lineoa`, `monitormap`, `workmonitor`, `fraudwarning`, `dashboard`

## กฎ Workspace Isolation (กฎข้อ 24)
- ห้ามสร้าง/แก้/ลบไฟล์นอก `d:\bcaiaccount` (รวม `~/.agents/AGENTS.md`, `D:\bc\`, `D:\bccode\`, `D:\project-champ\`, memory-hub, issuemate)
- ถ้าต้องแก้นอกโฟลเดอร์ ให้เขียน **Prompt สำเร็จรูป** ให้ลุงจืดไปสั่ง AI ตัวอื่น โดย Prompt ต้องมี 4 อย่าง: path เป้าหมาย, สาเหตุ, จุด/โค้ดที่ต้องแก้, วิธี verify

## กฎวิธีทำงาน
| ข้อ | กฎ |
|---|---|
| 11 | Forward-Only: ใช้ `D:\bc\BCCM` เป็น KMS (ฐานความรู้) เท่านั้น เดินหน้าอย่างเดียว ห้ามแก้ย้อนกลับเว้นลุงจืดสั่ง · คอลัมน์ที่ขาดให้ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| 14 | สงสัยให้ถามลุงจืดก่อนเสมอ ห้ามเดาหรือเพิ่มฟีเจอร์/UI เอง |
| 15 | Verify ไฟล์/DB/Build จริงเสมอ และตรวจซ้ำด้วย UAT |
| 16 | ทุกคำตอบต้องอ้าง `path/to/file:line`, ชื่อฟังก์ชัน, ตาราง DB จริง ห้ามเดา |
| 9 | Raw Data → Process → Rebuildable Derived Results: ข้อมูลดิบ append-only ครบทุกฟิลด์ ตารางผลลัพธ์คำนวณซ้ำได้ตรงกัน 100% (idempotent) และ rebuild จากข้อมูลดิบได้ |
| 10 | Backend (Go, `backend/internal/application/...`) คุม validation, atomic transaction, เงิน/ภาษี/สต็อก/ต้นทุน/GL · Frontend แสดงผลและเรียก API เท่านั้น (Thin Client) |
| 13 | JSON-First 100%: เลิกใช้ XML ใช้ JSON/JSONB ทั้ง Designer, DB และ API |

## Git และ Services (กฎข้อ 7)
- branch `main`; Backend `localhost:8081`, Frontend `localhost:3001`, PostgreSQL local ฐาน `bcdemo`
- ห้าม deploy ไป production จนกว่าลุงจืดสั่ง
- ตรวจ UX/UI ด้วย Local UAT Swarm (`localhost:3050`) เป็นตัวหลัก ส่วน UI UAT Tester (`localhost:3051/api/mcp`) ใช้แบบ Fire-and-Forget เท่านั้น (รายละเอียด [[std-uat-issuemate-workflow]])
- ห้ามพิมพ์รหัส/token ลงสคริปต์/แชท/log/git (เก็บใน `.env.local`) และห้ามแก้ข้อมูลใน `bcdemo` ยกเว้นแถวที่ขึ้นต้นด้วย `UAT`

## บล็อก Next.js Agent Rules
- `AGENTS.md` (และ `frontend/AGENTS.md` ซึ่งมีแค่บล็อกนี้) เริ่มด้วยบล็อก "This is NOT the Next.js you know": Next.js เวอร์ชันนี้ API/โครงสร้างไฟล์อาจต่างจากที่ AI รู้ ให้อ่านคู่มือใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด และใส่ใจ deprecation notice
- บล็อกนี้ถูกเขียน/เติมกลับโดย `next dev` (ที่มา `node_modules/next/dist/server/lib/generate-agent-files.js`) ลบออกจาก diff ก็จะถูกสร้างใหม่ ถ้า commit ไปพร้อมงานจะทำให้ tree สะอาด
- `CLAUDE.md` ของ repo มีบรรทัดเดียวคือ `@AGENTS.md` (import) ดังนั้นแก้กฎที่ `AGENTS.md` ที่เดียว; ตรวจแล้วมี `frontend/node_modules/next/dist/docs/` จริง (มี `01-app/`, `02-pages/`)

## หมายเหตุเรื่องเอกสาร
- `docs/BCERP_SCREEN_PORTING_STANDARDS.md` ใน repo ปัจจุบันมีเฉพาะหัวข้อ §23 (UAT Tester ขี้สงสัย + กระจายงานให้ Subagent) และ §24 (Workspace Isolation) ไม่มีรายละเอียดการถอดแบบหน้าจอ C# — เรื่องถอดแบบอยู่ที่ [[std-csharp-screen-porting]]
- `KMS_AGENTS_RULES_FULL.md` คือฉบับเต็มของกฎ 24 ข้อก่อนย่อเป็น Tier-1 (ประหยัด token ต่อรอบ ~50%+)

## ที่มา
- `AGENTS.md` (Tier-1 Router + Iron Invariants)
- `CLAUDE.md`, `frontend/AGENTS.md`
- `docs/kms/KMS_AGENTS_RULES_FULL.md`
- `docs/BCERP_SCREEN_PORTING_STANDARDS.md` §23–§24

## ดูเพิ่ม
[[standards-overview]] · [[std-three-tier-knowledge-architecture]] · [[std-screen-header-toolbar-theme]] · [[std-uat-issuemate-workflow]] · [[std-csharp-screen-porting]] · [[backend-overview]] · [[frontend-overview]]
