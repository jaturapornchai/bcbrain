---
title: "ป๊อปอัปเอกสารและรายการสินค้า (ChequePickerModal / DocumentFlowModal / ItemNameModal / ItemRemarkModal / ItemGridContextMenu)"
tags: [screens, transaction]
aliases: ["ChequePickerModal", "ค้นหาเช็ค", "DocumentFlowModal", "ผังเส้นทางเอกสาร", "Document Flow", "ItemNameModal", "แก้ไขชื่อสินค้าเฉพาะรายการ", "ItemRemarkModal", "หมายเหตุรายการ", "ItemGridContextMenu", "เมนูคลิกขวาแถวสินค้า"]
sources: ["frontend/account/transaction/ChequePickerModal.tsx:75", "frontend/account/transaction/DocumentFlowModal.tsx:104", "frontend/account/transaction/ItemNameModal.tsx:7", "frontend/account/transaction/ItemRemarkModal.tsx:7", "frontend/account/transaction/ItemGridContextMenu.tsx:42", "frontend/account/transaction/TransItemGrid.tsx:1146", "frontend/account/transaction/UniversalTransScreen.tsx:3096", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:3801", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/doc_flow_graph.go:269"]
---
# ป๊อปอัปเอกสารและรายการสินค้า

ห้าป๊อปอัปที่เกาะกับจอ transaction: สองตัวแรกใช้ร่วมหลายจอ (ค้นหาเช็ค, ผังเส้นทางเอกสาร) อีกสามตัว (ชื่อเฉพาะรายการ, หมายเหตุรายการ, เมนูคลิกขวา) **ใช้เฉพาะจอยกยอดสินค้าคงเหลือ** [[scr-stock-beginning-balance]] เท่านั้น ไม่ได้ถูกเรียกจาก `TransItemGrid` ของ [[scr-universal-trans]] ป๊อปอัปราคา/ต้นทุน/เครดิตดู [[scr-modal-price-credit]]; ซีเรียล/ล็อต/ยอดคงเหลือ/ประวัติดู [[scr-modal-serial-lot-stock]]

| ป๊อปอัป | ใช้ในจอ | เปิดอย่างไร |
|---|---|---|
| `ChequePickerModal` | `TransItemGrid` (ทุกจอเช็คที่มี `pick`) | ปุ่มแว่นขยาย "ค้นหาเช็ค" ข้างช่องเลขที่เช็ค หรือปุ่มค้นหารหัสในช่องรายการ |
| `DocumentFlowModal` | `UniversalTransScreen`, `UniversalCancelConfirmScreen`, `AutoCareWorkspace` | ปุ่ม "Document Flow" |
| `ItemNameModal` | `StockBeginningBalanceScreen` | เมนูคลิกขวา "แก้ไขชื่อเฉพาะรายการ" |
| `ItemRemarkModal` | `StockBeginningBalanceScreen` | Ctrl+E / Alt+E หรือเมนูคลิกขวา |
| `ItemGridContextMenu` | `StockBeginningBalanceScreen` | คลิกขวาที่แถวสินค้า |

