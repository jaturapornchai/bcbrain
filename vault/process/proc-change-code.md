---
title: "เปลี่ยนรหัสหลัก สินค้า/ลูกหนี้/เจ้าหนี้/ผังบัญชี (Change Code)"
tags: [process, workflow, master-data, change-code, item, customer, supplier, gl_account, admin]
aliases: ["change-code", "ChangeCode", "changeCodeSpecs", "เปลี่ยนรหัสสินค้า", "เปลี่ยนรหัสลูกหนี้", "เปลี่ยนรหัสเจ้าหนี้", "เปลี่ยนรหัสผังบัญชี", "renameMasterWithFKChildren", "fkChildren", "master_logs"]
sources: ["backend/internal/application/process/workflow.go:91", "backend/internal/application/process/workflow.go:110", "backend/internal/application/process/workflow.go:125", "backend/internal/application/process/workflow.go:204", "backend/internal/application/process/workflow.go:230", "backend/internal/application/process/workflow.go:299", "backend/internal/application/process/workflow.go:324", "backend/internal/application/process/workflow.go:350", "backend/internal/adapter/inbound/http/process/workflow_handler.go:38", "backend/internal/adapter/inbound/http/process/permission.go:50"]
---

# เปลี่ยนรหัสหลัก สินค้า/ลูกหนี้/เจ้าหนี้/ผังบัญชี (Change Code)

`POST /process/workflow/change-code` เปลี่ยนรหัสของข้อมูลหลัก 4 ชนิด พร้อมแก้ทุกตารางที่อ้างรหัสนั้นใน transaction เดียว ตามรายการตาราง/คอลัมน์ที่คัดจากหน้าจอ C# `BCERPGlobal/_changeCode/*` ทีละหน้าจอ (คอมเมนต์ `workflow.go:91,130`) เป็นงานเสี่ยงสูง สิทธิ์ต้องเป็น Admin (`permission.go:50`)

## ทำงานอย่างไร

### Input / Output (`workflow.go:180-202`)
- Input: `kind` (`item` | `customer` | `supplier` | `gl_account`), `menuName` (ชื่อเมนูที่จะลง log), `pairs[]` แต่ละคู่ `{oldCode, newCode}`
- Output: `rows[]` ต่อคู่ `{oldCode, newCode, name, tables}` โดย `tables` เป็นแผนที่ `"ตาราง.คอลัมน์" -> จำนวนแถวที่แก้`; และ `skippedTables[]` (ตาราง.คอลัมน์ที่ฐานข้อมูลลูกค้าไม่มี จึงข้าม)
- ตัวพารามิเตอร์ผู้ใช้/ฐานข้อมูลมาจาก token ไม่ใช่ body (ฟิลด์ `json:"-"`)

### กฎตรวจ input (`normalizeChangeCodePairs` :204)
- ต้องมี 1-500 คู่
- รหัสใหม่ trim + ตัวพิมพ์ใหญ่ ส่วนรหัสเดิม trim อย่างเดียว (ตามที่เก็บ)
- ทั้งสองรหัสห้ามว่าง ยาวเกิน 50 ตัวอักษรไม่ได้ รหัสใหม่ห้ามเหมือนรหัสเดิม (ไม่สนตัวพิมพ์) และห้ามซ้ำกันในรายการเดียวกัน (ข้อความ error ระบุเลขแถว)
- `kind` นอกรายการ = error "kind ต้องเป็น item, customer, supplier หรือ gl_account"

