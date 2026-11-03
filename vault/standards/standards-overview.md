---
title: "สารบัญมาตรฐานและกฎเหล็กของ BC Ai Account (Standards Overview)"
tags: [standards, hub, moc]
aliases: ["standards", "มาตรฐาน", "สารบัญมาตรฐาน", "KMS Index", "กฎเหล็ก repo"]
sources: ["AGENTS.md:15-20", "AGENTS.md:33", "docs/kms/KMS_INDEX.md:7", "docs/kms/KMS_INDEX.md:17"]
---

# สารบัญมาตรฐานและกฎเหล็กของ BC Ai Account

หน้ารวมโน้ตมาตรฐานที่แปลงจาก `AGENTS.md` (กฎเหล็ก 28 ข้อ, `AGENTS.md:33`), `docs/kms/*.md` (12 ไฟล์) และ `.agents/skills/*/SKILL.md` (9 skill) ของ repo `bcaiaccount` เป็นโน้ตย่อยทีละเรื่อง ทุกโน้ตระบุไฟล์ต้นทางในหัวข้อ `ที่มา` และตรวจกับโค้ดจริงแล้ว จุดที่เอกสารไม่ตรงกับโค้ดจะมีหัวข้อ "ข้อควรระวัง" หรือ "doc drift" กำกับ — ถ้าขัดกันให้ยึดโค้ด

ตารางจับคู่ "หมวดงาน → Skill (Tier 2) → KMS (Tier 3)" อยู่ที่ `AGENTS.md:15-20` และ `KMS_INDEX.md` §2 (`:17`) ส่วนการตัดสินใจเชิงสถาปัตยกรรมของ backend อยู่ที่ [[adr-index]]

## เริ่มจากตรงนี้
- [[std-repo-scope-rules]] — กฎเหล็กประจำ repo ขอบเขตงาน และข้อห้ามสำคัญ
- [[std-three-tier-knowledge-architecture]] — ความรู้ 3 ชั้น Rules → Skills → KMS และตารางว่างานไหนอ่านอะไร
- [[std-local-run-and-verify]] — พอร์ต ตัวแปร env และโหมดสาธิตตอนรันในเครื่อง
- [[std-add-screen-workflow]] — เพิ่มหน้าจอใหม่: `bcMenu.json` → `screenRegistry.tsx` → Schema → Backend

## หน้าจอและประสบการณ์ใช้งาน (UX/UI)
- [[std-screen-header-toolbar-theme]] — Header/Toolbar 2 แถว ธีมการ์ด สีพื้นหลัง Widget
- [[std-input-controls-and-labels]] — NumberBox, DateBox, CodeBox, LookupBox และกฎป้ายข้อความ
- [[std-display-readability-rules]] — ตัวเลข วันที่ รหัส(ชื่อ) หัวคอลัมน์ และตัวตรวจ UX อัตโนมัติ
- [[std-ux-buddhist-year-bilingual]] — ปี พ.ศ./ค.ศ. ระบบ 2 ภาษา Balloon Help
- [[std-menu-workflow-cancel-lookup]] — การจัดเมนูตาม Workflow หน้าจอยกเลิกเอกสาร Lookup
- [[std-grid-autofit-reset]] — ตารางกว้าง 100% ปุ่ม ↔ / ↺ ตัวเลขห้ามตัดบรรทัด
- [[std-grid-row-reorder-add-row]] — ลากสลับแถว ⋮⋮ และแถบเพิ่มแถวด้านล่าง
- [[std-motion-ui]] — คลาส Motion กลาง Design Tokens `<Button>` / `<Modal>`
- [[std-motion-animation-rules]] — กฎความปลอดภัยของ animation และ Prepaint 3 จุด
- [[std-frontend-ux-bug-lessons]] — บทเรียนบั๊กหน้าจอธุรกรรม Master แท็บ MDI
- [[std-thai-geo-map-bank-logos]] — ข้อมูลภูมิศาสตร์ไทย แผนที่ โลโก้ธนาคาร
- [[std-platform-google-login-pdpa-hub]] — Google Login, PDPA และหน้าเลือกโมดูล

## รายงานและเอกสารพิมพ์
- [[std-report-engine-standard]] — Engine รายงานกลาง ตัวออกแบบ JSON-First Live SQL
- [[std-report-pdf-thai-wrap-multilevel]] — ตัดคำไทยใน PDF และรายงานหลายระดับ

## ความปลอดภัยและความถูกต้องของข้อมูล
- [[std-security-authz-and-web-vulns]] — เช็กลิสต์ API: ตัวตน สิทธิ์ ช่องโหว่เว็บ และชั้นป้องกันฝั่ง Go
- [[std-security-lessons-idor]] — บทเรียนบั๊กสิทธิ์และข้ามฐานข้อมูล
- [[std-data-integrity-money-transactions]] — เงิน ภาษี Transaction เดียว `ExecBatch` `big.Rat`
- [[std-thai-safe-db-write]] — เขียนข้อมูลไทยลง PostgreSQL ไม่ให้กลายเป็น `????`
- [[std-pgsql-naming-convention]] — ชื่อ Database ตาราง ฟิลด์ (กฎข้อ 25) และชื่อที่ห้ามใช้

## คลังสินค้า
- [[std-inventory-costing-rules]] — ยอดคงเหลือและต้นทุน (`rebuildStockTx`)
- [[std-parallel-unit-and-ref-import]] — หน่วยนับขนาน Serial และการดึงเอกสารอ้างอิง

## ทดสอบ ผลิตสื่อ และการทำงานกับ AI
- [[std-uat-swarm-dsl-and-tester-rules]] — BC Ai Tester ฝูงบอท 35 ตัว คำสั่ง DSL กติกาผู้ทดสอบ
- [[std-uat-issuemate-workflow]] — เฝ้าและตอบใบงาน IssueMate
- [[std-video-tutorial-production]] — ผลิตวิดีโอสอน YouTube 1440p
- [[std-ai-advisors-and-visual-audit]] — กฎข้อ 27–28: สภาที่ปรึกษา AI และตรวจด้วยตาจากรูปจริง

## ที่มา
- `AGENTS.md` (ตาราง 3 ชั้น `:15-20` และกฎเหล็ก 28 ข้อ `:33`)
- `docs/kms/KMS_INDEX.md` §1–§2

## ดูเพิ่ม
[[index]] · [[adr-index]] · [[backend-overview]] · [[accounting-overview]] · [[process-overview]] · [[frontend-overview]]
