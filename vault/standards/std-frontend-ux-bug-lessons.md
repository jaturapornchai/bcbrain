---
title: "บทเรียนบั๊ก UX/หน้าจอธุรกรรม/Master/แท็บ MDI (Frontend UX Bug Lessons)"
tags: [standards, frontend, ux, lessons, bugs, transaction]
aliases: ["confirmDiscard", "แท็บซ่อนรับคีย์ลัด", "tabsApi.isActive", "Modal ซ้อน Esc", "loadDocument ซ้อน", "สลับแท็บโหลดผิดจอ", "screenKey", "todayLocal", "APPEARANCE_PREPAINT_SCRIPT", "doc_group approve_code"]
sources: ["docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:42-47", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:52-60", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:58", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:65-73", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:75-79", "frontend/shared/ui/Modal.tsx:35", "frontend/shared/ui/Modal.tsx:83", "frontend/shared/layout/PersistentWorkspaceHost.tsx:335", "frontend/src/app/layout.tsx:62", "frontend/src/app/layout.tsx:95", "frontend/src/app/globals.css:1473-1475", "frontend/src/app/globals.css:2080", "frontend/account/transaction/TransTopForm.tsx:628", "frontend/account/transaction/UniversalTransScreen.tsx:544", "frontend/account/transaction/UniversalTransScreen.tsx:671", "frontend/account/transaction/UniversalTransScreen.tsx:2966", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:133", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:473-477", "frontend/account/transaction/ItemHistoryModal.tsx:52", "frontend/account/master/BcDataList.tsx:588", "frontend/account/master/BcDialog.tsx:94-103", "frontend/account/master/BcLookupModal.tsx:314-320", "frontend/account/master/StandardMasterScreen.tsx:456", "frontend/account/master/StandardMasterScreen.tsx:1310", "frontend/account/tabs/TabsContext.tsx:25", "frontend/account/report/BuySaleInformationScreen.tsx:74-82", "frontend/src/lib/numeric.ts:137"]
---

# บทเรียนบั๊ก UX/หน้าจอ (รอบตรวจ 2026-10-24)

ตารางบั๊กจริงที่แก้แล้วใน `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` พร้อมกฎสั้นๆ ที่ต้องจำเมื่อทำหน้าจอใหม่ โน้ตนี้ตรวจแต่ละข้อกับโค้ดปัจจุบันแล้ว ข้อที่ตรวจไม่ได้ระบุไว้ท้ายข้อ ตัวเลข/เงินดู [[std-data-integrity-money-transactions]] ส่วนสิทธิ์/ความปลอดภัยดู [[std-security-lessons-idor]]

## Modal, Session และธีม
| รหัส | อาการ | กฎ/วิธีแก้ (ตรวจกับโค้ดแล้ว) |
|---|---|---|
| U1 | โหมดมืด backdrop กลายเป็นสีขาว; Esc ปิด Modal ทุกชั้นพร้อมกัน | backdrop ใช้ `bg-slate-950/45` (`Modal.tsx:83`); stack `openModalStack` (`Modal.tsx:35`) ให้ Esc ปิดเฉพาะชั้นบนสุด |
| U2 | แบนเนอร์ session หมดอายุอ่าน `detail.error` แต่ api-client ส่ง `detail.message` | อ่าน `detail?.message` ก่อน แล้ว `detail?.error` (`PersistentWorkspaceHost.tsx:335`) |
| U3 | ธีม/โหมดมืดใส่หลัง hydrate → กะพริบทุกครั้งที่รีเฟรช | สคริปต์ `APPEARANCE_PREPAINT_SCRIPT` ประกาศที่ `layout.tsx:62` และฝังใน `<head>` ที่ `:95` — ดู [[std-motion-animation-rules]] |
| U4 | คลาส `animate-in fade-in-0 zoom-in-95` ใช้หลายจุดแต่ไม่มีปลั๊กอิน → ไม่มี animation | ประกาศ `@utility animate-in` / `fade-in-0` / `zoom-in-95` ใน `globals.css` (เริ่ม `:2080`) |
| U5 | `.bc-motion-card` ใช้ `animation … both` ค้าง transform → การ์ดเป็น containing block ของ fixed child | ใช้ fill-mode `backwards` (`globals.css:1473-1475`) |
| D1 | Dashboard ค่าสำรองเป็นตัวเลขสมมติ | `?? 0` — รายละเอียดใน [[std-data-integrity-money-transactions]] |

