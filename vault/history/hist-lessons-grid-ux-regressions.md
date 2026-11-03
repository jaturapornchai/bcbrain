---
title: "บทเรียนตาราง/เลย์เอาต์ที่ถอยหลังง่าย (Grid & Layout UX Regressions)"
tags: [history, lesson, grid, layout, ux]
aliases: ["resizer floor", "stale load seq", "min-w-0 shrink-0", "overWide", "กระดาษฟอร์มล้น", "ลบแล้วไม่ถาม"]
sources: ["frontend/account/report/UniversalReportScreen.tsx:960", "frontend/account/report/UniversalReportScreen.tsx:1009", "frontend/account/report/UniversalReportScreen.tsx:1041", "frontend/account/report/UniversalReportScreen.tsx:1675", "frontend/account/transaction/TransTopForm.tsx:188", "frontend/account/transaction/TransTopForm.tsx:218", "frontend/account/transaction/TransExtraTabs.tsx:198", "frontend/account/master/DocFormatScreen.tsx:312", "frontend/account/transaction/UniversalTransScreen.tsx:1210", "frontend/account/master/DealerScreen.tsx:433", "frontend/src/app/globals.css:2254", "docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:18"]
---

# บทเรียนตาราง/เลย์เอาต์ที่ถอยหลังง่าย

หน้าจอที่มีหลายตาราง ตัวลากคอลัมน์ และงานโหลดแบบ async พังซ้ำได้ง่ายถ้าลืมกฎเล็กๆ ของ flex/grid และลำดับงานโหลด หน้านี้รวมกับดักที่มีด่านป้องกันอยู่ในโค้ดวันนี้

## อะไรพังได้
- **ตัวลากคอลัมน์รายงานหดไม่ได้/กระโดด**: รายงานที่มีคอลัมน์เยอะ (บางคอลัมน์แคบกว่า 4%) ถ้าตั้งเพดานล่างตายตัวที่ 4% คอลัมน์ที่เริ่มแคบอยู่แล้วจะลากเข้าไม่ได้ หรือกระโดด
- **ตารางกว้างเกินจอถูกบีบกลับเป็น 100%**: ลากขอบคอลัมน์แล้ว normalize ผลรวมกลับ 100% ทำให้ตารางหดทั้งแผ่น
- **ตัวลากซ้อนสองชั้น**: ตัวลากกลางแบบ px ไปทับตัวลากแบบ % ของรายงาน
- **ช่องในหัวบิลล้น/ทับกัน** ที่จอ 1366x768: flex child ที่มี input ไม่มี `min-w-0` หรือช่องอ่านอย่างเดียวไม่มี `shrink-0`
- **กระดาษพิมพ์ฟอร์มล้นกรอบ** เมื่อข้อความหรือตารางยาวเกินความกว้างกระดาษ
- **ผลโหลดเก่าทับฟอร์มใหม่**: กดเพิ่มใหม่ระหว่างรอโหลดเอกสารเดิม แล้วโหลดเสร็จทีหลังเขียนทับ
- **ลบแล้วไม่ถามหรือไม่เช็กผล**: ปุ่มลบที่ยิงคำสั่งทันทีและไม่อ่าน `res.ok`

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| เพดานล่างตัวลากรายงาน | `frontend/account/report/UniversalReportScreen.tsx:1009-1013` | `min(4, max(1.5, ครึ่งหนึ่งของความกว้างเริ่ม))` คอลัมน์แคบจึงยังหดได้ (คอมเมนต์ `:1009-1011` อธิบายเหตุผล) |
| ไม่บีบกลับ 100% เมื่อกว้างเกินจอ | `UniversalReportScreen.tsx:960` (`overWide`), `:1041` | ลากเสร็จ ถ้า `overWide` เก็บค่าเดิม ไม่เรียก `normalizeColumnOverridesWidthPct` |
| คิด % จากกรอบเลื่อน | `UniversalReportScreen.tsx:993` | ใช้ `clientWidth` ของกรอบเลื่อน ไม่ใช่ความกว้างตารางที่ยาวเกินจอ |
| ตารางรายงานคุมตัวลากเอง | `UniversalReportScreen.tsx:1675-1678` | ติด `data-resizable-managed` พร้อมคอมเมนต์ว่าให้ `GlobalTableColumnResizer` ไม่ซ้อนตัวลาก px ทับตัวลาก % |
| Auto-Fit / Reset | `frontend/shared/ui/useResizableColumns.tsx:79` (`computeSmartTableColumnPcts`), `:845` (`GlobalTableColumnResizer`) | คำนวณ % จากข้อมูลจริง และตัวลากกลางสำหรับตารางทั่วไป |
| ช่องไม่ล้นใน TransTopForm | `frontend/account/transaction/TransTopForm.tsx:188,203,218,366` | แถว flex ใส่ `min-w-0`, ช่อง readOnly รหัสสั้นเป็น `w-14 shrink-0` |
| การ์ดแท็บเสริมไม่ซ้อนตัวเลื่อน | `frontend/account/transaction/TransExtraTabs.tsx:198,913` | การ์ดเป็น `shrink-0` ให้กรอบนอกเลื่อนทีเดียว |
| กระดาษฟอร์มไม่ล้น | `frontend/src/app/globals.css:2254-2268` | `[data-doc-form-paper]` ใส่ `max-width:100%` และ `overflow-x:hidden` |
| ลำดับงานโหลด (stale guard) | `frontend/account/master/DocFormatScreen.tsx:267,312-319,415`; `frontend/account/transaction/UniversalTransScreen.tsx:728,1210-1211,1902` | `loadSeq`/`docLoadSeq` เพิ่มทุกครั้งที่เริ่มโหลดหรือเริ่มเอกสารใหม่ ผลที่ไม่ใช่รอบล่าสุดถูกทิ้ง |
| ลบต้องยืนยันและอ่านผล | `frontend/account/master/DealerScreen.tsx:433-455` | เปิด dialog ยืนยันก่อน แล้วถ้า `!res.ok` แสดง error ไม่ทำต่อ |

