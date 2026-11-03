---
title: "ตารางกว้าง 100% ปุ่ม Auto-Fit ↔ / Reset ↺ และตัวเลขห้ามปัดบรรทัด (Grid Auto-Fit, Numeric nowrap)"
tags: [standards, ux, grid, table, frontend]
aliases: ["useResizableColumns", "GlobalTableColumnResizer", "ปุ่ม ↔ ↺", "auto-fit columns", "ตัวเลขห้ามตัดบรรทัด", "fitNumericCellsInTable", "data-num-cell", "คอลัมน์ % รวม 100", "ไม่มี scroll แนวนอน", "table-fixed", "data-no-force-fit", "ownerColgroup", "overWide"]
sources: ["docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:14-24", ".agents/skills/resizable-table-columns/SKILL.md:14-35", "AGENTS.md:59", "frontend/shared/ui/useResizableColumns.tsx:79", "frontend/shared/ui/useResizableColumns.tsx:257", "frontend/shared/ui/useResizableColumns.tsx:350", "frontend/shared/ui/useResizableColumns.tsx:380", "frontend/shared/ui/useResizableColumns.tsx:845", "frontend/shared/ui/useResizableColumns.tsx:872", "frontend/src/app/globals.css:1561", "frontend/src/app/globals.css:1576", "frontend/account/master/BcDataList.tsx:998", "frontend/account/report/UniversalReportScreen.tsx:960"]
---

# ตารางกว้าง 100%, Auto-Fit ↔ / Reset ↺, ตัวเลขไม่ปัดบรรทัด

ตารางทุกชนิด (DataList ซ้าย, Detail Grid ขวา, TransItemGrid, ตารางใน Modal) ใช้ความกว้างคอลัมน์เป็น `%` รวม 100% ไม่มี Horizontal Scroll มีปุ่ม `↔` คู่ `↺` และตัวเลขต้องอยู่บรรทัดเดียวเสมอ (กฎข้อ 18, `AGENTS.md:59`) ข้อยกเว้นเรื่องเลื่อนแนวนอนมีสองจุดเท่านั้น (ดูหัวข้อ "ข้อยกเว้น")

## กฎ/วิธีทำ
1. ความกว้างคอลัมน์เป็นสัดส่วน `%` รวม 100% ของพื้นที่ ใช้ `table-layout: fixed` (`<table className="w-full table-fixed border-collapse">`) — ห้ามกำหนด `px` ตายตัวจนล้นจอ 1280–1440px (`SKILL.md` Limitation)
2. `GlobalTableColumnResizer` (`useResizableColumns.tsx:845`) ผูกตารางใน `.account-workspace` ให้เอง: ตั้ง `table-layout: fixed`, ความกว้างเริ่มต้นเป็น `%`, เส้นลากบน `<th>`, และฝังปุ่ม `↔` (Auto) คู่ `↺` (Reset) ที่หัวคอลัมน์สุดท้าย
3. ข้อมูล Async เข้า `tbody` ครั้งแรก → เรียก `computeSmartTableColumnPcts(table, thList)` (`:79`) ปรับ `%` ให้พอดีข้อมูลจริง ถ้าผู้ใช้ยังไม่เคยลากเองใน `localStorage`
4. ปุ่ม `↔` วัดข้อความจริงใน `input` / `textarea` / `select` / ปุ่ม / ข้อความ (ไม่นับสระลอยและวรรณยุกต์ไทย) แล้วคำนวณ `%` ใหม่; ปุ่ม `↺` คืนค่าเริ่มต้นและลบค่าใน `localStorage`
5. ความกว้างขั้นต่ำต่อคอลัมน์ไม่ต่ำกว่า 3% (โค้ดคำนวณ `Math.max(3, Math.min(12, ...))` ที่ `:380`)
6. คอลัมน์ `จัดการ` แคบ (`w-14` หรือ 5–6%) จัดปุ่มด้วย `inline-flex flex-wrap items-center justify-center gap-0.5`; ตารางที่มีฟิลด์มาก (เช่น `VatPanel`) จัดเป็นกลุ่ม 2 แถวคู่ต่อรายการ (`<Fragment key={i}>`)
7. **ตารางที่มี `<colgroup>` ครบทุกคอลัมน์ = เจ้าของตารางคุมความกว้างเอง** (รายงานกลาง Lookup Barcode): `ownerColgroup()` (`:257`) ทำให้ enhancer กลางไม่เขียน % ทับตอนโหลด/แถวเปลี่ยน ลาก/`↔` เขียนลง `<col>` แทน `<th>` และ `↺` คืนค่าเดิมของเจ้าของ — ห้ามกำหนด width ทั้งที่ `<th>` และ `<col>` พร้อมกัน เพราะ browser เอาค่ามากกว่าแล้วย่อทั้งแถว (`SKILL.md:17`)

