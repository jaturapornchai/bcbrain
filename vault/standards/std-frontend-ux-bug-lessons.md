---
title: "บทเรียนบั๊ก UX/หน้าจอธุรกรรม/Master/แท็บ MDI (Frontend UX Bug Lessons)"
tags: [standards, frontend, ux, lessons, bugs, transaction]
aliases: ["confirmDiscard", "แท็บซ่อนรับคีย์ลัด", "tabsApi.isActive", "Modal ซ้อน Esc", "loadDocument ซ้อน", "สลับแท็บโหลดผิดจอ", "screenKey", "todayLocal", "APPEARANCE_PREPAINT_SCRIPT", "doc_group approve_code"]
sources: ["docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", "frontend/shared/ui/Modal.tsx:35", "frontend/src/app/layout.tsx:62", "frontend/src/app/globals.css", "frontend/account/transaction/UniversalTransScreen.tsx", "frontend/account/transaction/StockBeginningBalanceScreen.tsx", "frontend/account/master/BcDataList.tsx", "frontend/account/master/BcLookupModal.tsx", "frontend/account/tabs/TabsContext.tsx"]
---

# บทเรียนบั๊ก UX/หน้าจอ (รอบตรวจ 2026-10-24)

ตารางบั๊กจริงที่แก้แล้ว พร้อมกฎสั้นๆ ที่ต้องจำเมื่อทำหน้าจอใหม่ ตัวเลข/เงินดู [[std-data-integrity-money-transactions]] ส่วนสิทธิ์/ความปลอดภัยดู [[std-security-lessons-idor]]

## Modal, Session และธีม
| รหัส | อาการ | กฎ/วิธีแก้ |
|---|---|---|
| U1 | โหมดมืด backdrop กลายเป็นสีขาว; Esc ปิด Modal ทุกชั้นพร้อมกัน | ใช้ `bg-slate-950/45`; stack `openModalStack` (`Modal.tsx:35`) ให้ Esc ปิดเฉพาะชั้นบนสุด |
| U2 | แบนเนอร์ session หมดอายุอ่าน `detail.error` แต่ api-client ส่ง `detail.message` | อ่าน `detail.message` ก่อน (`PersistentWorkspaceHost.tsx`) |
| U3 | ธีม/โหมดมืดใส่หลัง hydrate → กะพริบทุกครั้งที่รีเฟรช | สคริปต์ `APPEARANCE_PREPAINT_SCRIPT` ใน `<head>` (`layout.tsx:62`) — ดู [[std-motion-animation-rules]] |
| U4 | คลาส `animate-in fade-in-0 zoom-in-95` ใช้ 22 จุดแต่ไม่มีปลั๊กอิน → ไม่มี animation | ประกาศ `@utility animate-in/fade-in-0/zoom-in-95` ใน `globals.css` |
| U5 | `.bc-motion-card` ใช้ `animation … both` ค้าง transform → การ์ดเป็น containing block ของ fixed child | ใช้ `backwards` |
| D1 | Dashboard ค่าสำรองเป็นตัวเลขสมมติ | `?? 0` |

