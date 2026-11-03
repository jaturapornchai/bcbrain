---
title: "สถาปัตยกรรมความรู้ 3 ชั้น Rules → Skills → KMS (3-Tier Knowledge Architecture)"
tags: [standards, kms, skills, routing]
aliases: ["3-tier", "Task Skill KMS router", "KMS index", "สารบัญ KMS", "ต้องอ่าน skill ไหน", "ประหยัด token", "แผนที่ความรู้ repo", "Tier-1 Tier-2 Tier-3"]
sources: ["AGENTS.md:14-31", "AGENTS.md:33", "docs/kms/KMS_INDEX.md:7-31", "docs/kms/KMS_AGENTS_RULES_FULL.md:3-8", ".agents/skills/bc-screen-schema-deep-inspect/SKILL.md", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md", ".agents/skills/inventory-costing-and-parallel-unit/SKILL.md", ".agents/skills/premium-ui-motion-system/SKILL.md", ".agents/skills/report-and-form-engine/SKILL.md", ".agents/skills/resizable-table-columns/SKILL.md", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md", ".agents/skills/thai-safe-db-write/SKILL.md", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md"]
---

# สถาปัตยกรรมความรู้ 3 ชั้น

ความรู้ของ repo `d:\bcaiaccount` แบ่ง 3 ชั้น เพื่อให้ AI โหลดเฉพาะที่ตรงงาน (ประหยัด token และค้นหาแบบ O(1)) ไม่ต้องสแกนทั้งโปรเจกต์ (`AGENTS.md:14-15`, `docs/kms/KMS_INDEX.md:7-13`)

## ชั้นความรู้
| ชั้น | ที่อยู่ | โหลดเมื่อไร | หน้าที่ |
|---|---|---|---|
| Tier 1 Rules | `AGENTS.md` | โหลดอัตโนมัติทุก turn | กฎเหล็ก 28 ข้อ (`AGENTS.md:33`) + ตารางชี้เป้า Task → Skill → KMS (`:16-29`) |
| Tier 2 Skills | `.agents/skills/*/SKILL.md` | เมื่อเจองานหมวดนั้น | Playbook: Objective, Workflow, Config, Dependency, Usage example, Limitation |
| Tier 3 KMS | `docs/kms/*.md` | เปิดเฉพาะหัวข้อที่ต้องใช้ | สูตร, โครงสร้างตาราง DB, แผนที่ `file:line`, โค้ดตัวอย่างเต็ม |

จำนวนไฟล์ตรวจกับดิสก์ ณ 2026-11-03: `.agents/skills/` มี 9 โฟลเดอร์ และ `docs/kms/` มี 12 ไฟล์ — ตัวเลขในเอกสารเองล้าสมัย (ดูหัวข้อ doc drift ท้ายโน้ต)

## ตารางจับคู่ งาน → Skill → KMS
ตามตาราง 9 แถวใน `AGENTS.md:19-29`:

| หมวดงาน | Skill (Tier 2) | KMS (Tier 3) | โน้ตสรุป |
|---|---|---|---|
| โครงสร้างหน้าจอ (`bcMenu.json`, `screenRegistry.tsx`) / ผัง Row-Col | `bc-screen-schema-deep-inspect` | `docs/BCERP_SCREEN_PORTING_STANDARDS.md` (ดู drift) | [[std-add-screen-workflow]] |
| UX/UI มาตรฐาน ปี พ.ศ./ค.ศ. 2 ภาษา Balloon Help | `bc-ux-workflow-and-platform-standards` | `KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` | [[std-screen-header-toolbar-theme]] [[std-ux-buddhist-year-bilingual]] [[std-input-controls-and-labels]] |
| ตาราง Grid ↔/↺ ⋮⋮ | `resizable-table-columns` | `KMS_TABLE_GRID_AND_WIDGET_STANDARD.md` | [[std-grid-autofit-reset]] [[std-grid-row-reorder-add-row]] |
| คลัง ต้นทุน หน่วยนับขนาน Serial ดึงอ้างอิง | `inventory-costing-and-parallel-unit` | `KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md` | [[std-inventory-costing-rules]] [[std-parallel-unit-and-ref-import]] |
| รายงานกลาง PDF ไทย SQL Studio Form/Report JSON | `report-and-form-engine` | `KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` | [[std-report-engine-standard]] [[std-report-pdf-thai-wrap-multilevel]] |
| ความปลอดภัย API, ExecBatch, big.Rat | `secure-api-data-integrity-checklist` | `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` | [[std-security-authz-and-web-vulns]] [[std-security-lessons-idor]] [[std-data-integrity-money-transactions]] |
| Motion & UI พรีเมียม | `premium-ui-motion-system` | `KMS_PREMIUM_UI_MOTION_STANDARD.md` | [[std-motion-ui]] [[std-motion-animation-rules]] [[std-display-readability-rules]] |
| BC Ai Tester `:3050`, IssueMate + PDF | `uat-swarm-and-issuemate-workflow` | `KMS_UAT_SWARM_AND_ISSUEMATE.md` | [[std-uat-swarm-dsl-and-tester-rules]] [[std-uat-issuemate-workflow]] |
| ตั้งชื่อ Database/Table/Field PostgreSQL | `bc-screen-schema-deep-inspect` | `KMS_PGSQL_NAMING_CONVENTION.md` | [[std-pgsql-naming-convention]] |

แถวที่อยู่ใน `docs/kms/KMS_INDEX.md:29-30` แต่ไม่ใช่งานหมวด Skill: ฉบับเต็มของกฎ (`KMS_AGENTS_RULES_FULL.md`) → [[std-repo-scope-rules]], การผลิตวิดีโอคู่มือ (`video-tutorial-production.md`) → [[std-video-tutorial-production]]

Skill `thai-safe-db-write` (`.agents/skills/thai-safe-db-write/SKILL.md`) ไม่อยู่ในตารางของ `AGENTS.md` และ `KMS_INDEX.md` — สรุปไว้ที่ [[std-thai-safe-db-write]]

## กฎการใช้
- เปิดอ่านเฉพาะ Skill/KMS ที่ตรงหมวดงานของ task ไม่โหลดทั้งหมด
- รูปแบบ Skill มาตรฐานของ repo: Objective, Workflow, Config, Dependency, Usage example, Limitation
- ก่อนอ้างโค้ดจาก skill/KMS ให้ตรวจไฟล์จริงเสมอ (กฎข้อ 15–16, `AGENTS.md:56-57`) เพราะเอกสารหลายฉบับมีเลขบรรทัดหรือ path ที่ขยับไปแล้ว

## ความคลาดเคลื่อนของเอกสาร (doc drift, ตรวจ 2026-11-03)
- `KMS_INDEX.md:11-13` ระบุ `AGENTS.md` ราว 7.5 KB, skill 8 ตัว, KMS 9 ไฟล์ แต่ของจริง `AGENTS.md` ~20 KB (20,103 ไบต์), skill 9 โฟลเดอร์, KMS 12 ไฟล์ (รวมสองไฟล์ `HANDOFF_*` และ `video-tutorial-production.md`)
- `KMS_INDEX.md:29` เรียก `KMS_AGENTS_RULES_FULL.md` ว่า "Full Archive 28 ข้อ" แต่ไฟล์เองเขียน 24 ข้อ (`KMS_AGENTS_RULES_FULL.md:3`, `:8`) — ข้อ 25-28 อยู่ใน `AGENTS.md` ที่เดียว
- `AGENTS.md:19` และ `KMS_INDEX.md:21` ชี้ `docs/BCERP_SCREEN_PORTING_STANDARDS.md` เป็น Tier-3 ของหมวดโครงสร้างหน้าจอ แต่ไฟล์จริงมีเฉพาะ §23 UAT และ §24 Workspace Isolation — เนื้อหาโครงสร้างหน้าจอให้ดู skill `bc-screen-schema-deep-inspect` และ [[std-add-screen-workflow]]

## ที่มา
- `AGENTS.md` ส่วน "สถาปัตยกรรมความรู้ 3 ชั้น"
- `docs/kms/KMS_INDEX.md` §1–§2
- `.agents/skills/*/SKILL.md` (9 โฟลเดอร์)

## ดูเพิ่ม
[[standards-overview]] · [[std-repo-scope-rules]] · [[index]]
