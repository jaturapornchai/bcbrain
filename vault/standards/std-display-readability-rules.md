---
title: "กฎแสดงผลให้เข้าใจง่าย: ตัวเลข วันที่ รหัส(ชื่อ) หัวคอลัมน์ และตัวตรวจ UX อัตโนมัติ (Display Readability)"
tags: [standards, ux, frontend, sql, display, audit]
aliases: ["formatMoneyDisplay", "รหัส(ชื่อ)", "ชุด()", "วงเล็บว่าง", "ux-audit", "numCell", "shownWord", "previewCellText", "payee_code alias", "ช่องค้นหา DataList", "เลข 0 แสดงว่าง"]
sources: [".agents/skills/premium-ui-motion-system/SKILL.md:21-30", "AGENTS.md:40-42", "AGENTS.md:58-59", "docs/kms/HANDOFF_ANTIGRAVITY.md:59-61", "frontend/src/lib/numeric.ts:587", "frontend/src/lib/numeric.ts:599", "frontend/account/master/StockToolBits.tsx:78", "frontend/account/report/FastReportDesignerScreen.tsx:4065", "frontend/account/transaction/TransBottomPanel.tsx:62", "frontend/account/transaction/TransBottomPanel.tsx:109", "frontend/src/lib/lookup-tables.ts:106-109", "backend/internal/application/process/report_menu_ic.go:880", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:1872", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:2118", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:2154-2162", "frontend/account/master/BcDataList.tsx:724", "uat/openhands-swarm/runner/ux-audit.mjs:2"]
---

# กฎแสดงผลให้เข้าใจง่าย

ทุกหน้าจอและรายงานต้องอ่านออกเอง: ตัวเลขไม่ปัดบรรทัด ค่า 0 ไม่ขึ้นเลขเปล่า ๆ วันที่ไม่โชว์ ISO ดิบ ไม่มีวงเล็บว่าง `()` และป้ายไม่มีชื่อตัวแปร กฎกลางของช่องกรอก/ป้ายอยู่ที่ [[std-input-controls-and-labels]] และ [[std-ux-buddhist-year-bilingual]] โน้ตนี้เก็บกติกาฝั่ง **การแสดงผลค่าที่มาจาก SQL** ที่ skill `premium-ui-motion-system` ข้อ 9 ระบุไว้ (`SKILL.md:21-30`) และยังไม่มีโน้ตอื่นรวมไว้

## กฎ/วิธีทำ
1. **ตัวเลขอ่านอย่างเดียว (ตาราง/ช่องที่ไม่ได้พิมพ์)** แสดงผ่าน `formatMoneyDisplay()` (`frontend/src/lib/numeric.ts:587`) เสมอ — คั่นหลักพัน และค่าที่ปัดแล้วเป็น 0 คืนสตริงว่าง (`numeric.ts:599`) ตรงกับ `AGENTS.md:40` (0 หรือ 0.00 แสดงว่าง)
2. **ตารางเล็กที่ไม่ได้ใช้ helper กลาง** ให้แก้ที่ตัวกลางจุดเดียวของตารางนั้น ไม่แก้ทีละคอลัมน์: `numCell` ใน `SimpleGrid` (`frontend/account/master/StockToolBits.tsx:78` — ว่างเฉพาะคอลัมน์ชิดขวาที่ค่าเป็น 0) และ `previewCellText` ของตัวออกแบบรายงาน (`frontend/account/report/FastReportDesignerScreen.tsx:4065`)
3. **ช่อง `<input>` ข้อความที่เก็บค่าตัวเลข** (เช่นส่วนลด `discount_word`) ต้องว่างเฉพาะตอนอ่านอย่างเดียว ห้ามแปลงตอนพิมพ์ ไม่เช่นนั้นพิมพ์ `0.5` ไม่ได้ — `shownWord(w, readOnly)` คืนว่างเมื่อ `readOnly` และค่าเป็นชุด `0`/`.` เท่านั้น (`TransBottomPanel.tsx:62`, ใช้ที่ `:109`)
4. **ข้อความ `รหัส(ชื่อ)` ใน SQL** ต่อวงเล็บเฉพาะเมื่อชื่อไม่ว่างและไม่ซ้ำรหัส ด้วยรูป `concat(code,'('||nullif(nullif(trim(name),''),code)||')')` (ตัวอย่างคอลัมน์ `unit_standard_disp`, `frontend/src/lib/lookup-tables.ts:106-109`) จะไม่ได้ `ชุด()` หรือ `แพ็ค(แพ็ค)` ส่วนรูปกลับด้าน ชื่อ ตามด้วย (รหัส) ใช้ `COALESCE('('||NULLIF(d.cust_code,'')||')','')` เพื่อไม่ให้วงเล็บว่างเช่นกัน (`report_menu_ic.go:880`)
5. **วันที่จาก SQL** (`doc_date::text`) เป็น ISO ค.ศ. ต้องส่งผ่าน `formatBcDate()` ก่อนแสดงเสมอ — ตัวอย่าง `formatCellVal` ตรวจชื่อคอลัมน์ที่มี `date` แล้วเรียก `formatBcDate` (`SystemProcessWorkbenchScreen.tsx:2154-2162`; กติกาปี `AGENTS.md:58`)
6. **หัวคอลัมน์ที่สร้างจากชื่อคอลัมน์ SQL อัตโนมัติ** ถ้าความหมายต่างกันตามจอให้ตั้ง alias ใน SQL แทนการใช้ป้ายเดียวผิดความหมายทุกจอ — ตัวอย่างจอรายงานหัก ณ ที่จ่าย `COALESCE(cust_code,'') AS payee_code` (`SystemProcessWorkbenchScreen.tsx:1872`) ป้ายไทยกำหนดที่ `:2118` ("รหัสผู้ถูกหัก")
7. **ช่องค้นหาใน DataList** มีไอคอน `Search` ซ้ายในช่อง และ placeholder `ค้นหา รหัส / ชื่อ…` (`frontend/account/master/BcDataList.tsx:724`, `data-testid="bc-datalist-search-input"`)

## ตัวตรวจ UX อัตโนมัติ
- สคริปต์ `uat/openhands-swarm/runner/ux-audit.mjs` เปิดทุกเมนูที่อยู่ใน `uat-scripts/smoke-*.json` แล้วรายงานรายหมวด: ตัวเลข/วันที่ปัดบรรทัด (`wrapNum`), เลข 0 (`zero`), ป้ายมี `(ชื่อ_ตัวแปร)` (`varLabel`), วันที่ ISO ดิบ (`isoDate`), วงเล็บว่าง `()` (`emptyParen`), ข้อความ nowrap ล้นทับคอลัมน์ข้างเคียง (`spill`) — เทียบกับ `AGENTS.md:40-42` (ตัวเลข), `:58` (ปี), `:59` (ป้ายและตาราง)
- วิธีรัน: `node uat/openhands-swarm/runner/ux-audit.mjs <out.json> http://localhost:3001 6` (อาร์กิวเมนต์ที่ 3 คือจำนวน worker; ตัวแปร `ONLY=menu_a,menu_b` จำกัดเมนู)
- สคริปต์ใช้ Playwright จึงต้องรอลุงจืดสั่งก่อนรัน (skill ข้อ 10: ไม่รัน Playwright อัตโนมัติเมื่อจบงาน) รอบล่าสุดที่บันทึกไว้คือ 2026-11-01: 690 เมนู flagged = 0 (`docs/kms/HANDOFF_ANTIGRAVITY.md:59-61`; ผลเป็นภาพ ณ วันนั้น ไม่ใช่การรับประกันปัจจุบัน)

## ที่มา
- `.agents/skills/premium-ui-motion-system/SKILL.md` Workflow ข้อ 9–10
- `AGENTS.md:40-42`, `:58-59`
- `docs/kms/HANDOFF_ANTIGRAVITY.md` §4 วิธีรัน / ทดสอบ
- โค้ดตามรายการ `sources` (ตรวจแล้วมีจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-ux-buddhist-year-bilingual]] · [[std-grid-autofit-reset]] · [[std-uat-issuemate-workflow]] · [[fe-numeric-money]]