## ข้อยกเว้นของ "ไร้ Scroll แนวนอน" (มี 2 จุดเท่านั้น)
| จุด | วิธีทำในโค้ด | สถานะ |
|---|---|---|
| (ก) DataList ซ้าย `BcDataList.tsx` | ใส่ `data-no-force-fit="true"` และ `minWidth: max(100%, <คอลัมน์ × 80 + 42>px)` (`BcDataList.tsx:998-1002`) — พื้นที่พอ = กว้าง 100% ตามปกติ แผงแคบมาก (คอลัมน์ < 80px) = เลื่อนแนวนอนแทนการบีบจนอ่านไม่ออก | `SKILL.md:31` ระบุว่าลุงจืดอนุมัติ 2026-11-01 ห้ามถอดกลับ |
| (ข) รายงานกลางที่ข้อมูลกว้างเกินจอ | `overWide` (`UniversalReportScreen.tsx:960`) = ผลรวม % เกิน 100 → ขยายตารางเท่าผลรวม + `overflow-x:auto` + `data-no-force-fit` (`:1674-1683`); คอลัมน์ตัวเลข/รหัส/หัวที่ตัดบรรทัดไม่ได้ (เช่น `01/01/2569`) ได้ความกว้างขั้นต่ำเสมอจาก `computeAutoColumnWidthsFromData` (`GlobalReportPrintModal.tsx:332`) | `SKILL.md:34` |

- ตาราง `data-no-force-fit` enhancer กลางข้าม (`useResizableColumns.tsx:933`) และกฎ CSS ใช้ `.account-workspace table:not([data-no-force-fit="true"])` (`globals.css:1561-1562`) ถ้าเพิ่มกฎบังคับความกว้างตารางใหม่ต้องยกเว้น attribute นี้
- รายงาน `overWide` ใส่ปุ่ม `↔`/`↺` เองเป็นบรรทัดใต้ชื่อคอลัมน์สุดท้าย (`UniversalReportScreen.tsx:1761-1762`) เพราะ `↔` ของ enhancer กลางจะบีบกลับเป็น 100%; ลากขอบคอลัมน์คิด % จาก `clientWidth` ของกรอบเลื่อน และห้าม normalize กลับเป็น 100% ตอน `overWide` (`:1041`)
- หัวตาราง `th` ของรายงานและแถวข้อมูลใช้ `align-top` ทุกช่อง เพื่อไม่ให้หัวที่มีปุ่ม ↔/↺ หรือชื่อ 2 บรรทัดดันหัวช่องอื่นเหลื่อมระนาบ (`SKILL.md:26`)

## ตัวเลขห้ามปัดบรรทัด (Single-Line Numeric Cells)
- CSS ใน `frontend/src/app/globals.css` แยกสองกลุ่ม:
  - ข้อความทั่วไป `.account-workspace td:not(.text-right):not([data-num-cell="true"])` → `word-break: break-word; overflow-wrap: anywhere` (`:1569-1573`)
  - ตัวเลข `th.text-right`, `td.text-right`, `td[data-num-cell="true"]`, `td input.text-right` ฯลฯ → `white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important` และ padding ซ้ายขวา 4px (`:1576-1598`)
