---
title: "ลากสลับแถว ⋮⋮ เฉพาะโหมดแก้ไข และปุ่มเพิ่มแถวด้านล่างตาราง (Row Reorder, Bottom Add-Row Bar)"
tags: [standards, ux, grid, table, frontend]
aliases: ["RowMoveButtons", "GripVertical", "กดแช่ลากปล่อย", "ย้ายแถว", "ห้ามมีใน DataList", "เพิ่มบรรทัดล่างตาราง", "Bottom Footer Bar", "ภาษีหลายใบ", "bc-row-drop-settle"]
sources: ["docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md", ".agents/skills/resizable-table-columns/SKILL.md", "frontend/shared/ui/RowMoveButtons.tsx:24", "frontend/shared/ui/RowMoveButtons.tsx:93", "frontend/src/app/globals.css:1619", "frontend/account/transaction/TransItemGrid.tsx:1142", "frontend/account/transaction/JournalTaxTabs.tsx:749"]
---

# ลากสลับแถว ⋮⋮ และปุ่มเพิ่มแถวด้านล่างตาราง

ย้ายแถวด้วยไอคอนเดียว `⋮⋮` (กดแช่-ลาก-ปล่อย พร้อม Animation) เฉพาะโหมดเพิ่ม/แก้ไข และปุ่ม `+ เพิ่มบรรทัด` ต้องอยู่แถบล่างสุดของตารางเหมือนกันทั้งระบบ

## กฎ/วิธีทำ
- **แสดงเฉพาะ `insert`/`edit`**: `RowMoveButtons` คืน `null` เมื่อ `disabled` (`RowMoveButtons.tsx:103`); ห้ามมีใน `BcDataList` (DataList ฝั่งซ้าย) และตารางโหมดดูข้อมูล (`!isEditing`)
- **ห้ามแสดงปุ่ม `▲` / `▼` แยกกัน** ใช้ไอคอน `GripVertical` (`⋮⋮`) ปุ่มเดียว
- ลำดับการลาก: `onPointerDown` → `pointermove` → `pointerup`
  - แถวที่ลากลอยตามเมาส์/นิ้ว (`translate3d(0, deltaY, 0) scale(1.01)`)
  - แถวข้างเคียงเลื่อนหลบแบบเรียลไทม์ `transition: transform 220ms cubic-bezier(0.2, 0, 0, 1)` (`:144`) รองรับทั้งตาราง 1 แถวต่อรายการ และ 2 แถวคู่ต่อรายการ (ตรวจจากลำดับเลขแถว)
  - เมื่อปล่อยจะย้ายข้อมูลและเล่น `@keyframes bc-row-drop-settle` (`globals.css:1619`, 0.48s)
- คอลัมน์ `จัดการ` ใส่ `RowMoveButtons` + ปุ่มลบ `✕` (เฉพาะ `isEditing`) ใน `inline-flex flex-wrap` ([[std-grid-autofit-reset]])

## Props จริงของ RowMoveButtons (ตรวจกับโค้ด)
```ts
interface RowMoveButtonsProps {
  index: number; total: number;
  onMove: (fromIdx: number, toIdx: number) => void;
  disabled?: boolean; className?: string;
}
```
KMS ตัวอย่างใช้ `onMoveUp` / `onMoveDown` / `onMoveTo` — props เหล่านี้ไม่มีในโค้ดปัจจุบัน ให้ใช้ `onMove` เพียงตัวเดียว (มี helper `moveArrayItem(arr, from, to)` ใน `:10` สำหรับย้ายข้อมูล) และ import จาก `frontend/shared/ui/RowMoveButtons.tsx` (ไฟล์ re-export `@/components/ui/RowMoveButtons` ไม่พบแล้ว)

## ปุ่มเพิ่มแถวด้านล่างตาราง (Bottom Add-Row Footer Bar)
- ตารางย่อยทุกชนิดต้องวางปุ่ม `+ เพิ่มบรรทัด` / `+ เพิ่มแถว` ใน **แถบล่างสุดของตาราง** เหมือนกันทั้งระบบ
  - หน้าจอธุรกรรม: รายการสินค้า, ภาษีซื้อ/ภาษีขาย, ภาษีหัก ณ ที่จ่าย, รายได้อื่น/ค่าใช้จ่ายอื่น, การลงบัญชี GL
  - หน้าจอ Master: `ItemScreen`, `CustomerDetailScreen`, `SupplierDetailScreen`, `MasterDetailScreen`, `DocFormatScreen` ฯลฯ
- ตรวจพบในโค้ด: `TransItemGrid.tsx` ปุ่ม "เพิ่มบรรทัดรายการใหม่" (บรรทัด 1142, 1278) และ `JournalTaxTabs.tsx` ปุ่ม "เพิ่มบรรทัด" (749, 1162)
- **ภาษีซื้อและภาษีขายรองรับหลายใบกำกับภาษีต่อเอกสาร**: แก้ไขได้และกดเพิ่มบรรทัดล่างตารางได้ใน `UniversalTransScreen.tsx`, `JournalTaxTabs.tsx`, และ `backend/internal/application/process/trans_tax.go` (ตรวจแล้วไฟล์ Go มีจริง ตัวแปร `Kept` ระบุเอกสารที่ผู้ใช้ป้อนหลายแถวเองไว้ไม่ถูกเขียนทับ)

## ที่มา
- `docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md` Objective ข้อ 4, Workflow 3, Limitation, §7
- `.agents/skills/resizable-table-columns/SKILL.md` Workflow 4 + Limitation

## ดูเพิ่ม
[[standards-overview]] · [[std-grid-autofit-reset]] · [[std-motion-animation-rules]] · [[std-menu-workflow-cancel-lookup]] · [[frontend-overview]]
