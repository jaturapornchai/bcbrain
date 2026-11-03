---
title: "ตารางกว้าง 100% ปุ่ม Auto-Fit ↔ / Reset ↺ และตัวเลขห้ามปัดบรรทัด (Grid Auto-Fit, Numeric nowrap)"
tags: [standards, ux, grid, table, frontend]
aliases: ["useResizableColumns", "GlobalTableColumnResizer", "ปุ่ม ↔ ↺", "auto-fit columns", "ตัวเลขห้ามตัดบรรทัด", "fitNumericCellsInTable", "data-num-cell", "คอลัมน์ % รวม 100", "ไม่มี scroll แนวนอน", "table-fixed"]
sources: ["docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md", ".agents/skills/resizable-table-columns/SKILL.md", "AGENTS.md", "frontend/shared/ui/useResizableColumns.tsx:336", "frontend/shared/ui/useResizableColumns.tsx:79", "frontend/shared/ui/useResizableColumns.tsx:836", "frontend/shared/ui/useResizableColumns.tsx:863", "frontend/src/app/globals.css"]
---

# ตารางกว้าง 100%, Auto-Fit ↔ / Reset ↺, ตัวเลขไม่ปัดบรรทัด

ตารางทุกชนิด (DataList ซ้าย, Detail Grid ขวา, TransItemGrid, ตารางใน Modal) ใช้ความกว้างคอลัมน์เป็น `%` รวม 100% ไม่มี Horizontal Scroll มีปุ่ม `↔` คู่ `↺` และตัวเลขต้องอยู่บรรทัดเดียวเสมอ

## กฎ/วิธีทำ
1. ความกว้างคอลัมน์เป็นสัดส่วน `%` รวม 100% ของพื้นที่ ใช้ `table-layout: fixed` (`<table className="w-full table-fixed border-collapse">`) — ห้ามกำหนด `px` ตายตัวจนล้นจอ 1280–1440px
2. `GlobalTableColumnResizer` (`useResizableColumns.tsx:836`) ผูกตารางใน `document.body` ให้เอง: ตั้ง `table-layout: fixed`, ความกว้างเริ่มต้นเป็น `%`, เส้นลากบน `<th>`, และฝังปุ่ม `↔` (Auto) คู่ `↺` (Reset) ที่หัวคอลัมน์สุดท้าย
3. ข้อมูล Async เข้า `tbody` ครั้งแรก → เรียก `computeSmartTableColumnPcts(table, thList)` (`:79`) ปรับ `%` ให้พอดีข้อมูลจริง ถ้าผู้ใช้ยังไม่เคยลากเองใน `localStorage`
4. ปุ่ม `↔` วัดข้อความจริงใน `input` / `textarea` / `select` / ปุ่ม / ข้อความ (ไม่นับสระลอยและวรรณยุกต์ไทย) แล้วคำนวณ `%` ใหม่; ปุ่ม `↺` คืนค่าเริ่มต้นและลบค่าใน `localStorage`
5. ความกว้างขั้นต่ำต่อคอลัมน์ไม่ต่ำกว่า 3% (โค้ดคำนวณ `Math.max(3, Math.min(12, ...))` ที่ `:371`)
6. คอลัมน์ `จัดการ` แคบ (`w-14` หรือ 5–6%) จัดปุ่มด้วย `inline-flex flex-wrap items-center justify-center gap-0.5`; ตารางที่มีฟิลด์มาก (เช่น `VatPanel`) จัดเป็นกลุ่ม 2 แถวคู่ต่อรายการ (`<Fragment key={i}>`)

## ตัวเลขห้ามปัดบรรทัด (Single-Line Numeric Cells)
- CSS ใน `frontend/src/app/globals.css` แยกสองกลุ่ม:
  - ข้อความทั่วไป `td:not(.text-right):not([data-num-cell="true"])` → `word-break: break-word; overflow-wrap: anywhere`
  - ตัวเลข `td.text-right`, `td[data-num-cell="true"]`, `input.text-right` → `white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important` และ padding ซ้ายขวา 4px
