---
title: "สถาปัตยกรรมความรู้ 3 ชั้น Rules → Skills → KMS (3-Tier Knowledge Architecture)"
tags: [standards, kms, skills, routing]
aliases: ["3-tier", "Task Skill KMS router", "KMS index", "สารบัญ KMS", "ต้องอ่าน skill ไหน", "ประหยัด token", "แผนที่ความรู้ repo"]
sources: ["AGENTS.md", "docs/kms/KMS_INDEX.md", "docs/kms/KMS_AGENTS_RULES_FULL.md", ".agents/skills/bc-screen-schema-deep-inspect/SKILL.md", ".agents/skills/inventory-costing-and-parallel-unit/SKILL.md", ".agents/skills/premium-ui-motion-system/SKILL.md", ".agents/skills/report-and-form-engine/SKILL.md", ".agents/skills/resizable-table-columns/SKILL.md", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md", ".agents/skills/uat-swarm-and-issuemate-workflow/SKILL.md"]
---

# สถาปัตยกรรมความรู้ 3 ชั้น

ความรู้ของ repo `d:\bcaiaccount` แบ่ง 3 ชั้น เพื่อให้ AI โหลดเฉพาะที่ตรงงาน (ประหยัด token และค้นหาแบบ O(1)) ไม่ต้องสแกนทั้งโปรเจกต์

## ชั้นความรู้
| ชั้น | ที่อยู่ | โหลดเมื่อไร | หน้าที่ |
|---|---|---|---|
| Tier 1 Rules | `AGENTS.md` (~7.5 KB ตามเอกสาร) | โหลดอัตโนมัติทุก turn | กฎเหล็ก 24 ข้อแบบกระชับ + ตารางชี้เป้า Task → Skill → KMS |
| Tier 2 Skills | `.agents/skills/*/SKILL.md` (8 skills) | เมื่อเจองานหมวดนั้น | Playbook: Objective, Workflow, Config, Dependency, Usage example, Limitation |
| Tier 3 KMS | `docs/kms/*.md` (9 ไฟล์) | เปิดเฉพาะหัวข้อที่ต้องใช้ | สูตร, โครงสร้างตาราง DB, แผนที่ `file:line`, โค้ดตัวอย่างเต็ม |

## ตารางจับคู่ งาน → Skill → KMS
| หมวดงาน | Skill (Tier 2) | KMS (Tier 3) | โน้ตสรุป |
|---|---|---|---|
| แกะหน้าจอ C# / ผัง Row-Col | `bc-screen-schema-deep-inspect` | `docs/BCERP_SCREEN_PORTING_STANDARDS.md` | [[std-csharp-screen-porting]] |
| UX/UI มาตรฐาน ปี พ.ศ./ค.ศ. 2 ภาษา Balloon Help | `bc-ux-workflow-and-platform-standards` | `KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` | [[std-screen-header-toolbar-theme]] [[std-ux-buddhist-year-bilingual]] |
| ตาราง Grid ↔/↺ ⋮⋮ | `resizable-table-columns` | `KMS_TABLE_GRID_AND_WIDGET_STANDARD.md` | [[std-grid-autofit-reset]] [[std-grid-row-reorder-add-row]] |
| คลัง ต้นทุน หน่วยนับขนาน Serial ดึงอ้างอิง | `inventory-costing-and-parallel-unit` | `KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md` | [[std-inventory-costing-rules]] [[std-parallel-unit-and-ref-import]] |
| รายงานกลาง PDF ไทย SQL Studio Form/Report JSON | `report-and-form-engine` | `KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` | [[std-report-engine-standard]] [[std-report-pdf-thai-wrap-multilevel]] |
| ความปลอดภัย API, ExecBatch, big.Rat | `secure-api-data-integrity-checklist` | `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` | [[std-security-authz-and-web-vulns]] [[std-data-integrity-money-transactions]] |
| Motion & UI พรีเมียม | `premium-ui-motion-system` | `KMS_PREMIUM_UI_MOTION_STANDARD.md` | [[std-motion-ui]] [[std-motion-animation-rules]] |
| 32-Bot UAT Swarm, UI UAT, IssueMate + PDF | `uat-swarm-and-issuemate-workflow` | `KMS_UAT_SWARM_AND_ISSUEMATE.md` | [[std-uat-issuemate-workflow]] [[std-uat-swarm-dsl-and-tester-rules]] |
| กฎฉบับเต็ม 24 ข้อ | — | `KMS_AGENTS_RULES_FULL.md` | [[std-repo-scope-rules]] |
| ผลิตวิดีโอคู่มือ | — | `video-tutorial-production.md` | [[std-video-tutorial-production]] |

## กฎการใช้
- เปิดอ่านเฉพาะ Skill/KMS ที่ตรงหมวดงานของ task ไม่โหลดทั้งหมด
- รูปแบบ Skill มาตรฐานของ repo: Objective, Workflow, Config, Dependency, Usage example, Limitation (ตรงกับกฎ feature doc ของผู้ใช้)
- ข้อควรระวังจากการตรวจ: skill/KMS หลายไฟล์อ้าง path เก่า (เช่น `frontend/src/components/...`) ที่ไม่มีแล้ว ก่อนอ้างโค้ดให้ตรวจไฟล์จริงเสมอ (กฎข้อ 15–16) — แต่ละโน้ตสรุประบุ "(ไฟล์อ้างอิงไม่พบแล้ว)" ไว้ในจุดที่เกี่ยวข้อง

## ที่มา
- `AGENTS.md` ส่วน "สถาปัตยกรรมความรู้ 3 ชั้น"
- `docs/kms/KMS_INDEX.md` §1–§2
- `.agents/skills/*/SKILL.md` (8 ไฟล์)

## ดูเพิ่ม
[[standards-overview]] · [[std-repo-scope-rules]] · [[index]]
