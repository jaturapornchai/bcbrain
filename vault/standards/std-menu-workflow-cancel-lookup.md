---
title: "การจัดเมนูตาม Workflow หน้าจอยกเลิกเอกสาร และ Lookup คลิกเดียว (Menu Workflow, Cancel Screens)"
tags: [standards, ux, menu, transaction, frontend]
aliases: ["เมนูตามลำดับงาน", "section divider เมนู", "หน้าจอยกเลิกเอกสาร", "cancel screens", "last_status", "คลิกเดียวเลือก lookup", "single-click lookup", "section cards แทน sub-tab", "ใช้ปุ่มแทน select", "ปุ่มบันทึกอยู่บนสุด"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md", "frontend/src/config/bcMenu.json", "frontend/account/transaction/UniversalTransScreen.tsx", "frontend/account/transaction/UniversalCancelConfirmScreen.tsx", "frontend/account/tabs/transMenuMap.ts"]
---

# เมนูตาม Workflow, หน้าจอยกเลิกเอกสาร และ Lookup คลิกเดียว

มาตรฐาน UX หน้าจอธุรกรรมและเมนูที่ตกลงกัน (23–24 ต.ค. 2026) ให้ทุก Session ยึดเหมือนกัน

## กฎ/วิธีทำ
1. **ยุบ Sub-Tab เป็น Section Cards เรียงลงมาด้านล่าง** (Vertically Stacked Section Cards) และแยกเมนูย่อยที่เคยรวมกัน — แต่ต้องไม่ขัดกฎ "ห้ามยุบตารางเป็นแท็บเอง ถ้า C# เดิมเรียงแนวตั้ง" ([[std-screen-header-toolbar-theme]])
2. **ตัวเลือกน้อยกว่า 10 รายการ ใช้ปุ่มกดแทน `<select>`**
3. **ปุ่มบันทึกอยู่ด้านบนสุด** ของหน้าจอธุรกรรม
4. **Single-Click Lookup**: ตารางค้นหาใน Modal แว่นขยายทุกจุด เลือกข้อมูลและปิด Modal ทันทีเมื่อคลิก 1 ครั้ง (ผ่าน `BcLookupModal.tsx`; มีบทเรียนว่าสแกนบาร์โค้ด+Enter ใน 200ms ต้องรอผลใหม่ก่อนเลือก)
5. **เมนูเรียงตามลำดับการทำงาน (Workflow Order)** ใน `frontend/src/config/bcMenu.json` พร้อมแถบหัวข้อกลุ่ม (`section`) ใน Sidebar — ตรวจแล้วไฟล์มี field `"section"` (เช่น "① ข้อมูลกิจการและตัวเลือกระบบ")
6. **แยกเมนูยกเลิกเอกสาร (Cancel Screens) ออกจากรายการปกติ**
   - เอกสารปกติ: `COALESCE(last_status, 0) = 0`; หน้าจอยกเลิก: `COALESCE(last_status, 0) = 1`
   - หน้าจอยกเลิกมีแบนเนอร์สีแดงและปุ่มกู้คืนเอกสาร
   - หน้าจอยกเลิก/อนุมัติเอกสารรายสินค้าใช้ `UniversalCancelConfirmScreen.tsx` (prop `mode: "cancel" | "approve"`) แยกชัดจากหน้าจอบันทึกปกติ

## ตัวอย่างจากเอกสาร
```tsx
// ตรวจโหมดหน้าจอยกเลิกเอกสารใน UniversalTransScreen.tsx (ตามที่ KMS เขียน)
const isCancelScreen = Boolean(config.isCancelScreen || menuKey.includes("_cancel") || title.includes("ยกเลิก"));
const statusFilterSql = isCancelScreen ? "COALESCE(last_status, 0) = 1" : "COALESCE(last_status, 0) = 0";
```
หมายเหตุ: ค้นสัญลักษณ์ `isCancelScreen` ใน `UniversalTransScreen.tsx` ปัจจุบันไม่พบ (โค้ดตัวอย่างอาจย้ายไปแล้ว) ให้ตรวจ `transMenuMap.ts` และ `UniversalCancelConfirmScreen.tsx` ก่อนอ้างอิง

## ไฟล์ที่ KMS อ้างแต่ไม่พบแล้ว
- `frontend/shared/layout/EnterpriseWorkbench.tsx` (Sidebar แสดง section) — ไฟล์อ้างอิงไม่พบแล้ว
- `frontend/shared/layout/AccountMainScreen.tsx` — ไฟล์อ้างอิงไม่พบแล้ว (ไม่มีไฟล์ชื่อนี้ใน repo)

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Objective ข้อ 3, 7 และ Workflow §6
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md` Workflow ข้อ 4
- `frontend/src/config/bcMenu.json`, `frontend/account/transaction/UniversalCancelConfirmScreen.tsx`

## ดูเพิ่ม
[[standards-overview]] · [[std-screen-header-toolbar-theme]] · [[std-parallel-unit-and-ref-import]] · [[std-frontend-ux-bug-lessons]] · [[frontend-overview]] · [[process-overview]]
