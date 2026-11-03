---
title: "สิทธิ์คลัง/ที่เก็บรายกลุ่มผู้ใช้ (perm_wh_shelf)"
tags: [process, permission, warehouse, shelf, erp_option, lookup, report]
aliases: ["perm_wh_shelf", "erp_user_group_wh_shelf", "wh-perm-filter", "wh-pick-check", "applyPermWhShelf", "permWhShelfExists", "WarehousePickAllowed", "gridWhPerm", "icPermMode", "สิทธิ์คลัง"]
sources: ["backend/internal/application/process/perm_wh_shelf.go:14", "backend/internal/application/process/perm_wh_shelf.go:26", "backend/internal/application/process/perm_wh_shelf.go:42", "backend/internal/application/process/perm_wh_shelf.go:74", "backend/internal/application/process/perm_wh_shelf.go:101", "backend/internal/application/process/perm_wh_shelf.go:118", "backend/internal/application/process/perm_wh_shelf_rest.go:15", "backend/internal/application/process/perm_wh_shelf_rest.go:40", "backend/internal/application/process/perm_wh_shelf_rest.go:66", "backend/internal/application/process/report_menu_ic.go:556", "backend/internal/application/process/master_detail_specs.go:382"]
---

# สิทธิ์คลัง/ที่เก็บรายกลุ่มผู้ใช้ (perm_wh_shelf)

ตัวเลือกบริษัท `erp_option.perm_wh_shelf = 1` จำกัดคลัง (`wh`) และที่เก็บ (`shelf`) ที่ผู้ใช้เลือกได้ ให้เหลือเฉพาะแถวใน `erp_user_group_wh_shelf` ของกลุ่มที่ผู้ใช้สังกัด (`erp_user_group_detail`) แยกตามรหัสจอ `screen_code` = `PU` (ซื้อ), `SI` (ขาย), `IM` (นำเข้า/โอน), `ST` (ตรวจนับ) ตามคอมเมนต์หัวไฟล์ C# `BCERPGlobal/_icInfoFlag.cs`

## ทำงานอย่างไร

### เงื่อนไข EXISTS กลาง (`permWhShelfExists`)
`EXISTS (SELECT 1 FROM erp_user_group_wh_shelf p WHERE p.group_code IN (กลุ่มของผู้ใช้) [AND p.screen_code = ...] AND p.wh_code = <คอลัมน์คลัง> [AND p.shelf_code = <คอลัมน์ที่เก็บ>])` ผู้ใช้ถูกแปลงเป็นตัวพิมพ์ใหญ่ ใช้ทั้งในตัวกรอง lookup ตัวตารางสินค้า รายงาน และหน้าเลือกคลัง

