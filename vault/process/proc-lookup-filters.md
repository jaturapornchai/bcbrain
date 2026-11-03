---
title: "ตัวกรองหน้าค้นหา (Lookup filters: party / ref-doc / warehouse / held items)"
tags: [process, lookup, filter, branch, erp_option, trans]
aliases: ["lookup/party-filter", "lookup/ref-doc-filter", "lookup/wh-filter", "PartyLookupFilter", "RefDocLookupFilter", "WarehouseLookupFilter", "transLookupRule", "checkHeldItems", "is_hold_sale", "is_hold_purchase", "สินค้าเลิกขาย", "หยุดซื้อ"]
sources: ["backend/internal/application/process/lookup_party.go:33", "backend/internal/application/process/lookup_party.go:46", "backend/internal/application/process/lookup_party.go:71", "backend/internal/application/process/lookup_trans.go:42", "backend/internal/application/process/lookup_trans.go:67", "backend/internal/application/process/lookup_trans.go:92", "backend/internal/application/process/lookup_trans.go:119", "backend/internal/application/process/lookup_trans.go:140", "backend/internal/application/process/lookup_trans.go:186", "backend/internal/application/process/lookup_hold.go:19", "backend/internal/application/process/lookup_hold.go:33", "backend/internal/adapter/inbound/http/process/lookup_handler.go:11", "backend/internal/adapter/inbound/http/router.go:144"]
---

# ตัวกรองหน้าค้นหา (Lookup filters: party / ref-doc / warehouse / held items)

หน้าจอเอกสาร (trans screen) มีช่องค้นหาลูกค้า/เจ้าหนี้, เอกสารอ้างอิง, คลัง/ที่เก็บ หน้าเว็บ **ไม่ตัดสินเงื่อนไขกรองเอง** แต่เรียก backend ขอเงื่อนไขกรอง เพราะกฎขึ้นกับ `erp_option`, `erp_company_profile` และแถว `erp_user` ของผู้ที่ล็อกอิน ทั้งหมดพอร์ตมาจาก C# (อ้างชื่อคลาสในคอมเมนต์ของโค้ด)

## ทำงานอย่างไร

### Route (ทั้งหมดสิทธิ์ `read`)
| Route | Input (JSON) | Output |
|---|---|---|
| `POST /process/lookup/party-filter` | `side` (`ar`/`ap`), `withBranch` | `{where, columns}` |
| `POST /process/lookup/ref-doc-filter` | `transFlag`, `custCode`, `vatType` | `{where}` |
| `POST /process/lookup/wh-filter` | `transFlag`, `branchCode` | `WhLookupFilter` |
| `POST /process/lookup/wh-pick-check` | `transFlag`, `itemCode`, `whCode`, `shelfCode` | `{allowed}` ดู [[proc-wh-shelf-permission]] |
| `POST /process/lookup/wh-perm-filter` | `{}` | `WhPermFilter` ดู [[proc-wh-shelf-permission]] |

ประกาศซ้ำทั้งใต้ `/process` และ `/api/v1/process` ใน `router.go` ผู้ใช้/ฐานข้อมูลมาจาก JWT (`json:"-"`)

### 1. ตัวกรองลูกค้า/เจ้าหนี้ (`PartyLookupFilter`)
- `side` ต้องเป็น `ar` หรือ `ap` มิฉะนั้น error "side ต้องเป็น ar หรือ ap"
- `ap`: `ap_supplier.status=0` และคืน `columns` ที่แทนคอลัมน์ `debt_balance` ด้วยสูตรคำนวณจากเอกสารดิบ (`apLookupOutstandingExprs`, ไฟล์ `ap_outstanding.go:9`) เพราะค่าที่เก็บใน `ap_supplier.debt_balance` ไม่มีโค้ดใดอัปเดต (ตามคอมเมนต์); `chq_balance`/`bill_balance` ยังใช้คอลัมน์ที่เก็บไว้
- `ar`: `ar_customer.status=0` (status 1 = ปิด, NULL ก็ไม่ถือว่าใช้งาน) และถ้า `withBranch` (เฉพาะจอ `ic_trans`) อ่าน `erp_option.customer_by_branch` กับ `change_branch_code`/`branch_code` ของผู้ใช้ (`partyBranchRule`): ถ้าบริษัทแยกลูกค้าตามสาขา **และ** ผู้ใช้เปลี่ยนสาขาไม่ได้ จึงเติม `ar_customer.ar_branch_code='<สาขาผู้ใช้>'`; ผู้ใช้ที่ไม่พบในตาราง ถือว่าเปลี่ยนสาขาไม่ได้