- ห้ามใช้ `break-word`/`anywhere` กับช่องตัวเลข ไม่งั้น `2,662.66` จะแตกหลักท้ายลงบรรทัดใหม่
- `fitNumericCellsInTable(table)` (`:863`) สแกน `td`/`input` ที่เป็นตัวเลขหรือคลาส `.text-right` ติด `data-num-cell="true"` แล้วถ้า `scrollWidth > clientWidth` จะย่อ `font-size` ลง 70%–99% (ต่ำสุด 70% ≈ 9px; ในโค้ดใช้ตัวคูณขั้นต่ำ `0.7` ที่ `:909`) — ครอบคลุมตารางใน Modal เช่น `PriceFormulaModal.tsx`
- ถ้ายังล้นที่ 70% ให้กด `↔` ขยาย % คอลัมน์ ช่องแสดงตัวเลขใช้ `text-right font-mono tabular-nums whitespace-nowrap`

## ค่าตั้งและ Attribute (ตรวจกับโค้ดจริง)
| รายการ | ค่าจริงในโค้ด | หมายเหตุ |
|---|---|---|
| Hook | `useResizableColumns({ storageKey, columns, onHeaderRefresh })` | ตัวอย่างใน KMS/skill ใช้รูปแบบ positional `(storageKey, defaultWidths)` ซึ่งล้าสมัย |
| localStorage (hook) | `bc_col_pct_v2_${storageKey}` | KMS เขียน `bc_table_col_widths_{id}`, skill เขียน `bc_col_widths_${key}` — ล้าสมัยทั้งคู่ |
| localStorage (global resizer) | `bc_auto_col_pct_v5_…` | ใช้กับตารางที่ผูกอัตโนมัติ |
| ปุ่ม Auto / Reset | `data-auto-col-fit-btn`, `data-auto-col-reset-btn` | KMS เขียน `data-reset-col-btn` — ชื่อจริงต่างกัน |
| ปิดระบบกับตารางเฉพาะกิจ | `data-no-col-resize="true"` บน `<table>` | ตรวจที่ `:923` |
| ช่องตัวเลข | `data-num-cell="true"` | ติดโดย `fitNumericCellsInTable` |
| Return ของ hook | `resetWidths`, `autoFitWidths`, `isResized`, `getThProps` | มีจริง (`:609`, `:618`) ส่วนปุ่มสำเร็จรูปคือ `ResetColumnWidthsButton` (`:763`) |

## ตัวอย่าง (ตามแนว KMS ปรับตามชื่อจริง)
```tsx
const { getThProps, isResized, resetWidths, autoFitWidths } =
  useResizableColumns({ storageKey: "my_detail_grid", columns });
// th สุดท้าย
<th {...getThProps(5, "px-1.5 py-1.5 text-center")}>
  จัดการ
  <ResetColumnWidthsButton isResized={isResized} onReset={resetWidths} onAutoFit={autoFitWidths} />
</th>
```
(รูปแบบ `columns` ดู type `UseResizableColumnsOptions` ในไฟล์ — ตัวอย่างต้นฉบับใช้ `defaultWidths: [8,22,...]` ซึ่งไม่ตรงโค้ดปัจจุบัน)

## ไฟล์ที่อ้างแต่ไม่พบแล้ว
- `frontend/src/hooks/useResizableColumns.ts`, `frontend/src/components/transactions/TransItemGrid.tsx` — ไฟล์อ้างอิงไม่พบแล้ว (ของจริง `frontend/shared/ui/useResizableColumns.tsx`, `frontend/account/transaction/TransItemGrid.tsx`)
- `frontend/src/components/ui/RowMoveButtons.tsx` (re-export wrapper) — ไฟล์อ้างอิงไม่พบแล้ว

## ที่มา
- `docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md` Objective ข้อ 1–3, Workflow 1–2, Config, Limitation
- `.agents/skills/resizable-table-columns/SKILL.md` Workflow 1–3
- `AGENTS.md` กฎข้อ 18 (ป้ายข้อความและ UX ตาราง)

## ดูเพิ่ม
[[standards-overview]] · [[std-grid-row-reorder-add-row]] · [[std-input-controls-and-labels]] · [[std-screen-header-toolbar-theme]] · [[frontend-overview]]
