---
title: "สินค้า/วัตถุดิบคงเหลือยกมา (StockBeginningBalanceScreen)"
tags: [screens, transaction]
aliases: ["StockBeginningBalanceScreen", "สินค้าคงเหลือยกมา", "ยอดยกมาสินค้า", "2033", "menu_ic_stk_balance", "trans_flag 54", "RMB"]
sources: ["frontend/account/transaction/StockBeginningBalanceScreen.tsx:114", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:362", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:376", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:764", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:903", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:1200", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:1312", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:1511", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:1711", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:1754", "frontend/account/tabs/screenRegistry.tsx:803", "frontend/account/tabs/transMenuMap.ts:924", "backend/internal/application/process/stock_beginning.go:154", "backend/internal/application/process/stock_beginning.go:307", "backend/internal/application/process/stock_beginning.go:615"]
---
# สินค้า/วัตถุดิบคงเหลือยกมา (เมนู 2033)

จอบันทึกยอดสินค้าคงเหลือตั้งต้น (`ic_trans` ที่ `trans_flag = 54`) เป็นจอเฉพาะที่ **ไม่ผ่าน `UniversalTransScreen`** เขียนแยกเป็นไฟล์เดียวใหญ่ (4,120 บรรทัด) มีตารางสินค้า แท็บเพิ่มเติม และแท็บ GL ในตัว กลไกเอกสารฝั่งธุรกิจดู [[doc-stock-beginning-balance]] ส่วนจอ transaction ทั่วไปดู [[scr-universal-trans]] และ [[fe-transaction-screens]]

## วิธีเปิด
เมนู IC (สินค้าคงคลัง) รหัส **2033** `menu_ic_stk_balance` "สินค้า/วัตถุดิบ คงเหลือยกมา" ลงทะเบียนเป็น `BASE_SCREENS` ตรง ๆ (`screenRegistry.tsx:803-808`) คีย์เดียวกันมีใน `TRANS_MENU_MAP` ด้วย (`transMenuMap.ts:924-935`, `transFlag: 54`, `screenCode: "IB"`) แต่ลูปลงทะเบียนเมนูธุรกรรมข้ามคีย์ที่มีใน `BASE_SCREENS` อยู่แล้ว (`screenRegistry.tsx:1025-1027`) จึงเปิดจอเฉพาะนี้ ไม่ผ่าน `UniversalTransScreen` กลไกเมนูดู [[fe-screen-registry-menu]] ภายในจอรหัสเมนูอ่านจาก `getMenuCodeByName("menu_ic_stk_balance", …)` (`:130`) ใช้แสดงที่หัวจอ (`:2081`) และจับคู่กับแท็บที่ active (`:133`) ส่วนสิทธิ์มาจาก `useScreenRights()` (`:223`)

## โครงจอ
- **ซ้าย: รายการเอกสาร** คอลัมน์ วันที่เอกสาร, เลขที่เอกสาร, เอกสารอ้างอิง, รวมมูลค่าสินค้า (`:442-469`) ค้นด้วยเลขที่เอกสาร / เอกสารอ้างอิง / หมายเหตุ (`buildBcSearchWhere`) เรียง `doc_date desc, doc_no desc` ดึงสูงสุด 200 แถว (`:764-780`)
- **ขวาบน: หัวเอกสาร** ช่อง เอกสารเลขที่ \*, รหัสเอกสาร (รูปแบบเอกสารจาก `erp_doc_format`), เอกสารอ้างอิงวันที่, เอกสารอ้างอิง, คลัง, พื้นที่เก็บ, หมายเหตุ และช่องอ่านอย่างเดียว **มูลค่าสุทธิ** (ผลรวมช่อง "รวมมูลค่า" ของทุกแถว `:362-364`)
- **ขวากลาง: 3 แท็บ** "รายละเอียด" (ตารางสินค้า), "เพิ่มเติม", "GL" (`:2286-2316`)
- แถบเครื่องมือ (`:1986-2078`): ขณะแก้ไข (`isEditing`) มี **บันทึก** (`:2013-2019`, ปิดใช้เมื่อกำลังบันทึกหรือไม่มีสิทธิ์ `canSaveWithRights`) กับ **ปิดหน้าจอ / ยกเลิกการแก้ไข (Esc)** (`cancelEdit`, `:2024-2028`) ขณะไม่แก้ไขมี **แก้ไข** (`:2036-2041`, ต้องเลือกเอกสารและมี `canEdit`) · **เพิ่มใหม่** (`:2046-2051`, `canAdd`) · **ลบ** (`:2056-2061`, ต้องเลือกเอกสารที่ไม่ใช่ใหม่และมี `canDelete`) และปุ่ม "ปิดหน้าจอ" (title "ปิดหน้าต่าง") ที่แสดงเฉพาะเมื่อมี `onClose` (`:2063-2071`) ปิดแท็บเมื่อเปิดผ่าน tab workspace ([[fe-tabs-workspace]]) สิทธิ์มาจาก `useScreenRights` ([[proc-permission-rights]])

## เริ่มเอกสารใหม่ (ปุ่ม "เพิ่มใหม่") — ค่าตั้งต้น
(`startNew` `:903-1034`)
- วันที่/เวลา = วันนี้/เวลาปัจจุบัน (HH:MM), สาขา = `00000` "สำนักงานใหญ่"
- **รหัสเอกสาร**: ดึง `erp_doc_format` ที่ `screen_code = 'IB'` ตัวที่ `code` มากสุด; ถ้าไม่มี fallback เป็น `RMB` "สินค้า/วัตถุดิบ คงเหลือยกมา (สำนักงานใหญ่)"
- **คลัง / พื้นที่เก็บ**: เอาคลังแรก (`order by code limit 1` จาก `ic_warehouse`) และที่เก็บแรกของคลังนั้น (`ic_shelf`)
- **เลขที่เอกสาร**: `generateBcDocNo` (format + `ic_trans` + flag 54 + screen `IB`) — กลไกเลขดู [[proc-doc-flow-numbering]]
- สมุดรายวัน GL = `01` "สมุดรายวันทั่วไป" (หรือ `gl_book` ของ format), ประเภทรายวัน "รายวัน", คำอธิบาย "สินค้ายกมา"
- แถวสินค้าว่าง 1 แถว (qty = 1, price = 0)

## ตารางสินค้า (แท็บรายละเอียด)
คอลัมน์ รหัสสินค้า \* · ชื่อสินค้า · บาร์โค้ด (สลับแสดง/ซ่อนได้ด้วยปุ่มขวาของแถบแท็บ) · คลัง · พื้นที่เก็บ · หน่วยนับ (+ หน่วยนับขนานเมื่อสินค้ามี `unit_type` 2 หรือ 3) · จำนวน · **ต้นทุน** (ช่อง `price`) · รวมมูลค่า · จัดการ (ลบแถว) (`:2341-2776`) จอนี้วาดตาราง HTML (`<table>`) ของตัวเอง ไม่ใช้ `TransItemGrid` ของจอ transaction ทั่วไป ([[scr-trans-item-grid]], [[fe-grid-component]]) ใต้ตารางมีแถบสรุปสินค้าหลายหน่วยนับ (`MultiUnitPackSummaryBar`, `:3030-3058`) ดู [[scr-multi-unit-pack-summary]]

เมื่อเลือกสินค้า (`handleItemSelect` `:1312-1373`):
- หน่วยนับ = `unit_standard` ของสินค้า, ดึง `stand_value/divide_value/ratio` จาก `ic_unit_use`
- **ต้นทุน** = `cost`/`average_cost` ของสินค้า แต่ถ้าผู้ใช้พิมพ์ต้นทุนในแถวไว้แล้วก่อนเลือกสินค้า ค่าที่พิมพ์ชนะ (`priceAfterLookup` `:114-116`)
- คลัง/พื้นที่เก็บ ใช้ของหัวเอกสารถ้าแถวยังว่าง
- รวมมูลค่า = `qty x price` ปัดทศนิยม 2 ตำแหน่งด้วย `mulDec` (`:1200-1245`, ที่ `:1210`)

## ปุ่ม / คีย์ลัด
คีย์ลัดผูกกับ `window.keydown` ทำงานเฉพาะเมื่อแท็บของจอนี้ active (`tabActive` `:133`, ด่านตรวจ `:1756`)
| คีย์ | ทำอะไร |
|---|---|
| Esc | ปิด modal/เมนูคลิกขวา/dialog ที่เปิดอยู่ก่อน → ถ้ากำลังแก้ไขให้ยกเลิกการแก้ไข → ไม่งั้นปิดแท็บ |
| Ctrl+S | บันทึก (เฉพาะขณะแก้ไข) |
| Ctrl/Alt+1 | ประวัติการเคลื่อนไหวของสินค้าแถวปัจจุบัน |
| Ctrl/Alt+2 | ยอดคงเหลือ |
| Ctrl/Alt+3 หรือ 4 | สูตรราคา / ราคาขาย (เปิด modal ตัวเดียวกัน) |
| Ctrl/Alt+6 | สินค้าทดแทน |
| Ctrl/Alt+8 | ล็อต (Lot) |
| Ctrl/Alt+E | หมายเหตุรายการสินค้า |
| Insert | แทรกแถวว่างเหนือแถวปัจจุบัน (ขณะแก้ไข) |
| Ctrl+F | กำหนดเป็นของแถม = ตั้งต้นทุนแถวเป็น 0 (ขณะแก้ไข) |
คีย์ 1/2/3/4/6/8/E ทำงานเฉพาะในแท็บ "รายละเอียด" และต้องมีรหัสสินค้าในแถว (ยกเว้น Ctrl+E ที่ต้องมีแถวเท่านั้น) **ไม่มี F12 และไม่มีปุ่มลัดอื่น** แม้คอมเมนต์ในโค้ดจะเอ่ยถึง F12 (`:131`) คลิกขวาที่แถวสินค้าเปิดเมนูรวมคำสั่งเดียวกัน (`ItemGridContextMenu` — ใช้เฉพาะจอนี้, `:3856`; นิยามใน `ItemGridContextMenu.tsx:72`)

## Modal ที่เรียกได้
ทั้งหมดเป็น modal ของ transaction ที่ใช้ร่วมกัน (รายละเอียดดู [[scr-modal-serial-lot-stock]], [[scr-modal-price-credit]], [[scr-modal-document-item]]):
- ยอดคงเหลือ (`StockBalanceModal`), ประวัติการเคลื่อนไหว (`ItemHistoryModal`), สินค้าทดแทน (`ItemReplacementModal`)
- สูตรราคา/ราคาขาย (`PriceFormulaModal`, `:4011`; Ctrl+3 และ Ctrl+4 และเมนูคลิกขวาทั้ง 2 รายการเปิด modal ตัวเดียวกัน)
- Serial Number (`SerialNumberModal`) และ Lot (`LotModal`) — ข้อมูลเก็บในแถว (`serials`, `lot`) แล้วส่งไปกับการบันทึก
- ชื่อสินค้า (`ItemNameModal`), หมายเหตุรายการ (`ItemRemarkModal`)
- ตัวค้นหา lookup ทั่วไป (สินค้า, รูปแบบเอกสาร, คลัง, ที่เก็บ, สมุดรายวัน, รหัสบัญชี) ตามกลไก [[scr-data-list-and-lookup]]

## แท็บ "เพิ่มเติม"
รหัสสาขา · กลุ่มเอกสาร · ด้าน/ฝ่าย · รหัสแผนก · รหัสการจัดสรร · รหัสโครงการ · รหัสงาน · หมายเหตุ 2-5 (`:3063-3315`) payload ส่งทุกช่องไปกับการบันทึก (`branchCode/docGroup/sideCode/departmentCode/allocateCode/projectCode/jobCode/remark2-5`, `:1582-1592`) จอนี้ **ไม่ได้ซ่อนช่องตาม edition** (ไม่พบการอ่าน edition ในไฟล์)

## แท็บ "GL" (ใบสำคัญ)
- ส่วนบน: เอกสารวันที่ (อ่านอย่างเดียว), ช่องติ๊ก **บันทึกรายการบัญชีตรง** (`glTransDirect`, แก้ได้ขณะแก้ไข), เอกสารเลขที่, รหัสเอกสาร, เอกสารอ้างอิงวันที่/อ้างอิง, งวดบัญชี, ปีบัญชี, สมุดรายวัน (ค้นหา), ประเภทรายวัน (รายวัน / ยกมางวด / ปิดงวด / ปรับปรุง / ยอดยกมา), คำอธิบาย (`:3316-3475`)
- ส่วนล่าง: ตาราง รหัสบัญชี · ชื่อบัญชี · คำอธิบาย · เดบิต · เครดิต · มิติ; มีแถว total และแถบ "ผลต่าง เดบิต - เครดิต" (`:3476-3736`) ปุ่ม "เพิ่มแถวบัญชี" และปุ่มจัดการแถวมีเฉพาะเมื่อติ๊ก "บันทึกรายการบัญชีตรง"
- **ไม่ติ๊ก (ค่าเริ่มต้น)**: จอสร้างแถว GL ให้เองสองบรรทัด ตามยอดรวมสุทธิที่เปลี่ยนไป **เดบิต 1131-00 "สินค้าคงเหลือสำเร็จรูป" / เครดิต 3110-00 "ทุนเรือนหุ้นสามัญ"** (`:376-399`) และตารางอ่านอย่างเดียว
- **ติ๊ก**: ผู้ใช้คีย์ Dr/Cr เองได้ ต้องเดบิตเท่าเครดิตทั้งก้อน

## การบันทึก
ปุ่ม **บันทึก** (Ctrl+S) ตรวจที่หน้าจอ แล้วส่ง `POST /api/process/stocktools/stockbeginningsave` (`save` `:1511-1709`, เรียก API ที่ `:1636`)
- ฝั่งหน้าจอ: ต้องมีเลขที่เอกสาร, วันที่เอกสาร, สินค้าอย่างน้อย 1 รายการ (แถวที่ไม่มีรหัสสินค้าจะถูกตัดทิ้ง); สินค้าที่มีหน่วยนับขนาน (`unit_type` 2/3) ต้องมีรหัสหน่วยขนาน และถ้าจำนวนไม่เป็น 0 ต้องมีจำนวนหน่วยขนานด้วย
- ตัวเลขใน payload เป็นสตริงทศนิยม (qty 4 ตำแหน่ง, price 4, อัตราส่วน 6, เดบิต/เครดิต 2) ผ่าน `decimalSql` — แต่ **state ในจอเป็น JS number** ไม่ใช่ decimal string เต็มรูป ดู [[fe-numeric-money]]
- ฝั่ง Go (`StockBeginningSave` `:307-355`, ตรวจใน `newStockBeginningPlan` `:154-296`): บังคับเลขที่ซ้ำ (`rejectDuplicate` ที่ `ic_trans.doc_no + trans_flag 54`), รูปแบบวันที่ YYYY-MM-DD / เวลา HH:MM, ซีเรียลซ้ำในเอกสาร, รหัสสินค้ามีอยู่จริง, หน่วยขนาน, และ **เดบิต = เครดิต** ของแถว GL ที่ส่งมา (ถ้ามีแถว) จากนั้นเขียน `ic_trans`, `ic_trans_detail`, ซีเรียล, ล็อต, `gl_journal`/`gl_journal_detail` และ rebuild สต็อก/ต้นทุน/ซีเรียล **ใน transaction เดียว** (ล็อกเอกสารและสินค้าก่อน `lockTransDoc/lockStockItems`) — rebuild พลาด = ยกเลิกทั้งเอกสาร ผลของการ rebuild ดู [[proc-stock-tools]]
- ถ้ารหัสบัญชีที่ส่งมาไม่มีใน `gl_chart_of_account` ฝั่ง Go หาบัญชีใกล้เคียงแทน (ฝั่งเดบิตลอง 1131/1130/1140, ฝั่งเครดิต 3110/3100/3210) (`:631-639`) ผังบัญชีดู [[scr-chart-of-accounts]]

## การลบ
ปุ่ม **ลบ** ถามยืนยัน "คุณต้องการลบเอกสารเลขที่ ... หรือไม่?" แล้วเรียก `POST /api/process/stocktools/stockbeginningdelete` (`remove` `:1711-1752`, เรียก API ที่ `:1722`) ฝั่ง Go ลบ GL, ซีเรียล, ล็อต, รายการ และหัวเอกสารแล้ว rebuild (`sbDeleteRaw` `:484-492`) เอกสารนี้ **ลบจริง** ไม่ใช่ออกใบยกเลิกแบบจอ [[scr-cancel-confirm]]

## ข้อควรระวัง
- **ขัดกับ [[doc-stock-beginning-balance]]**: โน้ตนั้นเขียนว่า "ไม่มี GL อัตโนมัติ" แต่จอนี้ใส่แถว Dr 1131-00 / Cr 3110-00 ให้เองเมื่อไม่ติ๊ก "บันทึกรายการบัญชีตรง" และส่งแถวไปกับ `glLines` เสมอ ฝั่ง Go ไม่ดู `glDirect` ตอนตัดสินว่าจะเขียนใบสำคัญ — ขอแค่มีแถวที่รหัสบัญชีไม่ว่าง (`stock_beginning.go:615-645`) ผลคือการบันทึกตามค่าตั้งต้นจะได้ใบสำคัญ `gl_journal` เสมอ รหัส 1131-00/3110-00 ฝังในโค้ดหน้าจอ ไม่ได้อ่านจากผังบัญชีของบริษัท (ถ้าไม่มีในผัง Go เปลี่ยนเป็นบัญชีใกล้เคียงเงียบ ๆ)
- ตัวเลข `qty`/`price`/`sum_amount` ในจอเป็น `number` (ปัดด้วย `mulDec`/`sumDec` แต่ยังเก็บเป็น JS float ระหว่างพิมพ์) ผิดแนวทาง [[fe-numeric-money]] แม้จะส่ง API เป็นสตริง
- คอมเมนต์ในโค้ดพูดถึง F12 บันทึก (`:131,1510,1752`) แต่ที่ผูกจริงมีแค่ Ctrl+S / Esc / Ctrl-Alt+เลข / Insert / Ctrl+F
- ปุ่ม "ปิดหน้าจอ / ยกเลิกการแก้ไข (Esc)" ขณะแก้ไขเอกสารที่มีอยู่จะ **ยกเลิกการแก้ไขและโหลดเอกสารเดิมกลับ** ไม่ปิดแท็บ ปิดแท็บได้เมื่อไม่ได้แก้ไข
- ไม่มีเมนู "ยกเลิก" ของ flag 54 ใน `UniversalCancelConfirmScreen` — แก้ไขหรือลบแล้วบันทึกใหม่เท่านั้น
- แก้ไขเอกสารเดิมแล้วบันทึก = ฝั่ง Go ลบแถวดิบของเอกสารทั้งชุดแล้วเขียนใหม่ทั้งหมด (`sbDeleteRaw` ก่อน insert, `stock_beginning.go:325-345`) ไม่ใช่ update ทีละแถว

## ที่มาในโค้ด
- `frontend/account/transaction/StockBeginningBalanceScreen.tsx:111-116` `TRANS_FLAG = 54`/priceAfterLookup; `:129-134` รหัสเมนู/คีย์ลัดบน window; `:362-399` ยอดรวมและแถว GL อัตโนมัติ; `:442-469` คอลัมน์รายการ; `:762-804` โหลดรายการ; `:835-902` เลขที่เอกสาร/รูปแบบเอกสาร; `:903-1061` เริ่มใหม่/แก้ไข/ยกเลิก; `:1156-1245` ของแถม/แก้ไขแถว; `:1312-1373` เลือกสินค้า; `:1511-1709` บันทึก; `:1711-1752` ลบ; `:1754-1933` คีย์ลัด; `:1986-2078` แถบเครื่องมือ; `:2286-2316` แท็บ; `:2341-2776` ตารางสินค้า; `:3063-3315` แท็บเพิ่มเติม; `:3316-3737` แท็บ GL; `:3856` เมนูคลิกขวา; `:3993-4110` modal
- `frontend/account/tabs/screenRegistry.tsx:803-808` ลงทะเบียน; `:1025-1027` ลูปเมนูธุรกรรมข้ามคีย์ที่มีแล้ว; `frontend/account/tabs/transMenuMap.ts:924-935` รายการ `menu_ic_stk_balance`
- `backend/internal/application/process/stock_beginning.go:154-296` ตรวจ/วางแผน; `:307-355` save; `:356-390` delete; `:484-492` ลบดิบ; `:615-645` เขียนใบสำคัญ
- ดูเพิ่ม: [[scr-universal-trans]] · [[scr-trans-header-and-tabs]] · [[fe-transaction-menu-purchase-sale-stock]] · [[term-gl-journal]] · [[screens-overview]]