- กฎกลางข้อความทั่วไปชนะ class `whitespace-nowrap` ธรรมดา: วันที่ต้องใช้ `whitespace-nowrap!` (important) ไม่งั้นแตกเป็น `02/10/256` + `9`; รหัส/เลขที่เอกสารใช้ `whitespace-nowrap [overflow-wrap:normal]!` อย่าแก้กฎกลางให้ยกเว้นทั้งระบบ (`SKILL.md:24`)
- ห้ามใช้ `break-word`/`anywhere` กับช่องตัวเลข ไม่งั้น `2,662.66` จะแตกหลักท้ายลงบรรทัดใหม่
- ข้อความชื่อ (ชื่อเจ้าหนี้/ลูกหนี้/หน่วยนับ) ต้องตัดบรรทัดได้ ห้ามบังคับ nowrap/ชิดขวา (`SKILL.md:25`)
- `fitNumericCellsInTable(table)` เป็นฟังก์ชันภายใน `GlobalTableColumnResizer` (`useResizableColumns.tsx:872`) สแกน `td` ใน `tbody`/`tfoot` ที่เป็นตัวเลขหรือคลาส `.text-right` ติด `data-num-cell="true"` แล้วถ้าล้นช่องจะย่อ `font-size` — `td` ข้อความตัวเลขย่อได้ต่ำสุด 70% (`Math.max(0.7, ...)` ที่ `:918`) ส่วน `input` ตัวเลขต่ำสุด 72% (`Math.max(0.72, ...)`)
- ถ้ายังล้นให้กด `↔` ขยาย % คอลัมน์ ช่องแสดงตัวเลขใช้ `text-right font-mono tabular-nums whitespace-nowrap`

## ค่าตั้งและ Attribute (ตรวจกับโค้ดจริง)
| รายการ | ค่าจริงในโค้ด | หมายเหตุ |
|---|---|---|
| Hook | `useResizableColumns({ storageKey, columns, onHeaderRefresh })` (`:345`) | ตัวอย่างใน skill/KMS ใช้รูปแบบ positional `(storageKey, defaultWidths)` ซึ่งล้าสมัย |
| localStorage (hook) | `bc_col_pct_v2_${storageKey}` (`:350`) | KMS เขียน `bc_table_col_widths_{id}`, skill เขียน `bc_col_widths_${key}` — ล้าสมัยทั้งคู่ |
| localStorage (global resizer) | `bc_auto_col_pct_v5_…` (`:1020`) | ใช้กับตารางที่ผูกอัตโนมัติ |
| ปุ่ม Auto / Reset | `data-auto-col-fit-btn`, `data-auto-col-reset-btn` (`:1223`, `:1237`) | KMS เขียน `data-reset-col-btn` — ชื่อจริงต่างกัน |
| ปิดระบบกับตารางเฉพาะกิจ | `data-no-col-resize="true"` บน `<table>` | ตรวจที่ `:932` |
| ช่องตัวเลข | `data-num-cell="true"` | ติดโดย `fitNumericCellsInTable` (`:886`) |
| Return ของ hook | `resetWidths`, `autoFitWidths` (`:702-703`) | ปุ่มสำเร็จรูปคือ `ResetColumnWidthsButton` (`:772`) |

## ตัวอย่าง (ปรับตามชื่อจริงในโค้ด)
```tsx
const { getThProps, isResized, resetWidths, autoFitWidths } =
  useResizableColumns({ storageKey: "my_detail_grid", columns });
// th สุดท้าย
<th {...getThProps(5, "px-1.5 py-1.5 text-center")}>
  จัดการ
  <ResetColumnWidthsButton isResized={isResized} onReset={resetWidths} onAutoFit={autoFitWidths} />
</th>
```
รูปแบบ `columns` ดู type `UseResizableColumnsOptions` (`:16`) — ตัวอย่างใน KMS ใช้ `defaultWidths: [8,22,...]` ซึ่งไม่ตรงโค้ดปัจจุบัน

## ไฟล์ที่เอกสารอ้างแต่ไม่พบแล้ว
- skill (`SKILL.md:42-43`) ยังลิงก์ `frontend/src/hooks/useResizableColumns.ts` และ `frontend/src/components/transactions/TransItemGrid.tsx` ซึ่งไม่มีในโค้ดแล้ว ของจริงคือ `frontend/shared/ui/useResizableColumns.tsx` และ `frontend/account/transaction/TransItemGrid.tsx`
- KMS ยังลิงก์ `frontend/src/components/ui/RowMoveButtons.tsx` (re-export wrapper) ซึ่งไม่พบแล้ว ใช้ `frontend/shared/ui/RowMoveButtons.tsx`

## ที่มา
- `docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:14-24` (Workflow 1–2), `:37-46` (Config)
- `.agents/skills/resizable-table-columns/SKILL.md:14-35` (Workflow 1–3, 5)
- `AGENTS.md:59` กฎข้อ 18 (ป้ายข้อความและ UX ตาราง)

## ดูเพิ่ม
[[standards-overview]] · [[std-grid-row-reorder-add-row]] · [[std-input-controls-and-labels]] · [[std-screen-header-toolbar-theme]] · [[frontend-overview]]