### 1. ตัวกรอง lookup ของจอเอกสาร (`applyPermWhShelf`)
- ถูกเรียกจาก `WarehouseLookupFilter` เมื่อ `perm_wh_shelf = 1` ([[proc-lookup-filters]])
- หัวเอกสาร (`whTopDocFlags`): ตัวกรอง `fromWh/fromShelf` **แทนที่** ตัวกรองสาขา (ตาม C# `_icTransScreenTopControl.cs:3227-3260`) โดยใช้ `permScreenTop` (12 = PU; 34, 36, 44, 56, 122 = SI; 70-73, 124 = IM; 48, 49 = ST) flag ที่ไม่อยู่ในตารางยังกรองได้ แต่ไม่ระบุ `screen_code`
- ตารางสินค้า: ตัวกรอง `rowWh/rowShelf` **AND** กับตัวกรองสาขา (ตาม `_icTransItemGridSelectWareHouseAndShelfForm.cs:150-206`) โดยใช้ `permScreenGrid` (6, 12 = PU; 34, 36, 44, 56 = SI; 70-73, 124 = IM; 48, 49 = ST)

### 2. ค่าตั้งต้นคลัง/ที่เก็บของตารางสินค้า (`gridWhPerm`)
- `loadGridWhPerm` อ่าน `perm_wh_shelf` และ `erp_user.ic_wht` / `erp_user.ic_shelf`; ถ้าเปิดสิทธิ์ ใช้ `permScreenGrid[flag]` เป็นจอ; ถ้าไม่เปิด ค่า `ic_wht/ic_shelf` ของผู้ใช้ถูกล้าง (ไม่ใช้)
- `gridPermWhere` เติมเงื่อนไข `($4 = '' OR EXISTS...)` ในการหาคลังตั้งต้นของสินค้า
- ถ้าผู้ใช้มี `ic_wht` หรือ `ic_shelf` และสิทธิ์เปิดอยู่ ค่าของผู้ใช้ **ชนะ** ค่าตั้งต้นของสินค้า (`userOverride`, อ้าง C# cs:9917-9927 ในคอมเมนต์)
- ใช้ใน `trans_grid.go:171` และ `trans_ref_import_lines.go:150`

### 3. ตรวจคลังที่เลือกจากฟอร์มยอดคงเหลือ (`POST /process/lookup/wh-pick-check`)
- `WarehousePickAllowed` -> `whPickAllowed` คืน `{allowed: bool}`
- ถ้า `perm_wh_shelf <> 1` อนุญาตเสมอ; ถ้าเปิด คลัง+ที่เก็บต้องเป็นแถวของสินค้าใน `ic_wh_shelf`; และถ้า flag อยู่ใน `permScreenPick` (12 = PU; 34, 36, 44 = SI; 70-73 = IM; 48, 49 = ST) คลังกับที่เก็บต้องอยู่ในกลุ่มของผู้ใช้แยกกัน (IN สองชุด ตาม C# `_icBalance__getWarehouseLocation`)

### 4. ตัวกรองหน้าเลือกคลังและฟอร์มยอดคงเหลือ (`POST /process/lookup/wh-perm-filter`)
- `WarehousePermFilter` คืน `WhPermFilter`: `wh`, `shelf` (รายการเลือกคลัง/ที่เก็บ ทุก `screen_code`), `balance` (เงื่อนไขแถว `ic_trans_detail d` ของยอดคงเหลือต่อคลัง+ที่เก็บ พร้อม `d.qty <> 0` และถ้ามีสาขาที่ล็อกอิน กรองเฉพาะคลังของสาขานั้น), และ `rows`/`valueOnly` ที่คืนเสมอ (ค่าจาก `stockRowsSQL`, `stockValueOnlySQL` เพื่อให้ผลรวมรายที่เก็บตรงกับ `ic_inventory.balance_qty`)
- เมื่อ `perm_wh_shelf` ปิด `wh`/`shelf`/`balance` เป็นค่าว่าง

### 5. รายงานสินค้า (`icPermMode`)
- รายงานบางตัวเลือกคลัง/ที่เก็บล่วงหน้าตามสิทธิ์: `icPermPair` (รายงาน `IC_INFO_STK_MOVE` เคลื่อนไหวสินค้า -- เลือกที่เก็บทั้งหมดของผู้ใช้; ถ้าเปิดสิทธิ์แต่ผู้ใช้ไม่มีที่เก็บเลย -> error "กรุณาเลือกที่เก็บสินค้า") และ `icPermWh` (`IC_REPORT_STK_MOVEMENT` -- เลือกคลังทั้งหมดของผู้ใช้) กำหนดที่ `report_menu_ic.go:556,562`
- `icPermOptions` ตั้งตัวเลือกฝั่ง server `pw` (`wh`/`pair`) และ `pu` (ผู้ใช้) แล้ว `icPermCTE`/`icPermWhere` กรอง CTE `ln` (คอลัมน์ `wh`, `sh`); spec ที่ใช้โหมดนี้ถูกตั้ง `permGuarded` ทำให้ Custom SQL ถูกปฏิเสธ ([[proc-report-custom-sql-template]])

### 6. ตั้งค่าสิทธิ์ (หน้า master)
- แถว `erp_user_group_wh_shelf` แก้ผ่านเมนู `menu_setup_user_group_warehouse_shelf` แบบ master-detail (grid `wh_pu`, `wh_si`, `wh_im`, `wh_st` ตาม `screen_code`) ที่ `master_detail_specs.go:378-408` ดู [[proc-master-data]]

## จุดที่ต้องระวัง
- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
- คอมเมนต์ใน `permScreenPick` ระบุว่า 34/36 ใช้ `SI` ตามแบบ "BC CM"

## ที่มาในโค้ด
- `backend/internal/application/process/perm_wh_shelf.go:9-22` - คอมเมนต์หลักและตาราง `permScreenGrid`, `permScreenTop`
- `backend/internal/application/process/perm_wh_shelf.go:26` - `permWhShelfExists`; `:42` `applyPermWhShelf`
- `backend/internal/application/process/perm_wh_shelf.go:69-105` - `gridPermWhere`, `gridWhPerm`, `loadGridWhPerm`, `userOverride`
- `backend/internal/application/process/perm_wh_shelf.go:107-143` - `permScreenPick`, `WarehousePickAllowed`, `whPickAllowed`
- `backend/internal/application/process/perm_wh_shelf_rest.go:15-53` - `WhPermFilter`, `WarehousePermFilter`, `whPermFilter`
- `backend/internal/application/process/perm_wh_shelf_rest.go:55-113` - `icPermMode`, `icPermOptions`, `icPermCTE`, `icPermWhere`
- `backend/internal/application/process/report_menu_ic.go:556,562` - รายงานที่ใช้โหมดสิทธิ์
- `backend/internal/application/process/master_detail_specs.go:382-408` - หน้ากำหนดสิทธิ์กลุ่ม

## ดูเพิ่ม
- [[proc-lookup-filters]]
- [[proc-report-registry-conditions]]
- [[proc-master-data]]
- [[proc-permission-rights]]
- [[process-overview]]
