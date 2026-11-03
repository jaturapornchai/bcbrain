---
title: "ถอดแบบหน้าจอจาก C# เดิม (C# Screen Porting, Source-First, KMS Only)"
tags: [standards, porting, csharp, kms, frontend, uat]
aliases: ["Source-First Flow", "bc-screen-schema-deep-inspect", "_selectMenu.cs", "_maxColumn", "_myScreen", "_myTabControl", "_myGrid", "_data.cs", "Forward-Only", "ถอดแบบหน้าจอธุรกรรม", "BCCM", "ตามหน้าจอ C#"]
sources: ["AGENTS.md:42", "AGENTS.md:43", "AGENTS.md:48", "AGENTS.md:51", ".agents/skills/bc-screen-schema-deep-inspect/SKILL.md", "docs/BCERP_SCREEN_PORTING_STANDARDS.md"]
---

# ถอดแบบหน้าจอจาก C# เดิม (Source-First)

โปรเจกต์นี้พัฒนาต่อยอดจากโค้ดเดิม `D:\bc\` (C#/Java) โดยใช้โค้ดเดิมเป็น **KMS (ฐานความรู้ตรรกะธุรกิจ) เท่านั้น** และเดินหน้าอย่างเดียว (Forward-Only) ห้ามแก้ย้อนกลับเว้นลุงจืดสั่ง (AGENTS.md ข้อ 11) ก่อนทำหน้าจอใหม่หรือแก้ฟิลด์ต้องไล่โค้ด C# ให้ครบ ห้ามเดาโครงหน้าจอ

## กฎ/วิธีทำ: ลำดับสืบค้น C# (Source-First Flow)
1. **เริ่มที่ `D:\bc\BCCM`** (`Program.cs` → `BCAccount`) หา `menuKey` ใน `D:\bc\BCAccount\Menu.Designer.cs` เพื่อดูชื่อเมนู ตำแหน่งใน Tree และ `Tag`
2. **ไล่ `case "<menuKey>":` ใน `_selectMenu.cs`** ของโมดูล `BCERPGlobal`, `BCERPConfig`, `BCERPControl`, `BCERPIC`, `BCERPAP`, `BCERPAR`, `BCERPGL`, `BCERPASSET`, `BCPOSControl` และ `BCAccount\_mainForm.cs` เพื่อดูว่า case สร้าง UserControl/Form คลาสใด และส่งโหมดอะไรเข้าไป (ตรวจแล้ว: ไฟล์เหล่านี้มีอยู่จริงใน `D:\bc\`)
3. **แกะ `.cs` และ `.Designer.cs` ให้ลึก** เพื่อหาฟิลด์/แท็บที่ซ่อนอยู่
   - `_myScreen`: ดู `_maxColumn` (1 = เรียงคอลัมน์เดียวเต็มบรรทัด `colSpan: 12`, 2 = ซ้าย-ขวา `colSpan: 6`) ห้ามยุบ/แยกคอลัมน์เอง แล้วไล่ทุก `_addTextBox`, `_addNumberBox`, `_addDateBox`, `_addCheckBox`, `_addComboBox`, `_addRadioButton` พร้อมพิกัด `(row, column, rowSpan, colSpan)`
   - UserControl ลูก (เช่น `_warehouseLocationControl`, `_userGroupDetailControl`, `_screen_more`, `_grid...`) ต้องเปิด `.cs`/`.Designer.cs` ของลูกทุกตัว
   - `_myTabControl`: ดูทุก `TabPage` ที่ประกาศและที่เพิ่มด้วย `TabPages.Add`/`_glCreate()` และตรวจ `TabPages.RemoveAt`, `Dispose()`, `Visible = false` ใน Constructor/Load (แท็บอาจถูกซ่อนตอนรัน)
   - `_myGrid`/`ToolStrip`: ไล่ทุก `_addColumn` (รวม Checkbox, Lookup F2, Display Subquery) และปุ่มพิเศษเหนือตาราง เช่น `All WareHouse and Shelf`, `เลือกทั้งหมด`, `Clear`, `ดึงข้อมูล`
   - Parent Filter: ตรวจ `_searchTopScreen`/`_extraWhere` ที่บังคับเลือกกลุ่มแม่ก่อน เช่น จังหวัด → อำเภอ → ตำบล, กลุ่มหลัก → กลุ่มย่อย, คลัง → ที่เก็บ
4. **ผังหน้าจอธุรกรรม** (AGENTS.md ข้อ 8): ถอด `_icTransControl`, `_icTransScreenTopControl`, `_icTransItemGridControl`, `_glCreate()`, `_icTransScreenMoreControl` ครบทุกฟิลด์ตาม `information_schema.columns`

## C# เป็นความจริงสูงสุด (ห้ามตัดฟิลด์เพราะ DB เก่า)
- โครงตาราง/คอลัมน์ใน C# (`_g.d.<table>._table` ใน `D:\bc\BCERPGlobal\_data.cs`) และ Java เป็นความจริงสูงสุด ฐาน `bcdemo` อาจเป็นรุ่นเก่า
- พบคอลัมน์/ตารางที่มีใน C# แต่ DB ยังไม่มี **ห้ามตัดฟิลด์ออกจากหน้าจอ** ให้รัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` หรือ `CREATE TABLE IF NOT EXISTS` ให้ DB รองรับตาม C# ครบ 100%
- ระวังชื่อคอลัมน์สะกดต่างกันตามนิยามจริง เช่น `ic_shelf.whcode` (ไม่มี `_`) เทียบ `ic_wh_shelf.wh_code` (มี `_`)