### 2. ตัวกรองเอกสารอ้างอิง (`RefDocLookupFilter` / `refDocWhere`)
- `transLookupRule` อ่านครั้งเดียว: `erp_company_profile.branch_status`, `erp_option.show_branch_doc_only`, `doc_ref_reservation_approve`, `doc_ref_salesorder_approve`, `ref_po_approve`, `perm_wh_shelf` และ `erp_user.change_branch_code`/`branch_code`
- ตามประเภทหน้าจอ (`transFlag`):
  - 6: `doc_success=0` และ (ไม่ใช่ flag 4 หรือ `not_approve_1=0`)
  - 12, 44, 56, 72, 144, 310, 315: `doc_success=0`
  - 87 (ตั้งหนี้อื่น): `used_status=0`
  - flag ใน `refCustFlags`: `cust_code='<ลูกค้า>'` แม้ลูกค้าว่าง (ตามคอมเมนต์ C# จึงไม่แสดงเอกสารเลยแทนที่จะแสดงของทุกคน)
  - flag ใน `refVatFlags`: `vat_type = <vatType ของหัวเอกสาร>` (311, 315 และจอรายรับ/รายจ่ายเงินสด 252/254/262/264 ไม่เติม)
  - 44/144: ถ้าเปิด `doc_ref_reservation_approve` ใบจอง (flag 34) ต้อง `approve_status=1`; ถ้าเปิด `doc_ref_salesorder_approve` ใบสั่งขาย (flag 36) ต้อง `approve_status=1`
  - 12/310: ถ้าเปิด `ref_po_approve` ใบสั่งซื้อ (flag 6) ต้อง `approve_status=1`
  - สาขา: ถ้า `branch_status` และ `show_branch_doc_only` และผู้ใช้เปลี่ยนสาขาไม่ได้ เติม `branch_code='<สาขา>'` (`docBranch`)
- `refSourceWhere` เติม `trans_flag IN (...)` จาก `refImportSources[flag]` เพื่อให้เอกสารที่แสดงเป็นชนิดที่ปุ่มดึงรายการ (line import) รับได้ ดู [[proc-grid-calc]] (`refimport`)

### 3. ตัวกรองคลัง/ที่เก็บ (`WarehouseLookupFilter` / `whLookupWhere`)
- ถ้า `erp_company_profile.branch_status` ไม่เปิด -> ไม่กรองอะไร
- ผลลัพธ์ `WhLookupFilter`: `fromWh/fromShelf` (หัวเอกสารต้นทาง), `toWh/toShelf` (ปลายทาง), `rowWh/rowShelf` (ตารางสินค้า), `defaultBranch` (สาขาตั้งต้นของเอกสารใหม่)
- flag 72, 124 (โอนออก/ขอโอน): กรองต้นทางและปลายทางด้วยสาขาที่ล็อกอิน; flag อื่นใน `whTopDocFlags` (14, 316, 311, 12, 315, 310, 56, 122, 66, 68, 54, 58, 60, 276, 76): กรองต้นทางด้วยสาขาของเอกสาร เมื่อผู้ใช้เปลี่ยนสาขาไม่ได้
- ตารางสินค้า: กรอง `branch_use` (หรือ `branch_code` ถ้า `branch_use` ว่าง) แบบ `LIKE '%สาขา%'`; โอนออกใช้สาขาที่ล็อกอิน นอกนั้นใช้สาขาของเอกสาร
- ที่เก็บ (shelf) กรองผ่านคลังของมัน (`whcode IN (SELECT code FROM ic_warehouse WHERE ...)`)
- ถ้า `erp_option.perm_wh_shelf = 1` เรียก `applyPermWhShelf` ซ้อนตัวกรองสิทธิ์รายผู้ใช้ ดู [[proc-wh-shelf-permission]]

### 4. ห้ามบันทึกสินค้าเลิกขาย/หยุดซื้อ (`checkHeldItems`)
- เรียกจาก `trans.go:308` ตอนบันทึกเอกสาร: ปฏิเสธรหัสสินค้าที่ `ic_inventory_detail.is_hold_sale = 1` (flag ขาย/เสนอราคา/สั่งขาย/จอง = `holdSaleFlags` 30, 34, 36, 44) หรือ `is_hold_purchase = 1` (flag ซื้อ/ขอซื้อ/สั่งซื้อ = `holdPurchaseFlags` 2, 6, 12, 310)
- ยกเว้น: สินค้าที่มีอยู่ในเอกสารเดิมที่เก็บไว้แล้ว (บันทึกซ้ำบิลเก่าหลังสินค้าถูกระงับ) และสินค้าที่อยู่ในเอกสารที่ `doc_ref` ชี้ไป (ดึงมาจากเอกสารนั้น) -- `doc_ref` เป็นข้อความอิสระ จึงยกเว้นเฉพาะสินค้าที่เอกสารนั้นมีจริง
- ข้ามเมื่อ `deferStock` หรือไม่มีสินค้า; ชื่อคอลัมน์ที่ต่อ SQL มาจาก switch ค่าคงที่ใน `holdColumn` ไม่ใช่ input
- ข้อความ error: "สินค้า <ชื่อ,...> เลิกขาย" หรือ "... หยุดซื้อ"

## จุดที่ต้องระวัง
- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
- กฎ `refCustFlags` ทำให้เลือกเอกสารอ้างอิงก่อนเลือกคู่ค้าแล้วไม่พบเอกสาร ตามที่ C# ทำ ไม่ใช่บั๊ก
- `defaultBranch` ว่างได้ถ้าสาขาที่ล็อกอินไม่อยู่ใน `erp_branch_list` (คอมเมนต์ `ponytail` ในโค้ด); ตอนบันทึกจะแจ้งเหตุผล

## ที่มาในโค้ด
- `backend/internal/application/process/lookup_party.go:12-86` - `PartyLookupInput`, `partyLookupWhere`, `PartyLookupFilter`, `partyBranchRule`
- `backend/internal/application/process/ap_outstanding.go:9` - `apLookupOutstandingExprs`
- `backend/internal/application/process/lookup_trans.go:42` - `transLookupRule`; `:67` อ่านกฎจาก DB
- `backend/internal/application/process/lookup_trans.go:92` - `RefDocLookupFilter`; `:106` `refSourceWhere`; `:140` `refDocWhere`; `:176` `docBranch`
- `backend/internal/application/process/lookup_trans.go:119` - `WarehouseLookupFilter`; `:186` `whLookupWhere`
- `backend/internal/application/process/lookup_hold.go:19` - `holdColumn`; `:33` `checkHeldItems`
- `backend/internal/application/process/trans_grid.go:99` - `holdSaleFlags`, `holdPurchaseFlags`
- `backend/internal/application/process/trans.go:308` - จุดเรียก `checkHeldItems`
- `backend/internal/adapter/inbound/http/process/lookup_handler.go:11` และ `lookup_trans_handler.go:12-33` - handler
- `backend/internal/adapter/inbound/http/router.go:144-148` - ลงทะเบียน route; `permission.go:24` - สิทธิ์ `read`

## ดูเพิ่ม
- [[proc-wh-shelf-permission]]
- [[proc-grid-calc]]
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[process-overview]]
