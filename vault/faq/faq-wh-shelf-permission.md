---
title: "จำกัดคลัง/ที่เก็บที่ผู้ใช้เลือกได้ (perm_wh_shelf) ตั้งอย่างไร และทำไมผู้ใช้เห็นคลังไม่ครบ"
tags: [faq, permission, warehouse, shelf, erp_option, troubleshooting]
aliases: ["perm_wh_shelf", "ใช้คลังที่เก็บตามสิทธิ์พนักงาน", "erp_user_group_wh_shelf", "สิทธิ์คลัง", "กำหนดคลังและที่เก็บตามกลุ่มพนักงาน", "wh-perm-filter", "wh-pick-check", "เลือกคลังไม่ได้", "คลังหาย", "ไม่เห็นคลัง"]
sources: ["backend/internal/application/process/perm_wh_shelf.go:26", "backend/internal/application/process/perm_wh_shelf.go:42", "backend/internal/application/process/perm_wh_shelf.go:80", "backend/internal/application/process/perm_wh_shelf.go:127", "backend/internal/application/process/perm_wh_shelf_rest.go:25", "backend/internal/application/process/master_detail_specs.go:378", "frontend/src/config/schemas/erpOption/tab3Item.ts:97"]
---
# จำกัดคลัง/ที่เก็บที่ผู้ใช้เลือกได้ (perm_wh_shelf) ตั้งอย่างไร และทำไมผู้ใช้เห็นคลังไม่ครบ

**ตอบสั้น:** เป็นตัวเลือกระดับบริษัท `erp_option.perm_wh_shelf` (ช่องติ๊ก "ใช้คลังที่เก็บตามสิทธิ์พนักงาน") เมื่อเปิด รายการคลัง/ที่เก็บที่ผู้ใช้เลือกได้จะเหลือเฉพาะแถวใน `erp_user_group_wh_shelf` ของกลุ่มที่ผู้ใช้สังกัด แยกตามจอ PU (ซื้อ) / SI (ขาย) / IM (นำเข้า-โอน) / ST (ตรวจนับ) ถ้าผู้ใช้ไม่เห็นคลังที่ต้องการ ให้ตรวจ 3 อย่าง: ติ๊กตัวเลือกนี้ไว้หรือไม่ ผู้ใช้อยู่กลุ่มไหน และกลุ่มนั้นถูกกำหนดคลังในแท็บของจอนั้นไว้หรือยัง

## รายละเอียด
**วิธีตั้ง:**
1. ติ๊ก "ใช้คลังที่เก็บตามสิทธิ์พนักงาน" ในหน้าตั้งค่าบริษัท (`erp_option`, แท็บ "3.สินค้าคงคลัง" — `tab3Item.ts:97`)
2. จัดผู้ใช้เข้ากลุ่มพนักงาน ERP ใน `erp_user_group_detail` (เมนู `menu_setup_user_group` 1.1.6 `master_detail_specs.go:332`) — เป็นคนละชุดกับกลุ่ม `bc_user_and_group` ที่ใช้กับสิทธิ์เมนู
3. กำหนดคลัง/ที่เก็บของกลุ่มที่เมนู `menu_setup_user_group_warehouse_shelf` (master-detail 4 แท็บ `wh_pu`, `wh_si`, `wh_im`, `wh_st` — `master_detail_specs.go:378`) แท็บหนึ่งเก็บ `screen_code` ตายตัวของมัน ต้องมีรหัสคลังอยู่ใน `ic_warehouse` มิฉะนั้นขึ้น "ไม่พบรหัสคลังสินค้า"

**ระบบใช้สิทธิ์นี้ที่ไหนบ้าง** (ทั้งหมดผ่านเงื่อนไข EXISTS กลาง `permWhShelfExists`, `perm_wh_shelf.go:26`):
- รายการเลือกคลัง/ที่เก็บของจอเอกสาร (`applyPermWhShelf`, `:42`) — หัวเอกสารของกลุ่มจอ `whTopDocFlags` ตัวกรองสิทธิ์ **แทนที่** ตัวกรองสาขา ส่วนตารางสินค้า **AND** กับตัวกรองสาขา
- คลัง/ที่เก็บตั้งต้นของแถวสินค้า (`loadGridWhPerm`, `:80`) ถ้าผู้ใช้มี `erp_user.ic_wht`/`ic_shelf` และสิทธิ์เปิด ค่าของผู้ใช้ชนะค่าของสินค้า; ถ้าสิทธิ์ปิด ค่าเหล่านี้ถูกล้างทิ้ง
- เลือกคลังจากฟอร์มยอดคงเหลือ F3/F4 (`POST /process/lookup/wh-pick-check`, `whPickAllowed` `:127`) — คลังและที่เก็บต้องเป็นแถวของสินค้าใน `ic_wh_shelf` และอยู่ในกลุ่มของผู้ใช้
- หน้าเลือกคลัง/ฟอร์มยอดคงเหลือนอกเอกสาร (`POST /process/lookup/wh-perm-filter`, `WarehousePermFilter`, `perm_wh_shelf_rest.go:25`)
- รายงาน "เคลื่อนไหวสินค้า" และ "สินค้า_รายงานเคลื่อนไหว" เลือกที่เก็บ/คลังล่วงหน้าตามสิทธิ์ (`report_menu_ic.go:556,562`)

ทั้ง 3 route อยู่ใน `routeRights` เป็นสิทธิ์ read ([[faq-menu-permission-denied]])

## ข้อควรระวัง
- flag เอกสารที่ไม่อยู่ใน `permScreenGrid` จะไม่ถูกกรองในตารางสินค้า แม้เปิดสิทธิ์ ส่วนหัวเอกสารที่ไม่อยู่ใน `permScreenTop` กรองแต่ไม่ระบุ `screen_code`
- กลุ่มที่ไม่มีแถวคลังในแท็บของจอนั้น = เลือกคลังไม่ได้เลยในจอนั้น (EXISTS ไม่เจอ) ไม่ใช่เลือกได้ทั้งหมด
- รายงานที่ใช้โหมดสิทธิ์นี้ปฏิเสธ Custom SQL (`permGuarded`) ([[hist-lessons-permission-rights]])
- รายงานเคลื่อนไหวสินค้าตามที่เก็บ ถ้าเปิดสิทธิ์แต่ผู้ใช้ไม่มีที่เก็บเลย จะแจ้ง "กรุณาเลือกที่เก็บสินค้า"

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
- `backend/internal/application/process/perm_wh_shelf_rest.go:25` `WarehousePermFilter` / `whPermFilter` (บรรทัด 40)
- `backend/internal/application/process/master_detail_specs.go:378` เมนู `menu_setup_user_group_warehouse_shelf`
- `frontend/src/config/schemas/erpOption/tab3Item.ts:97` ช่องติ๊ก `perm_wh_shelf`