## หน้าจอธุรกรรม (`frontend/account/transaction/**`)
- **T1** ช่อง "กลุ่มเอกสาร" ผูกกับ `approveCode` ทำให้ `doc_group` ไม่เคยถูกบันทึก → ผูกกับ `docGroup` เท่านั้น
- **T2** (gl_journal) ไม่โหลด `book_code` ตอนเปิดเอกสาร → แก้ JV A แล้วเปิด JV B บันทึก book code เปลี่ยนเงียบๆ → โหลดค่าของเอกสารนั้นทุกครั้ง
- **T3** ลบแถวสินค้าชุดแต่แถวย่อย (`set_ref_line`) ค้างและถูกรวม → ลบแถวย่อยพร้อมกัน
- **T4** ปุ่ม "ค้นหาสินค้า" เขียนทับแถวสุดท้ายเสมอ → เพิ่มแถวใหม่ถ้าแถวสุดท้ายมีสินค้าแล้ว และอ่าน `itemLinesRef` ล่าสุด
- **T5** `loadDocument` (9 await) ไม่กันโหลดซ้อน → ผสมหัวเอกสาร B กับบรรทัด A แล้วบันทึกทับ → ตรวจ sequence หลังทุก `await`
- **T6** จอที่ซ่อนในแท็บ MDI ยังรับ F12/Esc/Insert → ตรวจ `tabsApi.isActive(menuKey)` และปิด hotkey ของรายการขณะ `isEditing` (หมายเหตุ: ห้ามใช้ F-keys เป็นปุ่มบนจอ ดู [[std-input-controls-and-labels]])
- **T7** ชื่อพนักงานขาย/แผนกเอกสารก่อนหน้าติดมาเอกสารใหม่, แก้เอกสารเดิมแล้วไม่โหลด GL/ภาษีใหม่, Rebuild GL ระหว่างแก้ไขทับข้อมูล → ล้าง/โหลดตามเอกสาร, reload หลังบันทึก, ซ่อนปุ่ม Rebuild ขณะแก้ไข
- **T8** วันที่ ISO/ค.ศ.ตายตัว, ใช้ `<input type="date">`, ยอดจำนวนทศนิยม 2 ตำแหน่งตายตัว → `formatBcDate()`, `DateBox`, `item_qty_decimal`, `CommaNumberInput`
- **T9** `ItemHistoryModal.tsx` join `ic_trans` ไม่มี `trans_flag` → join ด้วย `doc_no` + `trans_flag`
- ใบรับวางบิลกันซ้ำด้วย `DISTINCT ON`; `row_key` ฝั่ง client กันผล async ลงผิดแถว; ถามก่อนสลับเอกสารเมื่อแก้ค้าง (dirty snapshot)

## Master / แท็บ MDI / รายงาน
- **M1–M2** คีย์ลัด Insert/ลูกศร/Esc/Enter ในแท็บที่ซ่อนยังทำงาน → ไม่รับคีย์เมื่อ `rootRef.offsetParent === null` และ `BcDialog` ฟังช่วง capture + `stopPropagation`
- **M3** รายการที่ไม่ส่ง `listKey` ใช้คีย์ของแท็บที่ active → ใช้ `TabsContext.screenKey` ต่อแท็บ
- **M4** สแกนบาร์โค้ด + Enter ใน 200ms เลือกแถวแรกของผลเก่า → รอผลใหม่ก่อนเลือก (`BcLookupModal`)
- **M5** พิมพ์รหัสใหม่แล้วชื่อเก่าค้าง (`BcLookupInput`) → ค้นชื่อใหม่ทุกครั้งที่รหัสเปลี่ยน
- **M6** ปุ่ม `+` / Insert / ดินสอ / ดับเบิลคลิกทิ้งข้อมูลที่กำลังแก้โดยไม่ถาม → `confirmDiscard()` ทุกจอ master (ใช้ใน `CustomerScreen`, `DealerScreen`, `CustomerDetailScreen` ฯลฯ)
- **M7** จอที่รหัสเป็น Lookup แก้รหัสบนรายการเดิมแล้ว UPDATE ใช้รหัสใหม่ใน WHERE → รหัสเป็น read-only เมื่อไม่ใช่รายการใหม่ (เว้นแต่มี `rowKey`)
- **M8** ค่าเริ่มต้น "วันนี้" ใช้ `toISOString()` (UTC) ก่อน 07:00 ได้เมื่อวาน → `todayLocal()` (`numeric.ts`)
- **M9** `BuySaleInformationScreen` กรอง "เฉพาะมียอด" หลัง `LIMIT 100` → กรองใน SQL

## ที่มา
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ตาราง U1–U5, D1, T1–T9, M1–M9, รอบที่ 2

## ดูเพิ่ม
[[standards-overview]] · [[std-menu-workflow-cancel-lookup]] · [[std-screen-header-toolbar-theme]] · [[std-security-lessons-idor]] · [[frontend-overview]]