## ค้นหาเช็ค (`ChequePickerModal`)
- **ใช้กับ**: จอเช็ค/โอนเงินที่ `getChequeGridSpec(transFlag)` ตอบค่า (flag 405, 406, 410-413, 416, 418, 422, 451-453, 456, 461-463 — `ChequePickerModal.tsx:32-58`) เฉพาะ flag ที่ spec ระบุ `pick` เท่านั้นที่เปิดตัวค้นหาได้: `pick = "chq_number"` (ช่องเลขที่เช็คอ่านอย่างเดียว ต้องกดปุ่มแว่นขยาย `TransItemGrid.tsx:664-677`) และ `pick = "item_code"` (ช่องรหัส = เลขที่เช็ค กดค้นหารหัสแล้วเปิดตัวนี้แทนตัวค้นรหัสสินค้า `TransItemGrid.tsx:224`) flag 405/406/422 ไม่มี `pick` (กรอกเอง)
- **หน้าตา**: หัว "ค้นหาเช็ค", ช่องค้น "เลขที่เช็ค / เอกสารอ้างอิง..." (หน่วงพิมพ์ 250 มิลลิวินาทีแล้วยิงใหม่ `:117`), ตาราง เลขที่เช็ค · วันที่รับ · เอกสารอ้างอิง · วันครบกำหนด · ลูกหนี้/เจ้าหนี้ (`รหัส~ชื่อ`) · จำนวนเงิน ว่างเปล่าแสดง "ไม่พบเช็คที่เลือกได้ในสถานะนี้" หรือข้อความผิดพลาดจาก backend คลิกแถว = เลือก (ไม่มีปุ่มยืนยัน ไม่มีคีย์ลัด)
- **API**: `POST /api/process/cheque/candidates {transFlag, custCode, passBookCode, search}` (`cheque_handler.go:29`, สิทธิ์ read ที่ `permission.go:24`) ส่งสมุดบัญชี (`passBookCode`) ไปเฉพาะ `pick = "chq_number"` (ค่าคือรหัสสมุดในแถว) ส่วน `custCode` คือคู่ค้าหัวเอกสาร
- **กฎกรองสถานะฝั่ง Go** (`chequeCandidateWhere` `cheque.go:220-262`, ตาราง [[tbl-cb-chq-list]]): 410/413 ฝาก/ยกเลิก = สถานะ 0 หรือ 3; 411 ผ่าน = สถานะ 1 (และถ้ามีสมุด ต้องเป็นสมุดของแถวฝากล่าสุด); 412 คืน = สถานะ 1 หรือ 2; 416/418 = เช็ครับสถานะ 0/3 ของคู่ค้านั้น; 456 = เช็คจ่ายของเจ้าหนี้นั้น; 451/452 = สถานะ 0/3, 453 = สถานะ 2 (มีสมุดก็กรองตามสมุด); 461/462 บัตรเครดิตและ 463 wallet = สถานะ 0 (`chq_type` 3 และ 21) flag อื่นตอบข้อผิดพลาด "trans flag N has no cheque picker" ผลสูงสุด 1,000 แถว เรียงตามวันครบกำหนดแล้วเลขเช็ค (`:298`) ค้นด้วย ILIKE ทั้งเลขที่เช็คและเอกสารอ้างอิง (ตัดที่ 100 ตัวอักษร)
- **เมื่อเลือก**: `TransItemGrid` เขียนแถว: ช่องเลขเช็ค (ตาม `pick`), `doc_ref` / `ref_row` ชี้แถวทะเบียนเช็ค, `date_due`, จำนวน = 1 และราคา = ยอดเช็ค (`TransItemGrid.tsx:1155-1166`) เช็คที่อยู่ในตารางแล้วในแถวอื่น (คู่ `doc_ref|ref_row`) จะถูกซ่อนจากรายการ (`:1151-1153`, `ChequePickerModal.tsx:123`)
- ชีวิตของเช็ค/สถานะ: [[doc-cheque-received-lifecycle]], [[doc-cheque-paid-lifecycle]], [[flow-cash-bank-cheque]]; ยอดเงินเป็นสตริงทศนิยม [[fe-numeric-money]]