## ตรวจฝั่ง Frontend คู่กัน
- เปิด `frontend/account/tabs/screenRegistry.tsx` ดูว่า `menuKey` วิ่งไป Component หรือ Schema ใด (`frontend/src/config/schemas/icMasterSchemas.ts`, `masterDetailSchemas.ts`) — skill เขียนพาธเป็น `frontend/account/screenRegistry.tsx` ซึ่ง**ไม่พบแล้ว** ของจริงอยู่ใน `tabs/`
- ต้องตรง C# 100%: ทุกฟิลด์ที่ C# มีต้องแสดง (ไม่ซ่อนใน conditional), จำนวน/ชื่อ/ลำดับแท็บ, การจัด Row/Column
- Backend Spec `backend/internal/application/process/master_detail_specs.go` ต้องบันทึก/โหลดครบทุกฟิลด์และตารางย่อย (ตรวจแล้ว: ไฟล์มีอยู่จริง)
- หน้าจอต้องไม่ถูกดัดแปลง Layout: ห้ามยุบตารางหลายตัวเป็นแท็บย่อยเอง ถ้าจอเดิมเรียงแนวตั้งต้องเรียงแนวตั้ง (AGENTS.md ข้อ 6) รูปแบบ Header/Toolbar/ธีมดู [[std-screen-header-toolbar-theme]] และชนิดช่องกรอกดู [[std-input-controls-and-labels]]

## ยืนยันผลและขอบเขตงาน
- ทดสอบเปิดหน้าจอจริงด้วย Playwright กดทุกแท็บย่อย ไม่มี SQL/Console Error และทดสอบบันทึก/อ่านผ่าน Playwright API Request คู่กับ query DB เสมอ ([[std-uat-swarm-dsl-and-tester-rules]])
- ผู้ทดสอบต้องอ่านโค้ดหน้าจอจริงก่อนวางแผน (Code-First) แล้วตรวจ `Screen + Every Button + DB CRUD + API + Report/PDF` ใช้ข้อมูล `UAT-` ตั้ง `autoIssueMate = true` และแตกสคริปต์ขนาน 8–16+ ตัว (porting §23)
- ห้ามสร้าง/แก้/ลบไฟล์นอก `d:\bcaiaccount` (รวม `D:\bc\`): ถ้าต้องแก้ ให้เขียน Prompt สำเร็จรูประบุไฟล์เป้าหมาย สาเหตุ โค้ดที่แก้ และวิธีตรวจรับ ให้ลุงจืดสั่ง AI อื่นทำ (porting §24, [[std-repo-scope-rules]])

## ที่มา
- `AGENTS.md` ข้อ 5, 6, 8, 11 (โฟลว์สืบค้นเมนู, ห้ามดัดแปลง Layout, ถอดหน้าจอธุรกรรม, Forward-Only)
- `.agents/skills/bc-screen-schema-deep-inspect/SKILL.md` §1–§4
- `docs/BCERP_SCREEN_PORTING_STANDARDS.md` §23–§24 (ไฟล์มีเฉพาะสองหัวข้อนี้)

## ดูเพิ่ม
[[standards-overview]] · [[std-screen-header-toolbar-theme]] · [[std-input-controls-and-labels]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-repo-scope-rules]] · [[frontend-overview]]
