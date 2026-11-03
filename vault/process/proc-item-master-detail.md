---
title: "ข้อมูลสินค้าและข้อมูลสินค้าเพิ่มเติม (Item master & item detail)"
tags: [process, item, ic_inventory, master-data, unit, barcode, transaction]
aliases: ["itemmaster/save", "itemmaster/delete", "itemdetail/get", "itemdetail/save", "ItemMasterSave", "ItemDetailSave", "ic_inventory", "ic_inventory_detail", "itemSavedTx", "checkChangeMaster", "update_detail", "ข้อมูลสินค้า"]
sources: ["backend/internal/application/process/item_master.go:25", "backend/internal/application/process/item_master.go:133", "backend/internal/application/process/item_master.go:218", "backend/internal/application/process/item_master.go:521", "backend/internal/application/process/item_master.go:541", "backend/internal/application/process/item_master.go:559", "backend/internal/application/process/item_master.go:627", "backend/internal/application/process/item_master.go:719", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/item_master.go:817", "backend/internal/application/process/item_detail.go:35", "backend/internal/application/process/item_detail.go:194", "backend/internal/application/process/item_detail.go:367", "backend/internal/application/process/stock_tools.go:553", "backend/internal/adapter/inbound/http/process/itemdetail_handler.go:14"]
---

# ข้อมูลสินค้าและข้อมูลสินค้าเพิ่มเติม (Item master & item detail)

สองหน้าจอสินค้าที่พอร์ตจาก C# `BCERPIC`: (1) **ข้อมูลสินค้า** (`_icMain.cs`, เมนู 2.1.1/2.1.2/2.1.24) บันทึก `ic_inventory` พร้อมตารางหน่วยนับ บาร์โค้ด คลัง/ที่เก็บ ต้นทุนมาตรฐาน รูป ใน transaction เดียว และ (2) **ข้อมูลสินค้าเพิ่มเติม** (`_icMainDetail.cs`, เมนู 2.1.3/2.1.4) บันทึกกลุ่ม/ยี่ห้อ/มิติ/คลังตั้งต้น ฯลฯ ทั้งสองให้เซิร์ฟเวอร์ตรวจกฎเองทั้งหมด หน้าเว็บส่งแค่ฟอร์ม

## ทำงานอย่างไร

### Route และสิทธิ์
| Route | หน้าที่ | สิทธิ์ | ขนาด body สูงสุด |
|---|---|---|---|
| `itemmaster/save` | บันทึก/สร้างสินค้า | `add` เมื่อ `isNew` มิฉะนั้น `edit` (`RequiredRight` อ่าน body) | 4 MB |
| `itemmaster/delete` | ลบสินค้าหลายรหัส | `del` | 1 MB |
| `itemdetail/get` | โหลดข้อมูลเพิ่มเติม | `read` | 1 MB |
| `itemdetail/save` | บันทึกข้อมูลเพิ่มเติม | `write` | 4 MB |

### 1. บันทึกข้อมูลสินค้า (`ItemMasterSave`)
- Input: `menuKey`, `isNew`, `item` (map: `code`, `have_point`, `width_length_height`, `weight` + คอลัมน์ `ic_inventory`), `units`, `oppositeUnits`, `barcodes`, `whShelves`, `standardCosts`, `images`
- `menuKey` ต้องเป็น `menu_ic_item_detail` (screen_code `0`), `menu_ic_item_detail_barcode` (`1`) หรือ `menu_ic_item_for_sync` (`0`; โหมด sync ตัดตารางบาร์โค้ดและคลังทิ้ง) ไม่เช่นนั้น "เมนูไม่ถูกต้อง"
- **ตรวจก่อนเขียน** (`parseItemMaster`): รหัสสินค้า (ตัวพิมพ์ใหญ่ ไม่เกิน 25) ชื่อสินค้า 1 หน่วยต้นทุน หน่วยยอดคงเหลือ ห้ามว่าง; ทุกคอลัมน์ผ่าน `fieldSpec` (ข้อความจำกัดความยาว, จำนวนเต็ม, ตัวเลข ชื่อคอลัมน์มาจากตาราง spec ไม่มาจาก request); ค่าตั้งต้นสินค้าใหม่ `update_detail = 1`, `update_price = 1`
- ใน transaction (หมดเวลา 60 วินาที):
  1. `checkChangeMaster`: กลุ่มผู้ใช้ของผู้ล็อกอินเรียงตาม `is_change_masterdata` มากไปน้อย ถ้ามีกลุ่มใดเป็น 1 อนุญาต; ไม่เช่นนั้น `KindForbidden` "ไม่อนุญาตให้แก้ไขข้อมูลหลัก"
  2. `itemMasterState`: สินค้าใหม่แต่รหัสซ้ำ -> `รหัสสินค้า "X" มีอยู่แล้วในระบบ`; แก้ไขแต่ไม่พบ -> `KindNotFound`; ถ้าสินค้ามีรายการใน `ic_trans_detail` แล้ว (`locked`) ค่า `unit_type`, `unit_cost`, `unit_standard`, `cost_type` จะใช้ค่าที่เก็บไว้ทับค่าที่ส่งมา
  3. `checkItemUnits`: ต้องมีหน่วยต้นทุนและหน่วยยอดคงเหลืออยู่ในตารางหน่วยนับ; `unit_type` 2 หรือ 3 (หน่วยขนาน) ต้องมีแถวใน `oppositeUnits`; ถ้าไม่ได้เปิด `erp_option.enable_all_ic_wh_shelf` (และไม่ใช่โหมด sync) ต้องมีแถวคลัง/ที่เก็บอย่างน้อยหนึ่งแถว
  4. `checkBarcodeOwners`: บาร์โค้ดที่เป็นของสินค้าอื่นแล้ว ปฏิเสธ
  5. `writeItemMaster`: `INSERT`/`UPDATE ic_inventory` (บันทึก `create_code`, `last_update_code`, เวลา) และ `ic_inventory_detail.have_point`
  6. `writeItemMasterGrids`: ลบแล้วแทรกใหม่ทั้งชุด `ic_unit_use`, `ic_opposite_unit`, `ic_inventory_barcode`, `ic_wh_shelf`, `ic_standard_cost` (แต่ละตารางส่งเป็น jsonb พารามิเตอร์เดียว); `writeItemImages` เขียนตาราง `images` ตามช่อง `image_order` + `image_url` (กลไกลิงก์ภาพ ต่างจากแนบไฟล์ใน [[proc-doc-item-pictures]])
  7. เขียน `master_logs` (`function_code` 1 = เพิ่ม, 2 = แก้, `computer_name 'WEB'`, `data1` = JSON ของคำขอ)
  8. `itemSavedTx` (`stock_tools.go:553`): ลบ `ic_inventory_detail` กำพร้า, รัน SQL ชุด `itemSavedSQL`, ซิงค์ `ic_serial` ของสินค้า (`rebuildSerialTx`) และคำนวณสต็อก/ยอดคงเหลือสินค้านั้นใหม่ (`rebuildStockTx`) คืนผลใน `ItemMasterSaveResult` (ฝัง `RebuildStockResult`)
- ผลลัพธ์: `{code, ...RebuildStockResult}`

### 2. ลบสินค้า (`ItemMasterDelete`)
- ทำได้เฉพาะเมนูที่ screen_code `0` ("C#: only _displayMode 0 deletes") มิฉะนั้นแจ้งให้ไปลบที่หน้าข้อมูลสินค้า
- รับรหัสได้ไม่เกิน 500 รายการ (`itemDetailGridMax`) ตัดซ้ำ/ว่าง
- สินค้าที่มีรายการใน `ic_trans_detail` ถูกข้าม (คืนใน `used`) ส่วนที่เหลือถูกลบพร้อมตารางลูกใน `itemChildTables` (เช่น `ic_unit_use`, `ic_wh_shelf`, `ic_inventory_barcode`, `ic_standard_cost`, `ic_inventory_price`, `ic_inventory_discount`), `ic_inventory_set_detail` และ `images` แล้วจึงลบ `ic_inventory` พร้อมเขียน `master_logs` (`function_code 3`)
- ผลลัพธ์: `{deleted: [...], used: [...]}`

### 3. ข้อมูลสินค้าเพิ่มเติม (`itemdetail/get|save`)
- `get`: ค้นด้วย `code` หรือ `barcode` (ค้น `ic_inventory_barcode` แบบไม่สนตัวพิมพ์); คืน `{code, editable, data}` ที่ `data` เป็น JSON หนึ่งก้อนต่อแท็บ (คิวรีเดียว `itemDetailQuery` ใช้ `jsonb_build_object`), `editable` = `ic_inventory.update_detail = 1`; รันใน transaction แบบอ่านอย่างเดียว
- `save` ฟิลด์: `item` (คอลัมน์ `ic_inventory` ใน `itemSpecs`: ยี่ห้อ รูปแบบ ดีไซน์ เกรด รุ่น ชนิด กลุ่มหลัก/ย่อย ชั้น คำอธิบาย ค่าคอมมิชชัน รูปแบบซีเรียล หมายเหตุ), `detail` (คอลัมน์ `ic_inventory_detail` ใน `detailSpecs`: มิติ 1-45, คลัง/ที่เก็บ/หน่วยตั้งต้นซื้อ-ขาย-เบิก, กลุ่มผู้ใช้ฝ่ายต่าง ๆ, `purchase_point`, `minimum_qty`, `maximum_qty` และธง `have_point`, `balance_control`, `accrued_control`, `lock_cost`, `is_end`, `lock_price`, `lock_discount`, `is_hold_purchase`, `is_hold_sale`, `is_premium`) และตาราง 11 ชุด: `market`, `billing`, `short`, `pos` (ตารางชื่อ), `colors`, `sizes`, `patterns`, `replace`, `bundle`, `suggest`, `manufacturers`
- คอลัมน์ที่มี `lookup` ต้องมีรหัสนั้นอยู่ในตารางอ้างอิง (ตรวจแบบพิมพ์ใหญ่); ธง ต้องเป็น "0"/"1"; ตัวเลข `^\d{1,15}(\.\d{1,6})?$` (ไม่ติดลบ); `description` เก็บช่องว่างนำหน้า/ขึ้นบรรทัดไว้
- `cleanRows` ตัดบรรทัดว่าง ตรวจความยาว และปฏิเสธคีย์ซ้ำสำหรับ `colors`/`sizes`/`patterns`/`manufacturers` (ตารางมี PK `(code, ic_code)`)
- ใน transaction: ล็อกแถว `ic_inventory ... FOR UPDATE`; `update_detail <> 1` -> `KindConflict` "สินค้านี้ยังไม่พร้อมแก้ไข"; เพิ่มแถว `ic_inventory_detail` ที่ขาดอยู่ (ยกเว้น `item_type = 5`); `UPDATE` ตามคอลัมน์ที่ส่งมา; แล้วลบ-แทรกตารางย่อย; สุดท้ายอ่านสินค้ากลับมาเป็น `ItemDetailView`

## จุดที่ต้องระวัง
- การที่สินค้ามีเคลื่อนไหวแล้ว (`locked`) ทำให้ค่าหน่วย/ชนิดต้นทุนที่แก้ไม่มีผล (ถูกแทนที่ด้วยค่าที่เก็บ) โดยไม่แจ้ง error
- `update_detail` และ `update_price` ใน `ic_inventory` เป็น gate ที่หน้าราคา/ส่วนลด ([[proc-master-data]]), รูปสินค้า ([[proc-doc-item-pictures]]) และข้อมูลเพิ่มเติมใช้ร่วมกัน
- ลบสินค้าที่ถูกใช้แล้วไม่ใช่ error: ได้ HTTP สำเร็จพร้อมรายชื่อใน `used`

## ที่มาในโค้ด
- `backend/internal/application/process/item_master.go:14-35` - คอมเมนต์หลัก, `itemMasterScreen`
- `backend/internal/application/process/item_master.go:42-70` - `itemMasterSpecs`, ค่าตั้งต้น
- `backend/internal/application/process/item_master.go:133-162` - `ItemMasterSaveInput`, `ItemMasterSaveResult`
- `backend/internal/application/process/item_master.go:218` - `parseItemMaster`; `:521` `checkItemUnits`; `:541` `checkChangeMaster`
- `backend/internal/application/process/item_master.go:559` - `ItemMasterSave`; `:627` `itemMasterState`; `:654` `checkBarcodeOwners`
- `backend/internal/application/process/item_master.go:676` - `writeItemMaster`; `:719` `writeItemMasterGrids`; `:779` `writeItemImages`
- `backend/internal/application/process/item_master.go:812` - `itemChildTables`; `:817` `ItemMasterDelete`
- `backend/internal/application/process/item_detail.go:35-87` - `fieldSpec`, `itemSpecs`, `detailSpecs`
- `backend/internal/application/process/item_detail.go:194` - `itemDetailLoad`; `:221` `ItemDetailGet`; `:246` `ItemDetailSaveInput`; `:367` `ItemDetailSave`; `:464` `itemDetailSaveGrids`
- `backend/internal/application/process/stock_tools.go:553` - `itemSavedTx`
- `backend/internal/adapter/inbound/http/process/itemdetail_handler.go:14-44` - handler `itemdetail`, `itemmaster`
- `backend/internal/adapter/inbound/http/process/permission.go:81` - สิทธิ์ add/edit ของ `itemmaster/save`

## ดูเพิ่ม
- [[proc-master-data]]
- [[proc-doc-item-pictures]]
- [[proc-barcode]]
- [[proc-stock-tools]]
- [[proc-permission-rights]]
- [[process-overview]]