## ผังเส้นทางเอกสาร (`DocumentFlowModal`)
- **Props**: `open, docNo, transFlag, kind, title?, onClose, onSelectSameScreenDoc?` (`DocumentFlowModal.tsx:104-112`) ผู้เรียก: `UniversalTransScreen` ปุ่ม "Document Flow" ปิดไว้จนกว่าจะมีเลขที่เอกสาร (`:3093-3100`, และอีกปุ่มเฉพาะเอกสารที่ไม่ใช่ใหม่ `:3138-3147`, ตัวป๊อปอัป `:4237`); `UniversalCancelConfirmScreen` (`:858-866`, `:1026`); `AutoCareWorkspace` ผ่าน callback `onOpenDocFlow(docNo, transFlag)` ที่ส่งให้แผงลูก (`AutoCareWorkspace.tsx:937-939, 1014-1020`, kind ตายตัว `ic_trans`)
- **ข้อมูล**: `POST /api/process/doc/flow {docNo, transFlag, kind}` (`DocumentFlowModal.tsx:161`, handler `bills_handler.go:25`, สิทธิ์ read) ฝั่ง Go สร้างกราฟหลายต่อหลายแบบสองทิศ ไล่ต้นทาง/ปลายทางสูงสุด **6 ขั้น และไม่เกิน 80 เอกสาร** (`doc_flow_graph.go:281-283`) จากความสัมพันธ์ `ic_trans.doc_ref`, `ic_trans_detail.ref_doc_no/doc_ref`, `ap_ar_trans(.detail)`, `cb_trans_detail` ฯลฯ แล้วเติมยอดชำระ (`loadFlowPayments` `:1244`) และสมุดรายวัน GL (`loadFlowGLJournals` `:1387`) ตารางต้นทาง: [[tbl-ic-trans]], [[tbl-ic-trans-detail]], [[tbl-ap-ar-trans]], [[tbl-cb-trans-detail]], [[tbl-gl-journal]]
- **ห้าส่วนในหน้าต่าง** (เรียงจากบนลงล่าง):
  1. "แผนผังการไหลของเอกสาร" คอลัมน์ซ้าย→ขวา ขั้นที่ N: ที่มา (ต้นทาง) / เอกสารปัจจุบัน / ที่ไป (ปลายทาง) (`:526-542`) แต่ละกล่องมีประเภทเอกสาร ป้ายสถานะ เลขที่+วันที่ คู่ค้า ยอดรวม/ชำระแล้ว/คงค้าง; โหนดชำระเงินแสดงช่องทางรับ/จ่าย; โหนด GL แสดงตัวอย่าง 4 บัญชี + "+N บัญชี" โหนด GL ของเอกสารอื่นถูกซ่อน เว้นแต่ `kind` ที่เปิดเป็น `gl_journal` (`:202`) คลิกกล่อง = ไฮไลต์เส้นที่มา (ฟ้า) และที่ไป
  2. "ตรวจสอบที่มาและที่ไปของเอกสารที่เลือก" รายการขาเข้า/ขาออกของกล่องที่เลือก (ข้อความว่าง "เอกสารนี้เป็นเอกสารตั้งต้น…" / "ยังไม่มีเอกสารปลายทาง…" `:761, :834`)
  3. "ตารางสรุปความเชื่อมโยงทั้งสายงาน" คอลัมน์ ลำดับ · เอกสารต้นทาง · การอ้างอิง/ความสัมพันธ์ · เอกสารปลายทาง · รายละเอียดรายการ/ช่องทาง · จำนวนเงิน
  4. "รายละเอียดการรับ/จ่ายชำระเงินในสายเอกสารนี้" ช่องทาง · เลขที่อ้างอิง/สมุดบัญชี/เช็ค · จำนวนเงิน
  5. "รายการลงบัญชีแยกประเภท (GL Journal) ที่เชื่อมโยง" ชื่อบัญชี · เดบิต · เครดิต
