---
title: "บั๊กตาราง/เลย์เอาต์ที่เคยถอยหลัง (Grid & Layout UX Regressions)"
tags: [history, grid, layout, ux]
aliases: ["scrollbar ซ้อน", "Section Cards แทน sub-tab", "resizer floor", "stale load seq"]
sources: ["git:70912a0a", "git:5e33f5c2", "git:77780f6e", "git:ab037624", "git:b9502e64", "git:33cf6477", "git:c33a8b55", "frontend/account/report/UniversalReportScreen.tsx:1003"]
---

## ภาพรวม
บั๊ก layout/ตาราง 22-26 ต.ค. 2026 หลังพอร์ตจอจาก C#: scrollbar ซ้อน, sub-tab ซ่อนข้อมูล, resizer รายงาน, หัวบิลล้นที่ 1366x768, ผลโหลดเก่าทับฟอร์มใหม่ เกิดซ้ำเพราะใช้ `flex-1 overflow-auto` ซ้อนชั้น และ flex child ไม่ใส่ `min-w-0`

## อาการ
- **A** หลายตารางมี scrollbar แนวตั้งซ้อนกัน 1.1.1/1.1.2/POS/MasterDetail ต้องคลิก sub-tab สลับ
- **B** รายงาน 27 คอลัมน์ ลากคอลัมน์แคบแล้วหดไม่ได้หรือกระโดด; handle ซ้อนสองชั้น (px ของ Global กับ % ของรายงาน)
- **C** ที่ 1366x768 ช่องรูปแบบเลขที่เอกสารถูกตัด, ช่องเอกสารอ้างอิงทับรหัสพนักงานขาย; ฟอร์มพิมพ์ล้นกรอบกระดาษ
- **D** กดเพิ่มใหม่ระหว่างรอโหลดแล้วฟอร์มถูกทับด้วยแถวแรก; DealerScreen ลบหลายรายการไม่ถามยืนยันและไม่เช็กผล; F2 ชนกันระหว่างตัวกรองรายการกับฟอร์ม; ติ๊ก DataList ค้างหลังยกเลิกลบ

## สาเหตุ (root cause)
- **A** wrapper ใน `TransExtraTabs`/`HiddenCostScreen` ตั้ง `flex-1 min-h-[..] overflow-auto` หรือ `max-h-[32vh] overflow-auto` ทุกชั้น และ `xl:grid-cols-2` ยัดหลายตารางคู่กัน
- **B** `5e33f5c2` ตั้ง floor `min(4, startPct)` คอลัมน์ที่เริ่มแคบกว่า 4% (เช่น 3.6%) จึงมี floor = ความกว้างเดิม หดไม่ได้เลย (ตัวอย่าง 3.6% คำนวณจากสูตร; ไม่พบข้อความ "3.6%" ใน handoff/TODO)
- **C** flex child ไม่มี `min-w-0`/`shrink-0` ช่อง readOnly `w-20` กินที่ ref-doc กับ sale-code อยู่แถว flex เดียว; กระดาษพิมพ์ไม่มี `overflow-x-hidden`
- **D** งานโหลดที่เริ่มก่อนกดเพิ่มใหม่ไม่ถูกยกเลิก (ไม่มีเลขลำดับงาน); `BcDataList` ดัก F2 โดยไม่ดูว่า focus อยู่ในฟอร์มนอกรายการ

## วิธีแก้
- **A** `70912a0a` เปลี่ยนเป็น `shrink-0` และ `space-y-3` (ตารางเรียงลงทีละอัน); `b9502e64` ให้ 1.1.1 render `sections` ทั้งหมดหน้าเดียว; `33cf6477` แปลง sub-tab เป็น Section Cards + แถบ Quick-Jump (`jumpToSection`)
- **B** `5e33f5c2` ติด `data-resizable-managed` บน table รายงาน (คอมเมนต์ใน commit: กัน GlobalTableColumnResizer ซ้อนทับ); `77780f6e` floor = `min(4, max(1.5, 50% ของความกว้างเริ่ม))` (3.6% -> 1.8%); `6e9ae03e` เพิ่ม `computeSmartTableColumnPcts` + ปุ่ม Auto-Fit/Reset
- **C** `ab037624` เติม `min-w-0`, `w-14 shrink-0`, จัด ref-doc/sale-code เป็น grid 2 คอลัมน์; `0dd8c834` กฎ anti-overflow ของ `[data-doc-form-paper]` + `overflow-hidden` บนกระดาษ FormDesigner
- **D** `bd834b16` เพิ่ม confirm ก่อนลบหลายรายการ + แสดง error; `c33a8b55` เพิ่ม `loadSeq`/`docLoadSeq` ทิ้งผล stale และให้ F2 เมินเมื่อ focus อยู่ input นอก `rootRef`; `5435180b` เพิ่ม `newSeq` และล้างติ๊กเฉพาะ id ที่หายไป

