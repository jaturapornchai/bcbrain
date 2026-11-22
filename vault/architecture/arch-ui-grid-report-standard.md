---
title: "มาตรฐาน UI, Design System, Resizable Grid & Central Report Engine"
audience: dev
tags: [architecture, frontend, ui, grid, report, pdf, design-system]
aliases: ["UI Standard BC", "useResizableColumns", "BcDataList", "UniversalReportScreen", "GlobalReportPrintModal", "2-Row Toolbar"]
sources: ["AGENTS.md:1-66", "frontend/src/app/globals.css:1-75", "frontend/shared/ui/useResizableColumns.tsx:7-915", "frontend/account/master/StockToolBits.tsx:80-168", "frontend/account/master/simpleGridPagination.ts:1-33", "frontend/account/master/BcDataList.tsx:1-70", "frontend/account/report/UniversalReportScreen.tsx:1-75", "frontend/account/report/GlobalReportPrintModal.tsx:1-110", "frontend/shared/layout/MenuBar.tsx:1-70", "frontend/src/lib/numeric.ts:1-66"]
---

ส่วนติดต่อผู้ใช้ (Frontend) ของ **BC Ai Account** บน Next.js + Tailwind CSS v4 ถูกวางมาตรฐานกลางแบบ **Global-First Design System** เพื่อให้ทุกหน้าจอ ข้อมูลหลัก รายการรายวัน และรายงาน มีพฤติกรรมเดียวกัน 100%

---

## 1. กฎเหล็ก UX/UI ระดับระบบ (`AGENTS.md:1-66`)

1. **2-Row Standard Toolbar**: หน้าจอทำรายการและ Master ใช้ Toolbar สองแถวแยกโหมดชัดเจนระหว่าง `!isEditing` (ดู/เพิ่ม/แก้ไข/ลบ/นำเข้า/พิมพ์) กับ `isEditing` (บันทึก/ยกเลิก/คำนวณ) และจัดวางองค์ประกอบให้อยู่ระนาบ Baseline และกึ่งกลางแนวนอนเดียวกันเสมอ
2. **No Web Hotkeys**: บน Web Browser ห้ามผูก F-key/Shortcut ชนกับเบราว์เซอร์ (เช็กผ่าน `isNativeDesktopRuntime()`)
3. **NumberBox Blank Zero (`numeric.ts`)**: ค่าศูนย์ (`0` หรือ `0.00`) ใน Grid และรายงานจะถูกซ่อนเป็นช่องว่าง `""` เพื่อความสบายตา แต่เก็บ/ส่งค่าเลขฐานสิบจริงเป็น String เท่านั้น
4. **Calendar `year_type`**: `DateBox` และรายงานอ่านค่า `erp_option.year_type` (`0` = ค.ศ., `1` = พ.ศ.) แปลงแสดงผลบนจอ แต่ส่งและเก็บใน PostgreSQL เป็น ISO Gregorian `YYYY-MM-DD` เสมอ

---

## 2. Design System & Theme Engine (`frontend/src/app/globals.css`)

- ผูก Tailwind v4 `@custom-variant dark` เข้ากับ `html[data-mode="dark"]` เพื่อไม่ให้ตั้งค่า Dark Mode ของ OS ไปทับธีมสว่างของโปรแกรมบัญชีโดยไม่ได้ตั้งใจ
- รองรับ **10 ธีมสี** (`data-theme`): `royal-blue`, `emerald-wealth`, `graphite-gold`, `purple-amethyst`, `ocean-teal`, `crimson-ruby`, `sunset-amber`, `sakura-rose`, `midnight-pro`, `bc-classic`
- รองรับ **5 ฟอนต์ภาษาไทย** (`data-font`): `prompt`, `sarabun`, `ibm-plex`, `kanit`, `noto` พร้อมซูมขนาดตัวอักษร `80%–140%` (`--bc-font-zoom`)

---

## 3. มาตรฐานตารางยืดหดได้ 100% (`useResizableColumns.tsx`)

คอมโพเนนต์ `frontend/shared/ui/useResizableColumns.tsx` กำหนดมาตรฐานกลางสำหรับตารางทุกหน้าจอในระบบ:

- **100%-Width Proportional Layout**: ความกว้างทุกคอลัมน์คำนวณเป็น **สัดส่วน `%` รวมกันได้ `100.00%` เสมอ** เพื่อแสดงผลเต็มหน้าจอและ **ไม่มี Horizontal Scrollbar** ล้นซ้าย-ขวา
- **Thai Visual Width Calculation (`visualTextLength`, `computeSmartTableColumnPcts`)**: ตัดสระบน/ล่างและวรรณยุกต์ไทย (`\u0E31`, `\u0E34-\u0E3A`, `\u0E47-\u0E4E`) ออกจากความยาวสายตาเพื่อคำนวณความกว้างอัตโนมัติ (Auto-Fit) จากข้อมูลจริงใน `tbody` และหัวตารางได้พอดีกับภาษาไทย
- **Drag Resize + Auto Responsive + Reset + Header Refresh**:
  - กดเมาส์ค้างที่ขอบ `ColumnResizeHandle` เลื่อนปรับซ้าย-ขวาได้ทันที และปรับสัดส่วนอัตโนมัติเมื่อขนาดหน้าจอเปลี่ยน
  - มีปุ่ม `ResetColumnWidthsButton` สำหรับคืนค่าความกว้างตั้งต้น
  - รองรับ `onHeaderRefresh` เมื่อคลิกหัวตารางเพื่อ Query/Refresh ข้อมูลใหม่
  - มี `GlobalTableColumnResizer` ช่วยอัปเกรดตารางภายใน `.account-workspace` ให้รองรับความสามารถนี้ทั่วทั้งระบบ โดยแยก pass อ่านขนาด Layout (`clientWidth`/`scrollWidth`) ใน `fitNumericCellsInTable` และแคช `data-last-fit-key` เพื่อลดการคำนวณ Reflow ซ้ำเมื่อข้อมูลและความกว้างตารางไม่เปลี่ยน
- **Auto Pagination (`SimpleGrid` + `paginateRows`)**: ตารางเครื่องมือมาตรฐาน (`StockToolBits.tsx`, `simpleGridPagination.ts`) แบ่งหน้าแสดงผลอัตโนมัติ (ค่าเริ่มต้น `pageSize = 100`) เมื่อมีข้อมูลจำนวนมาก โดยไม่แก้ไขอ้างอิงอาร์เรย์ต้นทาง
- **Config Persistence**: `BcDataList.tsx` โหลดและบันทึกความกว้าง/ลำดับคอลัมน์ของผู้ใช้ลง DB ผ่าน `/process/master/datalistget` และ `/process/master/datalistsave` พร้อมการค้นหาไทยอัจฉริยะ (`thai-search.ts`)

---

## 4. Central Report UI & PDF Engine (`UniversalReportScreen.tsx`, `GlobalReportPrintModal.tsx`)

- **Universal Report Screen**: หน้าจอรายงานกลางที่รองรับ Report Menu กว่า 300 รายการจาก Backend (`runBackendReport`), ส่งออก Excel, Group Hierarchy (`ReportGroupNodeDTO`), แสดง SQL สำหรับ Studio และคลิกเจาะลึกไปเอกสารต้นทาง (`openSourceDocument` + `classifyReportDrillColumn`)
- **Print & PDF Studio (`GlobalReportPrintModal.tsx`)**:
  - ตั้งค่าหน้ากระดาษ (`A4`, `A3`, `Letter`, `Legal`, `A5`, `Continuous`), แนวตั้ง/แนวนอน, ขนาดตัวอักษร, 6 Print Themes (`bc_emerald`, `corporate_navy`, `executive_amber`, `modern_indigo`, `crimson_ledger`, `minimal_clean`), หัวบริษัท, ลายเซ็น และรองรับเลือกภาษารายงาน `ไทย/English` แยกจากภาษาหน้าจอหลัก
  - พิมพ์เป็น PDF ผ่าน Backend (`fetchBackendReportPdf` -> `/process/report/pdf`) และบันทึกเทมเพลตไว้ใน `erp_report_template`