## กฎที่ต้องจำ
- เพดานล่างของตัวลากต้องอิงความกว้างเริ่มของคอลัมน์ ไม่ใช่ค่าคงที่ และห้าม normalize % เมื่อตารางกว้างกว่าจอ (`docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:18`)
- flex/grid child ที่มี input ใส่ `min-w-0`; ช่องรหัสสั้นแบบอ่านอย่างเดียวใส่ `shrink-0`; ตรวจที่ความกว้าง 1366x768
- ทุกงาน async ที่เขียนลงฟอร์มต้องมีเลขลำดับ (`useRef`) และเช็กหลังทุก `await`; เริ่มเอกสารใหม่ต้องทำให้งานโหลดค้างกลายเป็น stale
- ปุ่มลบทุกจอต้องถามก่อนและตรวจ `res.ok`

## ที่มาในโค้ด
- `frontend/account/report/UniversalReportScreen.tsx:960,993,1009-1013,1041,1675-1678`
- `frontend/shared/ui/useResizableColumns.tsx:79,845`
- `frontend/account/transaction/TransTopForm.tsx:188-218`, `TransExtraTabs.tsx:198`
- `frontend/account/master/DocFormatScreen.tsx:312`, `frontend/account/transaction/UniversalTransScreen.tsx:1210`, `frontend/account/master/DealerScreen.tsx:433`
- `frontend/src/app/globals.css:2254-2268`
- ดูเพิ่ม: [[std-grid-autofit-reset]] · [[std-grid-row-reorder-add-row]] · [[fe-grid-component]] · [[fe-standard-master-screen]] · [[std-frontend-ux-bug-lessons]] · [[hist-lessons-hidden-tab-hotkeys-dirty-guard]] · [[hist-lessons-thai-text-pdf]] · [[history-overview]]
