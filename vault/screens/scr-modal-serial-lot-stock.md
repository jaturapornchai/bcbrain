---
title: "ป๊อปอัปซีเรียล ล็อต ยอดคงเหลือ ประวัติ สินค้าทดแทน (SerialNumberModal / LotModal / StockBalanceModal / ItemHistoryModal / ItemReplacementModal)"
tags: [screens, transaction]
aliases: ["SerialNumberModal", "LotModal", "StockBalanceModal", "ItemHistoryModal", "ItemReplacementModal", "Ctrl+1", "Ctrl+2", "Ctrl+6", "Ctrl+8", "ยอดคงเหลือ", "ซีเรียลนัมเบอร์", "สินค้าทดแทน"]
sources: ["frontend/account/transaction/SerialNumberModal.tsx:18", "frontend/account/transaction/SerialNumberModal.tsx:63", "frontend/account/transaction/LotModal.tsx:62", "frontend/account/transaction/StockBalanceModal.tsx:101", "frontend/account/transaction/ItemHistoryModal.tsx:48", "frontend/account/transaction/ItemReplacementModal.tsx:48", "frontend/account/transaction/UniversalTransScreen.tsx:4228", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:3993", "frontend/account/master/BcLookupModal.tsx:1100", "backend/internal/application/process/stock_beginning.go:220"]
---
# ป๊อปอัปประจำแถวสินค้า: ซีเรียล · ล็อต · ยอดคงเหลือ · ประวัติ · สินค้าทดแทน

ห้าป๊อปอัปในโฟลเดอร์ `frontend/account/transaction/` ที่เปิดจากแถวสินค้า (ปุ่มในแถว ปุ่มใต้ตาราง คีย์ลัด หรือเมนูคลิกขวา ขึ้นกับจอ) ทุกตัวเป็นกล่องซ้อน (`fixed inset-0 z-50`) รับ `itemCode/itemName` และอ่านข้อมูลด้วย `queryList` (ส่ง SQL ไป `POST /api/query/list`, `frontend/src/lib/query-client.ts:16-20`) ไม่มี API เขียนข้อมูลของตัวเอง **ตัวป๊อปอัปแค่ส่งค่ากลับให้หน้าจอที่เรียก** แล้วหน้าจอนั้นเป็นคนบันทึก (ดู [[scr-universal-trans]], [[scr-stock-beginning-balance]])

| ป๊อปอัป | เปิดด้วย | ใช้ในจอ |
|---|---|---|
| `SerialNumberModal` | จอ transaction ทั่วไป: ไอคอนบาร์โค้ดท้ายแถว หรือปุ่ม "Serial Number" ใต้ตาราง; จอยกยอด: ปุ่ม "บันทึก/ดู Serial Number" และเมนูคลิกขวา | `UniversalTransScreen.tsx:4248`, `StockBeginningBalanceScreen.tsx:4025` |
| `LotModal` | จอยกยอด: Ctrl/Alt+8, ปุ่ม "บันทึก/ดูข้อมูล Lot สินค้า", เมนูคลิกขวา | **เฉพาะ** `StockBeginningBalanceScreen.tsx:4052` |
| `StockBalanceModal` | จอ transaction ทั่วไป: ไอคอนกล่องท้ายแถว หรือปุ่ม "เช็คสต็อกคลัง"; จอยกยอด: Ctrl/Alt+2 และเมนูคลิกขวา; หน้าค้นหาสินค้า: ปุ่ม "ยอดคงเหลือตามคลัง" | `UniversalTransScreen.tsx:4228`, `StockBeginningBalanceScreen.tsx:3993`, `BcLookupModal.tsx:1100` |
| `ItemHistoryModal` | จอยกยอด: Ctrl/Alt+1 และเมนูคลิกขวา | **เฉพาะ** `StockBeginningBalanceScreen.tsx:4003` |
| `ItemReplacementModal` | จอยกยอด: Ctrl/Alt+6 และเมนูคลิกขวา | **เฉพาะ** `StockBeginningBalanceScreen.tsx:4077` |

ปุ่มลัดทั้งหมดในตารางของจอ transaction ทั่วไปดู [[scr-trans-item-grid]]; ป๊อปอัปราคา/เครดิตดู [[scr-modal-price-credit]]; ป๊อปอัปเอกสาร/หมายเหตุ/ชื่อสินค้าดู [[scr-modal-document-item]]

## ซีเรียลนัมเบอร์ (`SerialNumberModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, docNo?, transFlag?, qty, isEditing?, initialSerials?, onSaveSerials?(serials: string[])` (`SerialNumberModal.tsx:18-29`)
- **ข้อมูลที่โหลด**: (1) ซีเรียลพร้อมใช้ของสินค้า จาก `ic_serial` ที่ `COALESCE(status, 0) = 0` เรียง `serial_number` สูงสุด **100 รายการ** (`:63-70`); (2) ถ้าเปิดแบบดูอย่างเดียวและหน้าจอไม่ได้ส่ง `initialSerials` มา → ดึงซีเรียลของเอกสารจาก `ic_trans_serial_number` (`doc_no`, `ic_code`, `COALESCE(last_status, 0) = 0`, ตรง `trans_flag` ถ้าส่งมา) (`:78-89`)
- **แถบนับ**: "จำนวนในแถวบิล" = `qty` ของแถว และ "ระบุซีเรียลแล้ว" = จำนวนที่เลือก สีเขียวเมื่อเท่ากัน สีส้มเมื่อเกิน และสีหลักของระบบ (`brand`) เมื่อยังขาด (`:171-190`)
- **สองแท็บ**: "รายการในเอกสาร (N)" และ "ซีเรียลในคลัง (N)" (`:204, :216`)
- **เพิ่ม S/N** (เฉพาะขณะแก้ไข): ช่องรับการพิมพ์/สแกน กด Enter หรือปุ่ม "เพิ่ม S/N" ระบบ `trim()` + ตัวพิมพ์ใหญ่ และไม่เพิ่มซ้ำกับที่เลือกอยู่แล้ว (`:105-111, :225-250`) ผู้ใช้พิมพ์ซีเรียลที่ไม่อยู่ในคลังได้ (ใช้กรณีรับเข้าซีเรียลใหม่) ปุ่มถังขยะ "ลบซีเรียลนี้" ลบออกจากรายการที่เลือก (`:113-115, :271-280`)
- แท็บคลัง: ตาราง Serial Number · คลัง · ที่เก็บ · สถานะ · เลือก (ปุ่ม "เลือก" / ป้าย "เลือกแล้ว") (`:299-345`)
- ปุ่ม **บันทึก S/N** (แสดงเฉพาะขณะแก้ไข) ส่งรายการกลับ (`onSaveSerials`) แล้วปิด; ปุ่ม "ปิด" ทิ้งการเปลี่ยนแปลง (`:117-122, :359-365`)
- ในจอ transaction ทั่วไป ค่าที่ส่งกลับถูกเก็บในแถว `serials` และตั้ง `is_serial_number = 1` ถ้ามีซีเรียลอย่างน้อย 1 ตัว (`UniversalTransScreen.tsx:4258-4266`) ส่วนจอยกยอดเก็บเฉพาะ `serials` ของแถว (`StockBeginningBalanceScreen.tsx:4036-4048`) ป๊อปอัปกันซ้ำได้แค่ภายในรายการที่เลือกในแถวนั้น ส่วนการตรวจซีเรียลซ้ำของสินค้าเดียวกันทั้งเอกสาร และความยาวไม่เกิน 50 ตัว ทำที่ Go ตอนบันทึกจอยกยอด (`backend/internal/application/process/stock_beginning.go:220-234`)

## ล็อตสินค้า (`LotModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, docNo?, isEditing?, initialLot?, onSaveLot?(lot)` โดย `LotData` = `lot_number, mfd_date?, exp_date?, mfn_name?` (`LotModal.tsx:11-26`)
- **ข้อมูลที่โหลด**: ล็อตเดิมของสินค้านี้จาก `ic_inventory_lot` (`item_code`) เรียง `roworder, lot_number` สูงสุด **50 รายการ** (`:62-70`)
- **ฟอร์มบน** "ข้อมูลล็อตประจำแถวนี้": หมายเลขล็อต (Lot Number, ตัวอย่าง "LOT-2026-001"), ผู้ผลิต/แหล่งกำเนิด (MFG Name), วันที่ผลิต (MFD Date), วันหมดอายุ (EXP Date) ทั้งหมดแก้ได้เฉพาะขณะแก้ไข (`:157-221`, `disabled={!isEditing}` ที่ `:175, :194, :211, :218`)
- **ตารางล่าง** "ประวัติรุ่นการผลิต / ล็อตที่เคยมีในระบบ": คลิกแถว (ขณะแก้ไข) = คัดลอกค่าขึ้นฟอร์มบน (`:92-97, :252`)
- ปุ่ม **บันทึกล็อต** ตัดช่องว่างหัวท้ายแล้วส่งกลับ (`:99-108`) **ไม่มีการตรวจ** ว่าเลขล็อตว่าง หรือวันหมดอายุก่อนวันผลิต
- หัวข้อบอก "(Ctrl+8)" (`:126`) แต่ป๊อปอัปไม่ผูกคีย์เอง คีย์ลัดอยู่ที่จอยกยอด (`StockBeginningBalanceScreen.tsx:1881`)
- ฝั่ง Go เขียนล็อตลง `ic_trans_detail_lot` เฉพาะแถวที่เลขล็อตไม่ว่าง (เลขล็อตยาวได้ไม่เกิน 50 ตัว และตรวจรูปแบบวันที่ผลิต/หมดอายุ) (`backend/internal/application/process/stock_beginning.go:235-247` ตรวจ, `:550-555` คำสั่ง INSERT) ดู [[scr-stock-beginning-balance]]

## ยอดสินค้าคงเหลือ (`StockBalanceModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, isEditing?, onSelectWhShelf?(whCode, shelfCode)` (`StockBalanceModal.tsx:36-43`)
- **การ์ดสรุป** 4 ใบ (`:215-266`) จาก `ic_inventory` แถวเดียวของสินค้า ยอดทุกช่องหารด้วยอัตราส่วน `stand_value/divide_value` ของหน่วยมาตรฐานให้เป็นหน่วยมาตรฐาน (`:67-72`): ยอดคงเหลือรวม (+ คงเหลือขนาน ถ้าสินค้ามีหน่วยขนาน `unit_type` 2 หรือ 3 `:232-236`), ยอดจอง (`book_out_qty`), ยอดค้างส่ง (`accrued_out_qty`), ยอดค้างรับ (สั่งซื้อ) (`accrued_in_qty`) ยอดคงเหลือรวมอ่านจาก `ic_inventory.balance_qty` ทั้งสินค้า ไม่ผ่านตัวกรองสิทธิ์คลัง
- **หลายหน่วยนับ**: ถ้า `unit_type` เป็น 1 หรือ 3 หรือสินค้ามีหน่วยใช้งานมากกว่า 1 (`:167`) การ์ดแรกเพิ่มบรรทัด "คงเหลือ ..." แบบทอนหน่วย และตารางเพิ่มคอลัมน์ "คงเหลือ (ทอนหน่วย)" ด้วย `formatPackingBreakdown` (`:168, :227-231, :300-302, :335-339`) ดู [[fe-numeric-money]]
- **ตารางแยกคลัง/ที่เก็บ**: รหัสคลัง · ชื่อคลังสินค้า · ที่เก็บ (Shelf) · คงเหลือ · (คงเหลือขนาน) · มูลค่ารวม · (ทอนหน่วย) · (เลือกใช้) (`:288-307`) สูตร: รวม `ic_trans_detail` ของสินค้านี้ `qty x (stand_value/divide_value) x calc_flag` จัดกลุ่มตามคลัง+ที่เก็บ ตัดแถวที่ผลรวมปริมาณ = 0 (`HAVING`, `:119`) มูลค่า = `sum_of_cost` (ถ้าไม่มีใช้ `sum_amount`) x `calc_flag` (`:101-120`)
- **สิทธิ์คลัง/ที่เก็บ**: ผ่าน `getWhPermFilter()` (`frontend/src/lib/query-client.ts:643`; เงื่อนไข `rows`, `balance`, `valueOnly`) — โหลดสิทธิ์ไม่สำเร็จ = ไม่แสดงตารางและขึ้น "โหลดสิทธิ์คลัง/ที่เก็บไม่สำเร็จ: ..." ถ้าผู้ใช้เห็นได้แค่มูลค่า (`valueOnly`) ปริมาณจะเป็น 0 (`StockBalanceModal.tsx:94-98, :110-113`) ดู [[proc-permission-rights]]
- **เลือกใช้**: เมื่อ `isEditing` และหน้าจอส่ง `onSelectWhShelf` จะมีคอลัมน์ "เลือกใช้" และคลิกแถว/ปุ่ม "เลือก" นำรหัสคลัง+ที่เก็บไปใส่ในแถวสินค้าแล้วปิด (`:303-304, :310-313, :340-352`) สามที่เรียกใช้ต่างกัน
  - จอ transaction ทั่วไป: แปลง "-" กลับเป็นค่าว่าง แล้วตรวจสิทธิ์ใช้คลัง/ที่เก็บด้วย `checkWhPick` (`whPickAllowed`) ก่อนใส่ ถ้าไม่ผ่านขึ้น "ไม่มีสิทธิ์ใช้คลัง/ที่เก็บนี้" (`UniversalTransScreen.tsx:2089-2095, :4234-4244`; `query-client.ts:630`)
  - จอยกยอด: `handleSelectWhShelfFromBalance` ใส่ค่าลงแถวตรง ๆ ไม่มีการตรวจสิทธิ์ที่จุดนี้ (`StockBeginningBalanceScreen.tsx:1183-1196`)
  - หน้าค้นหาสินค้า (`BcLookupModal`): ปุ่ม "เลือกตามคลัง/ที่เก็บ" และ "เลือกตามคลัง/ที่เก็บ/หน่วยนับ" เปิดป๊อปอัปนี้แบบเลือกได้ ส่วนปุ่ม "ยอดคงเหลือตามคลัง" เปิดแบบดูอย่างเดียว ทั้งสามเป็นปุ่มเมาส์ (ไม่มีคีย์ลัด; ตัวจับคีย์มีเฉพาะ Esc, ลูกศรขึ้น/ลง, Enter, PageUp/PageDown, Ctrl+B) ค่าที่เลือกถูกแปลง "-" กลับเป็นค่าว่างก่อนส่งต่อ `onPickWithLocation` (`BcLookupModal.tsx:463-470, :487-521, :664-705, :1098-1119`) ดู [[scr-data-list-and-lookup]]
- **Esc** ผูกที่ `window` ระยะ capture แล้วหยุดการส่งต่อ (`stopPropagation`) จึงปิดเฉพาะป๊อปอัปนี้ ไม่ปิดจอด้านล่าง (`StockBalanceModal.tsx:150-162`)
- ตัวเลขจำนวนใช้ทศนิยมจาก `getBcDecimals("qty")` และแสดงด้วย `formatMoneyDisplay` ดู [[fe-numeric-money]]
- ข้อมูลเชิงธุรกิจของยอดคงเหลือ/ต้นทุนดู [[proc-stock-tools]]

## ประวัติการเคลื่อนไหวสินค้า (`ItemHistoryModal`)
- ดึงจาก `ic_trans_detail` ของสินค้านั้นทุกประเภทเอกสาร (LEFT JOIN `ic_trans` ด้วย `doc_no` + `trans_flag` เอา `cust_code`) เรียงวันที่/เวลา/เลขที่ใหม่สุดก่อน **50 รายการ** (`ItemHistoryModal.tsx:48-55`)
- คอลัมน์: วันที่เอกสาร (+เวลา) · เลขที่เอกสาร · คลัง/ที่เก็บ · หน่วยนับ · จำนวน (+ จำนวนขนานในวงเล็บ) · ราคา/หน่วย · รวมมูลค่า ใช้ทศนิยม qty/price/amount จาก `getBcDecimals` (`:155-213`) ค่าตัวเลขถูกแปลงด้วย `Number(...)` เพื่อแสดงผลอย่างเดียว (`:56-80`)
- **ไม่แสดงประเภทเอกสาร (`trans_flag`) และ `cust_code`** แม้ query ดึงมา และ **ไม่กรองเอกสารที่ยกเลิก** (ไม่มี `last_status` ใน WHERE) จึงปนทั้งรายการรับ/จ่าย/ย้ายคลังและเอกสารที่ถูกยกเลิก
- ท้ายป๊อปอัป: "แสดงรายการเคลื่อนไหวล่าสุด 50 รายการ" (`:213`); ไม่มีปุ่มเลือก (ดูอย่างเดียว)

## สินค้าทดแทน (`ItemReplacementModal`)
- ดึงจาก `ic_inventory_replacement` (คอลัมน์ `ic_code`, `ic_replace_code`, `remark`) JOIN `ic_inventory` เพื่อเอาชื่อ หน่วยมาตรฐาน หน่วยขนาน และคงเหลือ เรียงตาม `line_number, roworder` (`ItemReplacementModal.tsx:48-60`)
- คอลัมน์: รหัสสินค้าทดแทน · ชื่อสินค้า · หน่วย · คงเหลือ (+ คงเหลือขนาน) · หมายเหตุ · (เลือกใช้ = ปุ่ม "แทนที่") (`:150-190`)
- กด "แทนที่" (ขณะแก้ไข) เรียก `onSelectReplacement(รหัส, ชื่อ, หน่วย)` แล้วปิด (`:82-87`) ใน `StockBeginningBalanceScreen` จอเรียกเฉพาะ `handleItemCodeLookup(rowIndex, รหัสใหม่)` — รหัสใหม่ผ่านการเลือกสินค้าปกติ (ชื่อ/หน่วยที่ป๊อปอัปส่งมาไม่ถูกใช้) (`StockBeginningBalanceScreen.tsx:4077-4087`)
- ป๊อปอัปนี้อ่านอย่างเดียว ผู้บันทึกตาราง `ic_inventory_replacement` คือหน้าข้อมูลสินค้า 2 (กริด "A.สินค้าทดแทน" `ItemDetail2Screen.tsx:67`) ผ่าน Go `backend/internal/application/process/item_detail.go:524-530` ดู [[scr-item-detail-2]], [[scr-item-master]]
- **ข้อสังเกตที่ยังไม่ได้ verify กับข้อมูลจริง**: ฝั่งหน้าข้อมูลสินค้า 2 บันทึก `ic_replace_code` = สินค้าที่กำลังแก้ และ `ic_code` = สินค้าที่ใส่ในกริด แล้วอ่านกลับด้วย `WHERE r.ic_replace_code = $1` (`item_detail.go:182, :524-530`) แต่ป๊อปอัปนี้อ่านด้วย `WHERE r.ic_code = <สินค้าในแถว>` แล้วแสดง `ic_replace_code` เป็น "รหัสสินค้าทดแทน" (`ItemReplacementModal.tsx:57-60`) ทิศของสองคอลัมน์จึงกลับกันระหว่างตัวบันทึกกับตัวอ่าน — ถ้าจะใช้ฟีเจอร์นี้จริงควรทดสอบกับข้อมูลที่ตั้งไว้ในกริดก่อน

## ข้อควรระวัง
- ป๊อปอัปไม่ตรวจความถูกต้องทางธุรกิจ (จำนวนซีเรียลเท่ากับ qty, วันหมดอายุ ฯลฯ) — ที่ตรวจจริงมีเท่าที่ Go ทำตอนบันทึกจอยกยอด (ซีเรียลซ้ำ ความยาว รูปแบบวันที่ล็อต)
- ตารางสถานะซีเรียลมีข้อความ "ตัดจ่ายแล้ว" แต่ query ดึงเฉพาะ `status = 0` จึงเห็นแต่ "พร้อมใช้" (`SerialNumberModal.tsx:321` ดูคู่กับ `:67`)
- มีเพียงจอยกยอดสินค้าคงเหลือที่เปิดล็อต ประวัติ และสินค้าทดแทนได้ จอ transaction ทั่วไปไม่มีปุ่มเหล่านี้ (ค้นด้วย `<LotModal`/`<ItemHistoryModal`/`<ItemReplacementModal` ทั่ว `frontend/account` พบเฉพาะ `StockBeginningBalanceScreen.tsx`)
- คีย์ Ctrl/Alt+1, 2, 6, 8 ของจอยกยอดทำงานเฉพาะแท็บ "รายละเอียด" (`activeTab === "detail"`, ปุ่มแท็บที่ `:2284-2294`) และแถวที่เลือกมีรหัสสินค้า (`StockBeginningBalanceScreen.tsx:1819-1893`) ส่วน Esc ของจอนั้นปิดซีเรียล ล็อต สินค้าทดแทน และประวัติก่อน (`:1758-1790`)

## ที่มาในโค้ด
- `frontend/account/transaction/SerialNumberModal.tsx:18-29` props; `:56-95` โหลด; `:105-122` เพิ่ม/ลบ/บันทึก; `:171-217` แถบนับ/แท็บ; `:225-250` ช่องเพิ่ม; `:299-345` ตารางคลัง; `:351-370` ท้าย
- `frontend/account/transaction/LotModal.tsx:11-26` ชนิด; `:62-70` โหลด; `:92-108` เลือก/บันทึก; `:157-221` ฟอร์ม; `:226-290` ตารางล่าง/ท้าย
- `frontend/account/transaction/StockBalanceModal.tsx:36-43` props; `:59-143` โหลด; `:150-162` Esc; `:167-168` หลายหน่วย; `:215-266` การ์ด; `:288-358` ตาราง
- `frontend/account/transaction/ItemHistoryModal.tsx:48-80` โหลด; `:155-213` ตาราง
- `frontend/account/transaction/ItemReplacementModal.tsx:48-87` โหลด/เลือก; `:150-190` ตาราง
- การใช้งาน: `UniversalTransScreen.tsx:2089-2095, 3724-3746, 3763-3785, 4227-4268`; `StockBeginningBalanceScreen.tsx:1183-1196, 1819-1893, 2832, 2910-2982, 3855-3925, 3993-4087`; `BcLookupModal.tsx:463-521, 664-705, 1098-1119`; `TransItemGrid.tsx:1000-1018, 1106-1113`
- ฝั่ง Go: `backend/internal/application/process/stock_beginning.go:220-247, 544-555, 603-612`; `backend/internal/application/process/item_detail.go:182, 524-530`
- ดูเพิ่ม: [[fe-transaction-screens]] · [[fe-grid-component]] · [[screens-overview]]