## commit ที่เกี่ยวข้อง
- `5e33f5c2`, `77780f6e` (22 ต.ค.) — floor/handle resizer รายงาน; `ab037624` — TransTopForm 1366x768; `b9502e64` — 1.1.1 หน้าเดียว (BCAIACC-106)
- `bd834b16`, `c33a8b55`, `5435180b` (22 ต.ค.) — master UI: confirm ลบ, stale guard, F2, ติ๊ก
- `33cf6477` (23 ต.ค.) — Section Cards; `6e9ae03e`, `70912a0a` (24 ต.ค.) — auto-fit, ถอด scrollbar ซ้อน; `0dd8c834` (26 ต.ค.) — กระดาษฟอร์มไม่ล้น

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/account/report/UniversalReportScreen.tsx:1003` floor resizer; `:1668` `data-resizable-managed`
- `frontend/shared/ui/useResizableColumns.tsx:79` `computeSmartTableColumnPcts`, `:836` `GlobalTableColumnResizer`
- `frontend/account/transaction/TransTopForm.tsx:186,216,397` `min-w-0`, `w-14 shrink-0`, grid ref-doc
- `frontend/account/transaction/TransExtraTabs.tsx:198,575,689` การ์ด `shrink-0`; `frontend/account/config/CompanyProfileForm.tsx:210`
- `frontend/account/master/DocFormatScreen.tsx:267`, `frontend/account/transaction/UniversalTransScreen.tsx:727` ลำดับโหลด; `frontend/account/master/BcDataList.tsx:269,574` `rootRef` + ไม่รับคีย์เมื่อแท็บซ่อน
- `frontend/src/app/globals.css:2235` กฎกระดาษฟอร์ม (หัวข้อถูกขยายเป็น "Anti-Overflow & Pure-White")
- ตัวจัดการ F2 ใน BcDataList ถูก `b9c13081` (Button-Only) ลบแล้ว

## บทเรียน / กฎที่ได้
- ห้ามซ้อน `overflow-auto` หลายชั้น: ชั้นในใช้ `shrink-0` ให้ชั้นนอกเลื่อนเดียว; หลายตาราง = วางเรียงลง ไม่ใช่ sub-tab
- flex/grid child ที่มี input ต้อง `min-w-0`; ช่อง readOnly รหัสสั้น `shrink-0`; ทดสอบที่ 1366x768
- ทุก async load ในจอ master/transaction ต้องมี sequence ref และเช็กหลังทุก `await`; กดเพิ่มใหม่ต้องยกเลิกงานโหลดค้าง
- floor ของ resizer ต้องอิงความกว้างเริ่ม; เปิดค้าง: handoff `REPORT-RESIZER-OVERLAY-b` (ลาก th 59->59px) รอ verify เทียบ C#; ลบหลายรายการต้องยืนยันและอ่าน `res.ok`

## ดูเพิ่ม
[[std-grid-autofit-reset]] · [[std-grid-row-reorder-add-row]] · [[fe-grid-component]] · [[fe-standard-master-screen]] · [[std-frontend-ux-bug-lessons]] · [[hist-lessons-hidden-tab-hotkeys-dirty-guard]] · [[hist-lessons-report-engine-parity]] · [[hist-lessons-thai-text-pdf]] · [[history-overview]]

## ที่มาในโค้ด
- git: ทุก SHA ข้างต้น (ตรวจ diff แล้ว) + `b9c13081`; `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` (§3, §7)