### ลำดับใน `ChangeCode` (:230) -- ทำใน `withTx` (หมดเวลา 120 วินาที)
1. กรองรายการอ้างอิงของ `kind` ให้เหลือเฉพาะคอลัมน์ที่มีจริง (`columnExists`) ที่ไม่มีบันทึกไว้ใน `skippedTables` (เพราะตารางที่ฐานลูกค้าไม่มีทำให้ทั้ง batch ล้ม -- คอมเมนต์ :241)
2. `fkChildren` (:299) หา foreign key แบบคอลัมน์เดียวชนิด NO ACTION ที่ชี้ไป `master.code` (คอมเมนต์ระบุตัวอย่าง `purchase_planning_*`) เพราะ FK แบบนี้ตรวจตอนจบคำสั่ง ต้องแก้ master กับลูกใน statement เดียว; FK แบบ CASCADE ไม่ต้องทำอะไร
3. ทีละคู่ตามลำดับ (A->B แล้ว B->C ทำงานเหมือน batch ของ C#):
   - อ่านชื่อ (`name_1`) ของรหัสเดิมจากตาราง master ไม่พบ = error "แถว N: ไม่พบ...เดิม ..."
   - รหัสใหม่มีอยู่แล้ว (`upper(code) = ใหม่`) = error แบบ conflict "แถว N: ...ใหม่ ... มีอยู่แล้ว"
   - `renameMasterWithFKChildren` (:324) แก้ `master.code` และ FK ลูกใน CTE เดียว (`WITH u0 AS (UPDATE ...), u1 AS (...) SELECT count(*) ...`)
   - ตารางอ้างอิงที่เหลือ (ข้ามตัวแรกซึ่งคือ master เอง) แก้ทีละตารางด้วย `UPDATE t SET col = ใหม่ WHERE col = เดิม [AND เงื่อนไขคงที่]` ถ้าตารางใดพังทั้ง batch rollback พร้อม error "เปลี่ยนรหัสใน ตาราง.คอลัมน์ ไม่สำเร็จ"
   - เขียน `master_logs` ผ่าน `writeMasterLog` (:350): `function_code 2`, `function_type 1`, `computer_name 'WEB'`, `menu_name` (clip 100), `code` = รหัสใหม่, `name_1`, `data1` = รหัสเดิม, `data2` = JSON `{oldCode,newCode,tables}` เพื่อให้หน้าจอตรวจสอบ master (`audit-list` kind `master`) เห็น
4. ชื่อตารางใน SQL มาจากตาราง `changeCodeSpecs` ที่เป็นค่าคงที่ ไม่ใช่ input ของผู้ใช้ (คอมเมนต์ `codeRef` :93)

### ตารางที่ถูกแก้ต่อ `kind` (`changeCodeSpecs` :125)
| kind | master | จุดอ้างอิงหลัก |
|---|---|---|
| `item` | `ic_inventory` | 36 คู่ตาราง.คอลัมน์ เช่น `ic_inventory_barcode.ic_code`, `ic_inventory_price`, `ic_inventory_purchase_price`, `ic_unit_use`, `ic_wh_shelf`, `ic_serial`, `ic_trans_detail.item_code`, `ic_trans_detail_lot.item_code`, `ic_trans_serial_number.ic_code`, `ic_inventory_level`, `images.image_id` |
| `customer` | `ar_customer` | `ar_customer_detail.ar_code`, `ar_dealer`, `ar_contactor`, `ar_item_by_customer`, `ic_inventory_price.cust_code` + กลุ่มธุรกรรมจาก `apArTransRefs` |
| `supplier` | `ap_supplier` | `ap_supplier_detail.ap_code`, `ap_contactor`, `ap_item_by_supplier` + กลุ่มธุรกรรมจาก `apArTransRefs` |
| `gl_account` | `gl_chart_of_account` | `code`, `main_code`, `account_close`, `gl_journal_detail.account_code`, ตาราง `gl_journal_*_list` และ `gl_chart_of_account_*_list`, `ic_inventory.account_code_1..4`, `ar_customer_detail.account_code`, `ap_supplier_detail.account_code` |

**กลุ่มธุรกรรมลูกหนี้/เจ้าหนี้ (`apArTransRefs` :110)**: แก้ `cust_code` ใน `ic_trans`, `ic_trans_detail`, `ap_ar_trans`, `ap_ar_trans_detail`, `ic_trans_serial_number`, `ic_trans_shipment`; `ap_ar_code` ใน `cb_trans`, `cb_trans_detail`; และ `ap_ar_transport_label.cust_code` ที่ `ar_ap_type` = 1 (ลูกหนี้) หรือ 0 (เจ้าหนี้) -- เฉพาะ `trans_flag` ในรายการ `arChangeCodeFlags` / `apChangeCodeFlags` (คัดจาก `_changeApArCodeUserControl` ตามคอมเมนต์ :104) ดู [[proc-doc-flow-numbering]] สำหรับความหมายของ flag

## ที่มาในโค้ด
- `backend/internal/application/process/workflow.go:91-123` - `codeRef`, `refs`, รายการ flag และ `apArTransRefs`
- `backend/internal/application/process/workflow.go:125-172` - `changeCodeSpecs`
- `backend/internal/application/process/workflow.go:174-228` - ชนิด input/output และ `normalizeChangeCodePairs`
- `backend/internal/application/process/workflow.go:230-297` - `ChangeCode`
- `backend/internal/application/process/workflow.go:299-360` - `fkChildren`, `renameMasterWithFKChildren`, `writeMasterLog`
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:38` - case `change-code`
- `backend/internal/adapter/inbound/http/process/permission.go:50` - `workflow/change-code` = Admin

## ดูเพิ่ม
- [[proc-workflow]]
- [[proc-master-data]]
- [[proc-item-master-detail]]
- [[proc-permission-rights]]
- [[process-overview]]
