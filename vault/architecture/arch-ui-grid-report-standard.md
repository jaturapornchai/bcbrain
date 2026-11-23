---
title: "มาตรฐาน UI, Design System, Resizable Grid & Central Report Engine"
audience: dev
tags: [architecture, frontend, ui, grid, report, pdf, design-system]
aliases: ["UI Standard BC", "useResizableColumns", "BcDataList", "UniversalReportScreen", "GlobalReportPrintModal", "2-Row Toolbar"]
sources: ["AGENTS.md:1-66", "frontend/src/app/globals.css:1-75", "frontend/shared/ui/DateBox.tsx:44-485", "frontend/shared/ui/useResizableColumns.tsx:7-915", "frontend/account/transaction/DocHeaderFirstRow.tsx:1-150", "frontend/account/transaction/transLayouts.ts:470-499", "frontend/account/transaction/TransItemGrid.tsx:205-225", "frontend/account/master/StockToolBits.tsx:72-185", "frontend/account/master/simpleGridPagination.ts:1-47", "frontend/account/master/BcDataList.tsx:1-70", "frontend/account/report/UniversalReportScreen.tsx:1-75", "frontend/account/report/GlobalReportPrintModal.tsx:1-110", "frontend/shared/components/GlobalDocFormPrintModal.tsx:660-870", "frontend/shared/components/doc-print/docFormColumns.ts:1-640", "frontend/shared/components/doc-print/lockedFormTemplates.ts:50-1030", "frontend/shared/layout/MenuBar.tsx:1-70", "frontend/src/lib/numeric.ts:1-66"]
---

ส่วนติดต่อผู้ใช้ (Frontend) ของ **BC Ai Account** บน Next.js + Tailwind CSS v4 ถูกวางมาตรฐานกลางแบบ **Global-First Design System** เพื่อให้ทุกหน้าจอ ข้อมูลหลัก รายการรายวัน และรายงาน มีพฤติกรรมเดียวกัน 100%

---

## 1. กฎเหล็ก UX/UI ระดับระบบ (`AGENTS.md:1-66`)

1. **2-Row Standard Toolbar**: หน้าจอทำรายการและ Master ใช้ Toolbar สองแถวแยกโหมดชัดเจนระหว่าง `!isEditing` (ดู/เพิ่ม/แก้ไข/ลบ/นำเข้า/พิมพ์) กับ `isEditing` (บันทึก/ยกเลิก/คำนวณ) และจัดวางองค์ประกอบให้อยู่ระนาบ Baseline และกึ่งกลางแนวนอนเดียวกันเสมอ
2. **No Web Hotkeys**: บน Web Browser ห้ามผูก F-key/Shortcut ชนกับเบราว์เซอร์ (เช็กผ่าน `isNativeDesktopRuntime()`)
3. **NumberBox Blank Zero (`numeric.ts`)**: ค่าศูนย์ (`0` หรือ `0.00`) ใน Grid และรายงานจะถูกซ่อนเป็นช่องว่าง `""` เพื่อความสบายตา แต่เก็บ/ส่งค่าเลขฐานสิบจริงเป็น String เท่านั้น
4. **Calendar `year_type` & Custom Thai DateBox (`DateBox.tsx`)**: `DateBox` และรายงานอ่านค่า `erp_option.year_type` (`0` = ค.ศ., `1` = พ.ศ.) แปลงแสดงผล `DD/MM/YYYY` บนจอ แต่ส่งและเก็บใน PostgreSQL เป็น ISO Gregorian `YYYY-MM-DD` เสมอ โดย `DateBox` ใช้ปฏิทิน Popover ภาษาไทยผ่าน React Portal (เลือกเดือน/ปีตาม `year_type`, ปุ่มวันนี้/ปิด, บล็อกตัวอักษรและแจ้ง `"ป้อนวันที่ผิดพลาด"` เมื่อกรอกผิด) และแยก `onChange` ออกจาก `onCommit` (ยิงเฉพาะเมื่อคลิกวันในปฏิทิน กด Enter หรือ Blur หลังกรอกครบ — ใช้ร่วมกับ `DocHeaderFirstRow`/`TransTopForm`/`UniversalTransScreen` เพื่อถามยืนยันรันเลขที่เอกสารใหม่เฉพาะหลังเลือกวันที่เสร็จสมบูรณ์)
5. **Transaction Layout & Credit Pay-Tab Guard (`transLayouts.ts`, `TransItemGrid.tsx`)**: `getTransLayout` คุมการแสดงคอลัมน์รายเอกสาร (เช่น ใบเบิกสินค้า `trans_flag = 56` ตั้ง `showPrice = false` และ `showSumAmount = false` -> `hideSumAmount`) และ `isPayTabEnabled(transFlag, inquiryType)` คุมสิทธิ์เปิดแท็บรับ/จ่ายชำระเงินให้ตรงกับ `pay_check.go:payTabEnabled` (ปิดแท็บอัตโนมัติเมื่อเป็นรายการเงินเชื่อ/เครดิต)

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
- **Auto Pagination (`SimpleGrid` + `paginateRows` / `resolvePageForRows`)**: ตารางเครื่องมือมาตรฐาน (`StockToolBits.tsx`, `simpleGridPagination.ts`) แบ่งหน้าแสดงผลอัตโนมัติ (ค่าเริ่มต้น `pageSize = 100`) เมื่อมีข้อมูลจำนวนมาก โดยไม่แก้ไขอ้างอิงอาร์เรย์ต้นทาง, รีเซ็ตกลับหน้า 1 อัตโนมัติเมื่อชุดข้อมูลเปลี่ยนผ่าน `resolvePageForRows` (หรือกำหนด `resetPageOnRowsChange={false}` เพื่อคงหน้าเดิมระหว่างแก้ไขค่าในแถว เช่น `SerialStockCountScreen`), และแปลข้อความแถบแบ่งหน้า 3 ภาษา (`ui.pagination_showing_range`, `ui.pagination_prev`, `ui.pagination_page_of`, `ui.pagination_next`) ผ่าน `langText` + `useLanguagePack` พร้อมใส่ `data-no-translate="true"` กัน DOM Translator แปลซ้ำ
- **Config Persistence**: `BcDataList.tsx` โหลดและบันทึกความกว้าง/ลำดับคอลัมน์ของผู้ใช้ลง DB ผ่าน `/process/master/datalistget` และ `/process/master/datalistsave` พร้อมการค้นหาไทยอัจฉริยะ (`thai-search.ts`)