- **ปุ่ม**: ในแต่ละกล่อง "🔍 ดู Flow" (วาดกราฟใหม่โดยตั้งเอกสารนั้นเป็นศูนย์กลาง `:688-704`) และ "เปิดเอกสาร" (เมื่อโหนดมี `menuKey`); หัวป๊อปอัป "รีเฟรชผัง", "กลับไปเอกสารตั้งต้น (เลขที่)" (เมื่อกำลังดูเอกสารอื่น), "ปิดหน้าต่าง" ไม่มีคีย์ลัด ไม่ได้ผูก Esc ในไฟล์นี้
- **"เปิดเอกสาร" ทำงานอย่างไร** (`handleOpenNodeScreen` `:272-300`): ถ้าโหนดเป็นประเภทเดียวกับจอปัจจุบัน (flag + kind ตรงกัน) เรียก `onSelectSameScreenDoc` แล้วปิด; ถ้าไม่ใช่ เก็บ `{menuKey, docNo}` ลง `sessionStorage` คีย์ `bc:pending-open-doc` แล้วสั่ง `tabsApi.openScreen(menuKey)` เปิดแท็บของจอนั้น ([[fe-tabs-workspace]]) และยิงอีเวนต์ `bc:open-doc` ให้จอที่ฟังอยู่เปิดเอกสาร ผู้รับที่พบในโค้ดมีเฉพาะ `UniversalTransScreen` (`:1819-1851`) ซึ่งตรวจว่า `menuKey` ตรงกันจึงโหลดเอกสาร จอประเภทอื่น (เช่นจอที่สร้างจาก `createMasterScreen`) ไม่มีตัวรับ จะเปิดแท็บแต่ไม่โหลดเอกสาร
- **ป้ายสถานะ** ที่ Go ตั้ง (`deriveNodeStatus` `doc_flow_graph.go:809-861`): ยกเลิกแล้ว / เอกสารยกเลิก; เอกสารอนุมัติ (flag 4, 8, 32, 38, 52); ใบเสนอ/สั่ง (2, 6, 30, 34, 36) → รอดำเนินการ / อนุมัติแล้ว (รอนำไปอ้างอิง) / นำไปใช้บางส่วนแล้ว / นำไปใช้ครบแล้ว (ปิดรายการ); ใบซื้อ/ขายเชื่อ (12, 44, 315) → ตั้งหนี้ (รอชำระ) / วางบิล/อ้างอิงแล้ว (รอชำระ) / ชำระบางส่วนแล้ว / ชำระครบแล้ว; รายการ 12/44/315 แบบชำระทันที (inquiry_type 1 หรือ 3) → "ชำระเงินสด/ธนาคารแล้ว" ความสัมพันธ์เชิงตัวอย่างดู [[flow-order-to-cash]], [[flow-procure-to-pay]]

## แก้ไขชื่อสินค้าเฉพาะรายการ (`ItemNameModal`)
- **Props**: `isOpen, onClose, itemCode, currentName, isEditing, onSaveName` (`ItemNameModal.tsx:7-14`) หัวป๊อปอัปแสดงรหัสสินค้า + ป้าย "แก้ไขชื่อสินค้าเฉพาะรายการ" ช่องเดียว "ชื่อสินค้าในเอกสารนี้" (ปิดไว้เมื่อไม่ได้แก้ไขเอกสาร, โฟกัสอัตโนมัติ, ไม่มี `maxLength`) ปุ่ม "ตกลง (Enter)" และ "ยกเลิก" Enter ในช่อง = ตกลง (`:85-90`) ตัดช่องว่างหัวท้ายก่อนส่งกลับ
- ข้อความเตือนในหน้าต่าง: การแก้ชื่อมีผลเฉพาะเอกสารใบนี้ ไม่กระทบทะเบียนสินค้า (`:97`) ในจอยกยอดสินค้าผลลัพธ์ถูกเขียนลงช่อง `item_name` ของแถว (`StockBeginningBalanceScreen.tsx:4036-4047`) ไม่มีการเรียก API ของตัวเอง
- เรียกจากเมนูคลิกขวา "แก้ไขชื่อเฉพาะรายการ" (ปุ่มปิดไว้เมื่อโหมดอ่านหรือแถวยังไม่มีสินค้า) คอมเมนต์ในเมนูระบุ F3 แต่ไม่พบการผูกคีย์ F3 ในจอยกยอดสินค้า

