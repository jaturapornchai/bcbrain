---
title: "ป๊อปอัปซีเรียล ล็อต ยอดคงเหลือ ประวัติ สินค้าทดแทน (SerialNumberModal / LotModal / StockBalanceModal / ItemHistoryModal / ItemReplacementModal)"
tags: [screens, transaction]
aliases: ["SerialNumberModal", "LotModal", "StockBalanceModal", "ItemHistoryModal", "ItemReplacementModal", "Ctrl+1", "Ctrl+2", "Ctrl+6", "Ctrl+8", "ยอดคงเหลือ", "ซีเรียลนัมเบอร์", "สินค้าทดแทน"]
sources: ["frontend/account/transaction/SerialNumberModal.tsx:18", "frontend/account/transaction/SerialNumberModal.tsx:56", "frontend/account/transaction/LotModal.tsx:62", "frontend/account/transaction/StockBalanceModal.tsx:56", "frontend/account/transaction/ItemHistoryModal.tsx:46", "frontend/account/transaction/ItemReplacementModal.tsx:46", "frontend/account/transaction/UniversalTransScreen.tsx:4160", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:3938", "frontend/account/master/BcLookupModal.tsx:1068"]
---
# ป๊อปอัปประจำแถวสินค้า: ซีเรียล · ล็อต · ยอดคงเหลือ · ประวัติ · สินค้าทดแทน

ห้าป๊อปอัปในโฟลเดอร์ `frontend/account/transaction/` ที่เปิดจากแถวสินค้า (ปุ่มคำสั่งในตาราง คีย์ลัด หรือเมนูคลิกขวา) ทุกตัวเป็นกล่องซ้อน (`fixed inset-0 z-50`) รับ `itemCode/itemName` และอ่านข้อมูลด้วย `queryList` (ส่ง SQL ไป `POST /api/query/list`, `query-client.ts:19`) ไม่มี API เขียนข้อมูลของตัวเอง **ตัวป๊อปอัปแค่ส่งค่ากลับให้หน้าจอที่เรียก** แล้วหน้าจอนั้นเป็นคนบันทึก (ดู [[scr-universal-trans]], [[scr-stock-beginning-balance]])

| ป๊อปอัป | เปิดด้วย | ใช้ในจอ |
|---|---|---|
| `SerialNumberModal` | ปุ่มซีเรียลในตาราง / เมนูคลิกขวา | `UniversalTransScreen` (`:4180`), `StockBeginningBalanceScreen` |
| `LotModal` | Ctrl/Alt+8 | **เฉพาะ** `StockBeginningBalanceScreen` (`:3997`) |
| `StockBalanceModal` | Ctrl/Alt+2 | `UniversalTransScreen` (`:4160`), `StockBeginningBalanceScreen` (`:3938`), `BcLookupModal` (F8/F3/F4 `:1068`) |
| `ItemHistoryModal` | Ctrl/Alt+1 | **เฉพาะ** `StockBeginningBalanceScreen` (`:3948`) |
| `ItemReplacementModal` | Ctrl/Alt+6 | **เฉพาะ** `StockBeginningBalanceScreen` (`:4022`) |
ปุ่มลัดทั้งหมดในตารางของจอ transaction ทั่วไปดู [[scr-trans-item-grid]]; ป๊อปอัปราคา/เครดิตดู [[scr-modal-price-credit]]; ป๊อปอัปเอกสาร/หมายเหตุ/ชื่อสินค้าดู [[scr-modal-document-item]]

## ซีเรียลนัมเบอร์ (`SerialNumberModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, docNo?, transFlag?, qty, isEditing, initialSerials, onSaveSerials(serials: string[])` (`:18-29`)
- **ข้อมูลที่โหลด**: (1) ซีเรียลพร้อมใช้ของสินค้า จาก `ic_serial` ที่ `status = 0` เรียง `serial_number` สูงสุด **100 รายการ** (`:63-70`); (2) ถ้าเปิดแบบดูอย่างเดียวและหน้าจอไม่ได้ส่ง `initialSerials` มา → ดึงซีเรียลของเอกสารจาก `ic_trans_serial_number` (`doc_no`, `ic_code`, `last_status = 0`, ตรง `trans_flag`) (`:78-89`)
- **หัวป๊อปอัป**: "จำนวนในแถวบิล" = `qty` ของแถว และ "ระบุซีเรียลแล้ว" = จำนวนที่เลือก สีเขียวเมื่อเท่ากัน ส้มเมื่อเกิน สีน้ำเงินเมื่อยังขาด (`:171-190`)
- **สองแท็บ**: "รายการในเอกสาร (N)" และ "ซีเรียลในคลัง (N)" (`:193-217`)
- **เพิ่ม S/N** (เฉพาะขณะแก้ไข): พิมพ์หรือสแกนแล้วกด Enter หรือปุ่ม "เพิ่ม S/N" ระบบ `trim()` + ตัวพิมพ์ใหญ่ และไม่เพิ่มซ้ำกับที่เลือกอยู่แล้ว (`:105-111`) ผู้ใช้พิมพ์ซีเรียลที่ไม่อยู่ในคลังได้ (ใช้กรณีรับเข้าซีเรียลใหม่)
- แท็บคลัง: ตาราง Serial Number · คลัง · ที่เก็บ · สถานะ · เลือก (ปุ่ม "เลือก" / ป้าย "เลือกแล้ว") (`:299-345`)
- ปุ่ม **บันทึก S/N** ส่งรายการกลับ (`onSaveSerials`) แล้วปิด; ปุ่ม "ปิด" ทิ้งการเปลี่ยนแปลง (`:117-122, :359-365`)
- ในจอ transaction ทั่วไป ค่าที่ส่งกลับถูกเก็บในแถว `serials` และตั้ง `is_serial_number = 1` ถ้ามีซีเรียลอย่างน้อย 1 ตัว (`UniversalTransScreen.tsx:4180-4198`) ป๊อปอัปกันซ้ำได้แค่ภายในรายการที่เลือกในแถวนั้น ส่วนการตรวจซีเรียลซ้ำทั้งเอกสารของจอยกยอดทำที่ Go (`stock_beginning.go:225-233`)

## ล็อตสินค้า (`LotModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, docNo?, isEditing, initialLot, onSaveLot(lot)` โดย `LotData` = `lot_number, mfd_date, exp_date, mfn_name` (`:11-26`)
- **ข้อมูลที่โหลด**: ล็อตเดิมของสินค้านี้จาก `ic_inventory_lot` เรียง `roworder, lot_number` สูงสุด **50 รายการ** (`:62-70`)
- **ฟอร์มบน** "ข้อมูลล็อตประจำแถวนี้": หมายเลขล็อต (Lot Number, ตัวอย่าง "LOT-2026-001"), ผู้ผลิต/แหล่งกำเนิด (MFG Name), วันที่ผลิต (MFD Date), วันหมดอายุ (EXP Date) ทั้งหมดแก้ได้เฉพาะขณะแก้ไข (`:157-221`)
- **ตารางล่าง** "ประวัติรุ่นการผลิต / ล็อตที่เคยมีในระบบ": คลิกแถว (ขณะแก้ไข) = คัดลอกค่าขึ้นฟอร์มบน (`:92-97`)
- ปุ่ม **บันทึกล็อต** ตัดช่องว่างหัวท้ายแล้วส่งกลับ (`:99-108`) **ไม่มีการตรวจ** ว่าเลขล็อตว่าง หรือวันหมดอายุก่อนวันผลิต
- หัวข้อบอก "(Ctrl+8)" แต่ป๊อปอัปไม่ผูกคีย์เอง คีย์ลัดอยู่ที่จอที่เรียก
- ฝั่ง Go เขียนล็อตลง `ic_trans_detail_lot` เฉพาะแถวที่เลขล็อตไม่ว่าง (ยาวได้ไม่เกิน 50 ตัว และตรวจรูปแบบวันที่ผลิต/หมดอายุ) (`stock_beginning.go:235-245`) ดู [[scr-stock-beginning-balance]]

## ยอดสินค้าคงเหลือ (`StockBalanceModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, isEditing, onSelectWhShelf(whCode, shelfCode)` (`:34-41`)
- **การ์ดสรุป** (จาก `ic_inventory` แถวเดียว หาร `stand_value/divide_value` ของหน่วยมาตรฐานให้เป็นหน่วยมาตรฐาน `:65-67`): ยอดคงเหลือรวม (+ คงเหลือขนาน ถ้าสินค้ามีหน่วยขนาน), ยอดจอง (`book_out_qty`), ยอดค้างส่ง (`accrued_out_qty`), ยอดค้างรับ (สั่งซื้อ) (`accrued_in_qty`) (`:226-250`) ยอดคงเหลือรวมเป็น "ทั้งสินค้า ไม่กรองตามสิทธิ์คลัง" ตามคอมเมนต์ที่อ้าง C# `_icBalanceForm.cs:244-282`
- **ตารางแยกคลัง/ที่เก็บ**: รหัสคลัง · ชื่อคลังสินค้า · ที่เก็บ (Shelf) · คงเหลือ · (คงเหลือขนาน) · มูลค่ารวม · (เลือกใช้) (`:272-290`) สูตร: รวม `ic_trans_detail` ของสินค้านี้ `qty x (stand_value/divide_value) x calc_flag` จัดกลุ่มตามคลัง+ที่เก็บ ตัดแถวที่ผลรวม = 0 (`HAVING`, `:110`) มูลค่า = `sum_of_cost` (ถ้าไม่มีใช้ `sum_amount`) x `calc_flag` (`:88-112`)
- **สิทธิ์คลัง/ที่เก็บ**: ผ่าน `getWhPermFilter()` (เงื่อนไข `rows`, `balance`, `valueOnly`) — โหลดสิทธิ์ไม่สำเร็จ = ไม่แสดงตารางและขึ้น "โหลดสิทธิ์คลัง/ที่เก็บไม่สำเร็จ: ..." ถ้าผู้ใช้เห็นได้แค่มูลค่า (`valueOnly`) ปริมาณจะเป็น 0 (`:85-107`) ดู [[proc-permission-rights]]
- **เลือกใช้**: เมื่อ `isEditing` และหน้าจอส่ง `onSelectWhShelf` จะมีคอลัมน์ "เลือกใช้" และคลิกแถว/ปุ่ม "เลือก" นำรหัสคลัง+ที่เก็บไปใส่ในแถวสินค้าแล้วปิด (`:285-325`) `StockBeginningBalanceScreen` ใช้ฟีเจอร์นี้ (`handleSelectWhShelfFromBalance` `:1182-1195`) ส่วนในหน้าค้นหาสินค้า (`BcLookupModal`) ใช้ F8 = ดูอย่างเดียว, F3/F4 = เลือกพร้อมคลัง/ที่เก็บ โดยแปลง "-" กลับเป็นค่าว่างก่อนส่งต่อ (`BcLookupModal.tsx:1068-1086`)
- **Esc** ผูกที่ `window` ระยะ capture แล้วหยุดการส่งต่อ (`stopPropagation`) จึงปิดเฉพาะป๊อปอัปนี้ ไม่ปิดจอด้านล่าง (`:141-152`)
- ตัวเลขจำนวนใช้ทศนิยมจาก `getBcDecimals("qty")` และแสดงด้วย `formatMoneyDisplay` ดู [[fe-numeric-money]]
- ข้อมูลเชิงธุรกิจของยอดคงเหลือ/ต้นทุนดู [[proc-stock-tools]]

## ประวัติการเคลื่อนไหวสินค้า (`ItemHistoryModal`)
- ดึงจาก `ic_trans_detail` ของสินค้านั้นทุกประเภทเอกสาร (LEFT JOIN `ic_trans` เอา `cust_code`) เรียงวันที่/เวลา/เลขที่ใหม่สุดก่อน **50 รายการ** (`:49-55`)
- คอลัมน์: วันที่เอกสาร (+เวลา) · เลขที่เอกสาร · คลัง/ที่เก็บ · หน่วยนับ · จำนวน (+ จำนวนขนานในวงเล็บ) · ราคา/หน่วย · รวมมูลค่า ใช้ทศนิยม qty/price/amount จาก `getBcDecimals` (`:109-213`)
- **ไม่แสดงประเภทเอกสาร (`trans_flag`) และ `cust_code`** แม้ query ดึงมา และ **ไม่กรองเอกสารที่ยกเลิก** (ไม่มี `last_status` ใน WHERE) จึงปนทั้งรายการรับ/จ่าย/ย้ายคลังและเอกสารที่ถูกยกเลิก
- ท้ายป๊อปอัป: "แสดงรายการเคลื่อนไหวล่าสุด 50 รายการ"; ไม่มีปุ่มเลือก (ดูอย่างเดียว)

## สินค้าทดแทน (`ItemReplacementModal`)
- ดึงจาก `ic_inventory_replacement` (คอลัมน์ `ic_code`, `ic_replace_code`, `remark`) JOIN `ic_inventory` เพื่อเอาชื่อ หน่วยมาตรฐาน หน่วยขนาน และคงเหลือ เรียงตาม `line_number, roworder` (`:46-62`) ไม่พบจอใน `frontend/account` ที่เป็นผู้บันทึกตาราง `ic_inventory_replacement` (ป๊อปอัปนี้อ่านอย่างเดียว) จอข้อมูลสินค้าทั่วไปดู [[scr-item-master]]
- คอลัมน์: รหัสสินค้าทดแทน · ชื่อสินค้า · หน่วย · คงเหลือ · หมายเหตุ · (เลือกใช้ = ปุ่ม "แทนที่") (`:120-190`)
- กด "แทนที่" (ขณะแก้ไข) เรียก `onSelectReplacement(รหัส, ชื่อ, หน่วย)` แล้วปิด ใน `StockBeginningBalanceScreen` จอเรียกเฉพาะ `handleItemCodeLookup(rowIndex, รหัสใหม่)` — รหัสใหม่ผ่านการเลือกสินค้าปกติ (ชื่อ/หน่วยที่ป๊อปอัปส่งมาไม่ถูกใช้) (`:4028-4033`)

## ข้อควรระวัง
- ป๊อปอัปไม่ตรวจความถูกต้องทางธุรกิจ (จำนวนซีเรียลเท่ากับ qty, วันหมดอายุ ฯลฯ) — การตรวจจริงอยู่ที่ Go ตอนบันทึกเอกสาร
- ตารางสถานะซีเรียลมีข้อความ "ตัดจ่ายแล้ว" แต่ query ดึงเฉพาะ `status = 0` จึงเห็นแต่ "พร้อมใช้" (`SerialNumberModal.tsx:321` เทียบ `:67`)
- มีเพียงจอยกยอดสินค้าคงเหลือที่เปิดล็อต ประวัติ และสินค้าทดแทนได้ จอ transaction ทั่วไปไม่มีปุ่มเหล่านี้ (ค้นด้วย `<LotModal`/`<ItemHistoryModal`/`<ItemReplacementModal` ทั่ว `frontend/account`)

## ที่มาในโค้ด
- `frontend/account/transaction/SerialNumberModal.tsx:18-29` props; `:56-95` โหลด; `:105-122` เพิ่ม/บันทึก; `:193-217` แท็บ; `:299-345` ตารางคลัง; `:351-370` ท้าย
- `frontend/account/transaction/LotModal.tsx:11-26` ชนิด; `:62-70` โหลด; `:92-108` เลือก/บันทึก; `:157-221` ฟอร์ม
- `frontend/account/transaction/StockBalanceModal.tsx:56-130` โหลด; `:141-152` Esc; `:226-325` การ์ด/ตาราง
- `frontend/account/transaction/ItemHistoryModal.tsx:46-80` โหลด; `:109-213` ตาราง
- `frontend/account/transaction/ItemReplacementModal.tsx:46-95` โหลด/เลือก; `:120-190` ตาราง
- การใช้งาน: `UniversalTransScreen.tsx:3725-3745, 4160-4200`; `StockBeginningBalanceScreen.tsx:1182-1195, 3938-4034`; `BcLookupModal.tsx:1068-1086`
- ดูเพิ่ม: [[fe-transaction-screens]] · [[fe-grid-component]] · [[screens-overview]]