## หน้าจอธุรกรรม (`frontend/account/transaction/**`)
- **T1** ช่อง "กลุ่มเอกสาร" เคยผูกกับ `approveCode` ทำให้ `doc_group` ไม่ถูกบันทึก — ตอนนี้ช่องกลุ่มเอกสารผูก `extra.docGroup` (`TransTopForm.tsx:628`) แยกจากช่อง `approveCode` (`:362`)
- **T2** (gl_journal) ต้องโหลด `book_code` ของเอกสารนั้นทุกครั้งที่เปิด ไม่งั้นแก้ JV A แล้วเปิด JV B บันทึกแล้ว book code เปลี่ยนเงียบๆ — ตรวจในโค้ดแล้วว่ามีการอ่าน `book_code` ตอนโหลดเอกสาร (`UniversalTransScreen.tsx:1261`) แต่ไม่ได้ทดสอบสถานการณ์สลับเอกสาร
- **T3** ลบแถวสินค้าชุดแล้วแถวย่อย (`set_ref_line`) ต้องถูกลบด้วย — field มีใน `UniversalTransScreen.tsx:317`, `:385`
- **T4** ปุ่ม "ค้นหาสินค้า" ต้องอ่านแถวล่าสุดผ่าน `itemLinesRef` (`UniversalTransScreen.tsx:671`) ไม่ใช่ state เก่า
- **T5** `loadDocument` ของใบยอดยกมาป้องกันโหลดซ้อนด้วยตัวนับ `loadSeq` — เพิ่มลำดับแล้วเทียบ `stale()` หลังทุก `await` (`StockBeginningBalanceScreen.tsx:473-477`, ยกเลิกโหลดค้างตอนเริ่มเอกสารใหม่ที่ `:905`)
- **T6** จอที่ซ่อนในแท็บ MDI ต้องไม่รับ F12/Esc/Insert — `UniversalTransScreen` ตรวจ `tabsApi.isActive(effective.menuKey)` (`:544`) และ `StockBeginningBalanceScreen` ตรวจ `tabsApi.isActive("menu_ic_stk_balance")` (`:133`) (ห้ามใช้ F-keys เป็นปุ่มบนจอ ดู [[std-input-controls-and-labels]])
- **T7** ชื่อพนักงานขาย/แผนกของเอกสารก่อนหน้าไม่ควรติดมาเอกสารใหม่, แก้เอกสารเดิมต้องโหลด GL/ภาษีใหม่, ห้าม Rebuild GL ขณะแก้ไข — KMS บันทึกไว้ (`KMS…:58`) แต่ไม่ได้ไล่ตรวจโค้ดรายข้อ
- **T8** ใช้ `formatBcDate()` และ `DateBox` แทน ISO/`<input type="date">` และทศนิยมตาม `item_qty_decimal` (ดู [[std-ux-buddhist-year-bilingual]]); KMS เอ่ยชื่อ `CommaNumberInput` แต่ใน `frontend/` พบเฉพาะในจอ POS และ Report Designer ไม่ใช่ในโฟลเดอร์ transaction
- **T9** `ItemHistoryModal.tsx` join `ic_trans` ด้วย `doc_no` **และ** `trans_flag` (`:52`) เพราะเลขที่เดียวกันซ้ำข้าม flag ได้
- ใบรับวางบิลกันซ้ำด้วย `DISTINCT ON`, `row_key` ฝั่ง client กันผล async ลงผิดแถว, ถามก่อนสลับเอกสารเมื่อแก้ค้าง (dirty snapshot) — `UniversalTransScreen` มี `confirmDiscard` ของตัวเอง (`:2966`)

## Master / แท็บ MDI / รายงาน
- **M1–M2** ไม่รับคีย์ลัดในแท็บที่ซ่อน: `BcDataList` คืนทันทีเมื่อ `rootRef.current.offsetParent === null` (`:588`) และ `BcDialog` ฟัง Esc/Enter ช่วง capture แล้ว `stopPropagation` ไม่ทำงานในแท็บที่ซ่อน (`:94-103`)
- **M3** รายการต้องใช้คีย์ของจอตัวเอง: `TabsContext` มี `screenKey?` ต่อแท็บ (`TabsContext.tsx:25`)
- **M4** สแกนบาร์โค้ด + Enter ต้องรอผลใหม่ก่อนเลือกแถวแรก (`BcLookupModal.tsx:314-320`; ดู [[std-menu-workflow-cancel-lookup]])
- **M5** พิมพ์รหัสใหม่แล้วชื่อเก่าต้องไม่ค้าง (`BcLookupInput.tsx`) → ค้นชื่อใหม่ทุกครั้งที่รหัสเปลี่ยน (ไม่ได้ไล่ตรวจเป็นรายบรรทัด)
- **M6** ปุ่ม `+` / Insert / ดินสอ / ดับเบิลคลิกต้องถามก่อนทิ้งข้อมูลที่แก้ค้าง — **ไม่มีฟังก์ชันกลาง** แต่ละจอ master ประกาศฟังก์ชันของตัวเองและชื่อไม่เหมือนกัน: `confirmDiscardIfDirty` (เช่น `EmployeeScreen.tsx:275`, `CustomerScreen.tsx:265`, `ItemScreen.tsx:1806`, `UnitScreen.tsx:186`) หรือ `confirmDiscard` (เช่น `StandardMasterScreen.tsx:456`, `DealerScreen.tsx:275`, `DocFormatScreen.tsx:459`) จอใหม่ต้องใส่เองทุกครั้ง
- **M7** จอที่รหัสเป็น Lookup ต้องล็อกรหัสเมื่อไม่ใช่รายการใหม่ (เว้นแต่มี `rowKey`): `StandardMasterScreen` ตั้ง `disabled={!isEditing || (!isNew && !config.rowKey)}` (`:1310`)
- **M8** ค่าเริ่มต้น "วันนี้" ใช้ `todayLocal()` (`numeric.ts:137`) ไม่ใช่ `toISOString()` (UTC ก่อน 07:00 ได้เมื่อวาน)
- **M9** `BuySaleInformationScreen` กรอง "เฉพาะมียอด" ใน SQL ก่อน `LIMIT 100` (`:74-82`)

## ที่มา
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:42-47` (U1–U5, D1), `:52-60` (T1–T9), `:65-73` (M1–M9), `:75-79` (รอบที่ 2)
- โค้ดตามรายการ `sources` (ตรวจแล้วมีจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-menu-workflow-cancel-lookup]] · [[std-screen-header-toolbar-theme]] · [[std-security-lessons-idor]] · [[frontend-overview]]
