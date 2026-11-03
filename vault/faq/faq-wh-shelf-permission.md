---
title: "จำกัดคลัง/ที่เก็บที่ผู้ใช้เลือกได้ (perm_wh_shelf) ตั้งอย่างไร และทำไมผู้ใช้เห็นคลังไม่ครบ"
tags: [faq, permission, warehouse, shelf, erp_option, troubleshooting]
aliases: ["perm_wh_shelf", "ใช้คลังที่เก็บตามสิทธิ์พนักงาน", "erp_user_group_wh_shelf", "สิทธิ์คลัง", "กำหนดคลังและที่เก็บตามกลุ่มพนักงาน", "wh-perm-filter", "wh-pick-check", "เลือกคลังไม่ได้", "คลังหาย", "ไม่เห็นคลัง"]
sources: ["backend/internal/application/process/perm_wh_shelf.go:26", "backend/internal/application/process/perm_wh_shelf.go:42", "backend/internal/application/process/perm_wh_shelf.go:80", "backend/internal/application/process/perm_wh_shelf.go:127", "backend/internal/application/process/perm_wh_shelf_rest.go:25", "backend/internal/application/process/perm_wh_shelf_rest.go:91", "backend/internal/application/process/master_detail_specs.go:332", "backend/internal/application/process/master_detail_specs.go:378", "backend/internal/application/process/report_menu_ic.go:585", "backend/internal/application/process/report_menu_ic.go:591", "backend/internal/adapter/inbound/http/process/permission.go:24", "frontend/src/config/schemas/erpOption/tab3Item.ts:97"]
---
# จำกัดคลัง/ที่เก็บที่ผู้ใช้เลือกได้ (perm_wh_shelf) ตั้งอย่างไร และทำไมผู้ใช้เห็นคลังไม่ครบ

**ตอบสั้น:** เป็นตัวเลือกระดับบริษัท `erp_option.perm_wh_shelf` (ช่องติ๊ก "ใช้คลังที่เก็บตามสิทธิ์พนักงาน") เมื่อเปิด รายการคลัง/ที่เก็บที่ผู้ใช้เลือกได้จะเหลือเฉพาะแถวใน `erp_user_group_wh_shelf` ของกลุ่มที่ผู้ใช้สังกัด แยกตามจอ PU (ซื้อ) / SI (ขาย) / IM (นำเข้า-โอน) / ST (ตรวจนับ) ถ้าผู้ใช้ไม่เห็นคลังที่ต้องการ ให้ตรวจ 3 อย่าง: ติ๊กตัวเลือกนี้ไว้หรือไม่ ผู้ใช้อยู่กลุ่มไหน และกลุ่มนั้นถูกกำหนดคลังในแท็บของจอนั้นไว้หรือยัง

## รายละเอียด
**วิธีตั้ง:**
1. ติ๊ก "ใช้คลังที่เก็บตามสิทธิ์พนักงาน" ในหน้าตั้งค่าบริษัท (`erp_option`, แท็บ "3.สินค้าคงคลัง" — `tab3Item.ts:97`)
2. จัดผู้ใช้เข้ากลุ่มพนักงาน ERP ใน `erp_user_group_detail` (เมนู `menu_setup_user_group` รหัส 1008 `master_detail_specs.go:332` แท็บ `users` `:341` เก็บ `erp_user_group_detail`) — เป็นคนละชุดกับกลุ่ม `bc_user_and_group` ที่ใช้กับสิทธิ์เมนู
3. กำหนดคลัง/ที่เก็บของกลุ่มที่เมนู `menu_setup_user_group_warehouse_shelf` รหัส 1009 (master-detail 4 แท็บ `wh_pu`, `wh_si`, `wh_im`, `wh_st` — `master_detail_specs.go:378`) แท็บหนึ่งเก็บ `screen_code` ตายตัวของมัน (PU/SI/IM/ST) ลงตาราง `erp_user_group_wh_shelf` ต้องมีรหัสคลังอยู่ใน `ic_warehouse` มิฉะนั้นขึ้น "ไม่พบรหัสคลังสินค้า" (`:386`, `:392`, `:398`, `:404`)