## หมายเหตุรายการ (`ItemRemarkModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, initialRemark, isEditing, onSaveRemark` (`ItemRemarkModal.tsx:7-15`) หัว "หมายเหตุรายการ (Ctrl+E)" + ชื่อสินค้า; ช่อง textarea 4 บรรทัด "ข้อความหมายเหตุ (Remark):" มีตัวนับ "n/255 ตัวอักษร" แต่ **textarea ไม่มี `maxLength`** (ไม่พบในไฟล์) จึงพิมพ์เกิน 255 ได้ ตัวนับเป็นแค่ตัวเลข
- ปุ่ม "บันทึกหมายเหตุ" / Ctrl+Enter (หรือ Cmd+Enter) = บันทึกด่วน (`:84-89`), "ยกเลิก" / "ปิด" (โหมดอ่าน) ตัดช่องว่างหัวท้ายก่อนบันทึก
- ในจอยกยอดสินค้า เปิดด้วย Ctrl+E หรือ Alt+E เฉพาะเมื่ออยู่ในแท็บตารางรายการ และมีแถวที่เลือก (`StockBeginningBalanceScreen.tsx:1869-1884`) แล้วเขียนลงช่อง `remark` ของแถว (`:4050-4062`) Esc ปิดป๊อปอัป (ผ่านตัวจัดการ Esc ของจอ `:1753-1764` ไม่ใช่ในไฟล์ป๊อปอัป)

## เมนูคลิกขวาแถวสินค้า (`ItemGridContextMenu`)
- เมนูลอยตามพิกัดเมาส์ ปรับตำแหน่งไม่ให้ล้นจอ ปิดเมื่อคลิกนอกหรือกด Esc (`ItemGridContextMenu.tsx:103-146`) หัวเมนูบอก "แถวที่ N" และรหัสสินค้า (หรือ "(ยังไม่ระบุสินค้า)"); ปุ่มที่ต้องมีสินค้า (`hasItem` `:151`) จะถูกปิดเมื่อแถวว่าง
- **สี่กลุ่ม**:
  1. ตรวจสอบสต็อกและราคา: "ตรวจสอบยอดคงเหลือ" (Ctrl+2), "ประวัติการเคลื่อนไหว" (Ctrl+1), "ตารางสูตรราคาขาย (Matrix)" (Ctrl+3), "ราคาขายตามกลุ่ม/ระดับ" (Ctrl+4), "สินค้าทดแทน" (Ctrl+6)
  2. ล็อต ซีเรียล และข้อมูลจำเพาะ: "จัดการ Serial Number", "ข้อมูลล็อตสินค้า (Lot / EXP)" (Ctrl+8), "หมายเหตุรายการ" (Ctrl+E)
  3. ค้นหาและระบุรหัส (Lookups, ปิดเมื่อไม่ได้แก้ไข): ค้นหารหัสบาร์โค้ด, ค้นหารหัสสินค้า, เลือกคลังและที่เก็บ, เลือกหน่วยนับสินค้า (ต้องมีสินค้าในแถวด้วย), แก้ไขชื่อเฉพาะรายการ (ต้องมีสินค้าในแถวด้วย)
  4. จัดการแถวสินค้า (ปิดเมื่อไม่ได้แก้ไข): กำหนดเป็นของแถม (ราคา 0) (Ctrl+F), คัดลอกคลัง/ที่เก็บไปทุกแถว (ปิดเมื่อแถวยังไม่มีคลัง), แทรกแถวด้านบน (Insert), แทรกแถวด้านล่าง, ลบแถวนี้