---

## 4. Central Report UI, Doc Form Print & PDF Engine (`UniversalReportScreen.tsx`, `GlobalReportPrintModal.tsx`, `GlobalDocFormPrintModal.tsx`)

- **Universal Report Screen**: หน้าจอรายงานกลางที่รองรับ Report Menu กว่า 300 รายการจาก Backend (`runBackendReport`), ส่งออก Excel, Group Hierarchy (`ReportGroupNodeDTO`), แสดง SQL สำหรับ Studio และคลิกเจาะลึกไปเอกสารต้นทาง (`openSourceDocument` + `classifyReportDrillColumn`)
- **Print & PDF Studio (`GlobalReportPrintModal.tsx`)**:
  - ตั้งค่าหน้ากระดาษ (`A4`, `A3`, `Letter`, `Legal`, `A5`, `Continuous`), แนวตั้ง/แนวนอน, ขนาดตัวอักษร, 6 Print Themes (`bc_emerald`, `corporate_navy`, `executive_amber`, `modern_indigo`, `crimson_ledger`, `minimal_clean`), หัวบริษัท, ลายเซ็น และรองรับเลือกภาษารายงาน `ไทย/English` แยกจากภาษาหน้าจอหลัก
  - พิมพ์เป็น PDF ผ่าน Backend (`fetchBackendReportPdf` -> `/process/report/pdf`) และบันทึกเทมเพลตไว้ใน `erp_report_template`
- **Global Document Form Print (`GlobalDocFormPrintModal.tsx`, `docFormColumns.ts`, `lockedFormTemplates.ts`)**:
  - รองรับ 5 โหมดภาษาแบบฟอร์ม (`DocFormLangMode`: `"th" | "en" | "both" | "lo" | "lo_en"`) จำค่าผ่าน `localStorage` (`bc_doc_form_last_lang_v1`) แยกตามเมนู/global และซิงก์ตามภาษาหลักของแอป (`resolveDocFormInitialLangMode`, `mapAppLangToDocFormLang`), แยกหัวตาราง 2 บรรทัดในโหมดคู่ภาษาโดยไม่ต่อคำอังกฤษซ้ำ (`resolveDocTableColHeaderParts`) และแปลป้ายลายเซ็นผ่าน `SIG_LABEL_CODE` (`pickSignatureLabel`)
  - จำแนกโปรไฟล์คอลัมน์ฟอร์มอัตโนมัติ 9 หมวด (`classifyDocFormCategory` / `getDocFormColumnProfile`: `inventory`, `deposit`, `bills`, `expense`, `income`, `header_amount`, `gl_journal`, `cash_bank`, `cheque`) โดยเอกสารที่ไม่ใช่สินค้าไม่สืบทอดการตั้งค่าคอลัมน์จาก `__GLOBAL__`, โหลดรายการมัดจำ (`DEPOSIT_FORM_FLAGS`) จาก `ap_ar_trans_detail` และสร้างแถวสรุปยอดสำหรับเอกสารหัวบิล (`HEADER_AMOUNT_FORM_FLAGS`)
  - แม่แบบฟอร์มมาตรฐานใน `lockedFormTemplates.ts` แยกป้ายคู่ค้า (`partyLabelTh`/`partyLabelEn`) และป้ายช่องลงนาม (`sigLeftTh`/`sigLeftEn`, `sigRightTh`/`sigRightEn`) ออกจากกันครบทุกแม่แบบเพื่อไม่ให้ซ้ำซ้อนในโหมดภาษาอังกฤษล้วนหรือ 2 ภาษา และ `formatSmlDocRunningPreview` รองรับตัวแทนรหัสสาขา `@system_branch_code@`