**ระบบใช้สิทธิ์นี้ที่ไหนบ้าง** (ทั้งหมดผ่านเงื่อนไข EXISTS กลาง `permWhShelfExists`, `perm_wh_shelf.go:26`):
- รายการเลือกคลัง/ที่เก็บของจอเอกสาร (`applyPermWhShelf`, `:42`) — หัวเอกสารของกลุ่มจอ `whTopDocFlags` ตัวกรองสิทธิ์ **แทนที่** ตัวกรองสาขา ส่วนตารางสินค้า **AND** กับตัวกรองสาขา
- คลัง/ที่เก็บตั้งต้นของแถวสินค้า (`loadGridWhPerm`, `:80`) ถ้าผู้ใช้มี `erp_user.ic_wht`/`ic_shelf` และสิทธิ์เปิด ค่าของผู้ใช้ชนะค่าของสินค้า; ถ้าสิทธิ์ปิด ค่าเหล่านี้ถูกล้างทิ้ง
- เลือกคลังจากฟอร์มยอดคงเหลือ F3/F4 (`POST /process/lookup/wh-pick-check`, `whPickAllowed` `:127`) — ถ้าตัวเลือก `perm_wh_shelf` ไม่ได้เปิด (ค่าไม่เท่ากับ 1) ผ่านเสมอ ถ้าเปิด คลังและที่เก็บต้องเป็นแถวของสินค้านั้นใน `ic_wh_shelf` และอยู่ใน `erp_user_group_wh_shelf` ของกลุ่มที่ผู้ใช้สังกัด ตามจอที่แปลงจาก flag เอกสารใน `permScreenPick` (`:107`: 12 เป็น PU, 34/36/44 เป็น SI, 70-73 เป็น IM, 48/49 เป็น ST) flag ที่ไม่อยู่ในตารางนี้ตรวจแค่ว่ามีแถวในสินค้า ไม่ตรวจกลุ่ม
- หน้าเลือกคลัง/ฟอร์มยอดคงเหลือนอกเอกสาร (`POST /process/lookup/wh-perm-filter`, `WarehousePermFilter`, `perm_wh_shelf_rest.go:25`)
- รายงาน "เคลื่อนไหวสินค้า" (`IC_INFO_STK_MOVE`, `report_menu_ic.go:585`, โหมด `icPermPair`) และ "สินค้า_รายงานเคลื่อนไหว" (`IC_REPORT_STK_MOVEMENT`, `report_menu_ic.go:591`, โหมด `icPermWh`) เลือกที่เก็บ/คลังล่วงหน้าตามสิทธิ์ (โหมดใน `perm_wh_shelf_rest.go:56-63`, ตั้งค่า `icPermOptions` `:66`, `pick` `:91`)

ทั้ง 3 route (`lookup/wh-filter`, `lookup/wh-pick-check`, `lookup/wh-perm-filter`) อยู่ใน `routeRights` เป็นสิทธิ์ read (`backend/internal/adapter/inbound/http/process/permission.go:24`) ([[faq-menu-permission-denied]])

## ข้อควรระวัง
- flag เอกสารที่ไม่อยู่ใน `permScreenGrid` จะไม่ถูกกรองในตารางสินค้า แม้เปิดสิทธิ์ ส่วนหัวเอกสารที่ไม่อยู่ใน `permScreenTop` กรองแต่ไม่ระบุ `screen_code`
- กลุ่มที่ไม่มีแถวคลังในแท็บของจอนั้น = เลือกคลังไม่ได้เลยในจอนั้น (EXISTS ไม่เจอ) ไม่ใช่เลือกได้ทั้งหมด
- รายงานที่ใช้โหมดสิทธิ์นี้ปฏิเสธ Custom SQL (`permGuarded`) ([[hist-lessons-permission-rights]])
- รายงานเคลื่อนไหวสินค้าตามที่เก็บ ถ้าเปิดสิทธิ์แต่ผู้ใช้ไม่มีที่เก็บเลย จะแจ้ง "กรุณาเลือกที่เก็บสินค้า" (`pick` `perm_wh_shelf_rest.go:99-100`) ส่วนรายงาน "สินค้า_รายงานเคลื่อนไหว" ถ้าไม่มีคลังเลยจะไม่กรอง (`:102`)

## ดูเพิ่ม
- [[proc-wh-shelf-permission]]
- [[proc-lookup-filters]]
- [[proc-master-data]]
- [[faq-menu-permission-denied]]
- [[faq-stock-transfer-warehouse]]
- [[faq-stock-count-adjust]]

## ที่มาในโค้ด
- `backend/internal/application/process/perm_wh_shelf.go:26` `permWhShelfExists` และตาราง `permScreenGrid`/`permScreenTop` (บรรทัด 14-22)
- `backend/internal/application/process/perm_wh_shelf.go:42` `applyPermWhShelf`
- `backend/internal/application/process/perm_wh_shelf.go:80` `loadGridWhPerm` (อ่าน `erp_option.perm_wh_shelf`, `erp_user.ic_wht/ic_shelf`)
- `backend/internal/application/process/perm_wh_shelf.go:127` `whPickAllowed`
- `backend/internal/application/process/perm_wh_shelf_rest.go:25` `WarehousePermFilter` / `whPermFilter` (บรรทัด 40); `:56-63` โหมด `icPermWh`/`icPermPair`; `:66` `icPermOptions`; `:91-102` `pick`
- `backend/internal/application/process/report_menu_ic.go:585`, `:591` ลงทะเบียนรายงานที่ใช้โหมดสิทธิ์
- `backend/internal/application/process/master_detail_specs.go:332`, `:341` เมนู `menu_setup_user_group`; `:378` เมนู `menu_setup_user_group_warehouse_shelf`
- `backend/internal/adapter/inbound/http/process/permission.go:24` route ที่เกี่ยวข้องเป็นสิทธิ์ read
- `frontend/src/config/schemas/erpOption/tab3Item.ts:97` ช่องติ๊ก `perm_wh_shelf`