- ในจอยกยอดสินค้า แต่ละรายการเชื่อมกับ: ยอดคงเหลือ/ประวัติ/สินค้าทดแทน/ซีเรียล/ล็อต → ป๊อปอัปใน [[scr-modal-serial-lot-stock]]; ตารางสูตรราคา และ "ราคาขายตามกลุ่ม/ระดับ" → **ป๊อปอัปเดียวกัน** คือ `PriceFormulaModal` (ดู [[scr-modal-price-credit]]; ไม่ได้เปิด `PriceInfoModal`) ส่วนที่เหลือเรียกฟังก์ชันของจอเอง (`StockBeginningBalanceScreen.tsx:3801-3880`, แทรก/ลบ/ของแถม/คัดลอกคลังที่ `:1084-1160`)
- **คีย์ลัดที่ผูกจริงในจอยกยอดสินค้า** (ตัวจัดการ keydown `:1729-1900`): Ctrl/Alt+1, 2, 3 หรือ 4, 6, 8, E, Ctrl+F, Insert (ใช้ได้เฉพาะเมื่ออยู่ในแท็บตารางรายการ) F1-F7 ที่เขียนในคอมเมนต์ของเมนูไม่มีการผูกคีย์ในจอยกยอดสินค้า (ไม่พบ `F1`-`F7` ใน `StockBeginningBalanceScreen.tsx`) ใช้เมาส์หรือเมนูคลิกขวาแทน

## ข้อควรระวัง
- เมนูคลิกขวา, ชื่อเฉพาะรายการ, หมายเหตุรายการ ไม่ได้อยู่ในตารางสินค้ากลาง `TransItemGrid` ของจอ transaction ทั่วไป ผู้ใช้จอ transaction ทั่วไปแก้ชื่อ/หมายเหตุในช่องของตารางโดยตรง (ดู [[scr-trans-item-grid]])
- ตัวนับ "/255" ของหมายเหตุไม่ถูกบังคับที่หน้าจอ ความยาวจริงขึ้นกับคอลัมน์ในฐานข้อมูล (ยังไม่ได้ตรวจ)
- "เปิดเอกสาร" จาก Document Flow ข้ามประเภทต้องมี `menuKey` ที่ backend ใส่ให้โหนด และจอปลายทางต้องเป็น `UniversalTransScreen` จึงจะโหลดเอกสารให้อัตโนมัติ
- กราฟถูกจำกัด 6 ขั้น/80 เอกสาร สายเอกสารที่ยาวกว่านั้นจะถูกตัด โดยไม่มีข้อความเตือนบนหน้าจอ

## ที่มาในโค้ด
- `frontend/account/transaction/ChequePickerModal.tsx:27-58` (spec ต่อ flag), `:61-90` (ชนิดข้อมูล/props), `:97-123` (โหลด + กรองซ้ำ), `:129-184` (หน้าตา)
- `frontend/account/transaction/TransItemGrid.tsx:224` (`lookupItem`), `:664-677` (ปุ่มค้นหาเช็ค), `:1146-1168` (ตัวป๊อปอัป + `onPick`)
- `frontend/account/transaction/DocumentFlowModal.tsx:21-102` (ชนิดข้อมูลกราฟ), `:104-112` (props), `:156-190` (โหลด), `:198-210` (คอลัมน์ตามขั้น), `:272-300` (เปิดเอกสาร), `:405-1060` (ห้าส่วน)
- `frontend/account/transaction/UniversalTransScreen.tsx:1815-1851, 3090-3098, 3138-3146, 4237-4246`; `UniversalCancelConfirmScreen.tsx:194, 858-866, 1026-1034`; `frontend/autocare/AutoCareWorkspace.tsx:121, 938, 1014-1020`
- `frontend/account/transaction/ItemNameModal.tsx:7-115`; `ItemRemarkModal.tsx:7-120`; `ItemGridContextMenu.tsx:42-110, 151-592`
- `frontend/account/transaction/StockBeginningBalanceScreen.tsx:1729-1900, 3801-3935, 4036-4062`
- `backend/internal/application/process/cheque.go:220-300`; `backend/internal/adapter/inbound/http/process/cheque_handler.go:29`; `bills_handler.go:25`; `permission.go:24`
- `backend/internal/application/process/doc_flow_graph.go:15-22, 268-340, 809-861`
- ดูเพิ่ม: [[proc-doc-cancel-approve]] · [[scr-cancel-confirm]] · [[fe-transaction-screens]] · [[screens-overview]]
