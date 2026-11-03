---
title: "รายการเมนูเอกสาร จัดซื้อ ขาย สินค้าคงคลัง (transMenuMap หมวด 1-3)"
tags: [frontend, transaction, menu, purchase, sale, inventory, transMenuMap]
aliases: ["transMenuMap", "TRANS_MENU_MAP", "เมนูใบสั่งซื้อ", "เมนูใบสั่งขาย", "เมนูเบิกสินค้า", "ใบเสนอซื้อ PR", "ใบสั่งซื้อ PO", "ใบเสนอราคา", "ใบสั่งจอง", "ขายสินค้า", "รับสินค้า", "โอนสินค้า", "ตรวจนับสินค้า", "ปรับปรุงสต็อก", "เงินมัดจำ", "เงินล่วงหน้า", "trans_flag", "ส่งคืนสินค้า", "ลดหนี้ซื้อ", "ลดหนี้ขาย"]
sources: ["frontend/account/tabs/transMenuMap.ts:1", "frontend/account/tabs/transMenuMap.ts:37", "frontend/account/tabs/transMenuMap.ts:54", "frontend/account/tabs/transMenuMap.ts:541", "frontend/account/tabs/transMenuMap.ts:922", "frontend/account/tabs/transMenuMap.ts:2466"]
---

# รายการเมนูเอกสาร จัดซื้อ ขาย สินค้าคงคลัง (หมวด 1-3 ของ `transMenuMap.ts`)

`account/tabs/transMenuMap.ts` เป็นตารางเดียวที่บอกว่าเมนูไหนคือเอกสารอะไร (รหัสชนิดเอกสาร `trans_flag`, ตารางที่เก็บ, โหมดบันทึก/ยกเลิก/อนุมัติ, เลขที่เอกสารขึ้นต้นด้วยอะไร) แล้ว `UniversalTransScreen` ใช้ config นี้วาดหน้าจอ ([[fe-transaction-screens]])
โน้ตนี้ครอบคลุม 76 เมนูแรก: จัดซื้อ 32, ขาย 25, สินค้าคงคลัง 19 (ส่วนเจ้าหนี้/ลูกหนี้/เงินสดธนาคาร/สมุดรายวัน 84 เมนูอยู่ที่ [[fe-transaction-menu-debt-cashbank]])

## ทำงานอย่างไร

**วิธีอ่านตาราง**: แต่ละแถวคือเมนูหนึ่งใน `TRANS_MENU_MAP` (ไฟล์ `frontend/account/tabs/transMenuMap.ts` คอลัมน์ "บรรทัด" คือบรรทัดที่นิยามเมนู)
- `trans_flag` = รหัสชนิดเอกสาร ค่าต่อเมนูอ่านจากโค้ดโดยตรง; ความหมายของรหัสแต่ละตัวมาจาก `_global.cs` ของ BCERP เดิมที่คอมเมนต์ในไฟล์อ้างถึง (ไม่ได้อ่านซ้ำที่นี่).
- โหมด: บันทึก (`doc`) = หน้าจอบันทึกเอกสาร; ยกเลิก (`cancel`) และอนุมัติ (`approve`) = หน้าจอ `UniversalCancelConfirmScreen`.
- "ต้นทาง N" = `origFlag` ของเอกสารที่ถูกยกเลิก/อนุมัติ; "flags [..]" = `transFlags` ที่รายการเอกสารรวมแสดง (เมื่อมากกว่าหนึ่งค่า); "อ้างอิงเอกสาร [..]" = `hasRefDoc` + `refTransFlags` คือจอที่ดึงรายการจากเอกสารอื่น; "โอนคลัง" = `isTransfer`.
- `trans_type` ของหมวดตามหัวคอมเมนู: จัดซื้อ = 1 (บรรทัด 54), ขาย = 2 (541), สินค้าคงคลัง = 3 (922).

**ตัวเรียก backend ตามชนิด/โหมด** (จาก `UniversalTransScreen.tsx:2652-2905`, `UniversalCancelConfirmScreen.tsx:469` และ `query-client.ts`)
| โหมด | ตาราง `kind` | endpoint |
|---|---|---|
| บันทึก | `ic_trans` | `POST /api/process/trans/save` |
| ลบ | `ic_trans` | `POST /api/process/trans/delete` |
| ยกเลิก | ทุกชนิด | `POST /api/process/doc/cancel` |
| อนุมัติ | ทุกชนิด | `POST /api/process/doc/approve` |
| ขอเลขที่เอกสาร | ทุกชนิด | `POST /api/process/stocktools/docnonext` |

หมวด 1-3 ทั้ง 76 เมนูเป็น `kind = ic_trans` (เก็บ `ic_trans`/`ic_trans_detail`) ตามตารางที่สร้างด้านล่าง.

### 1. ระบบจัดซื้อ (PO) - บรรทัด 54-540

**1.1 ใบเสนอซื้อ / ใบสั่งซื้อ** (6 เมนู)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ใบเสนอซื้อสินค้า (PR) | `menu_purchase_requisition` | 2 | บันทึก | ic_trans | PR | เจ้าหนี้ |  | 56 |
| อนุมัติใบเสนอซื้อสินค้า | `menu_purchase_requisition_approval` | 4 | อนุมัติ | ic_trans | PRA | เจ้าหนี้ | ต้นทาง 2 | 70 |
| ยกเลิกใบเสนอซื้อสินค้า | `menu_cancel_purchase_requisition` | 3 | ยกเลิก | ic_trans | PRC | เจ้าหนี้ | ต้นทาง 2 | 84 |
| ใบสั่งซื้อสินค้า (PO) | `menu_po_purchase_order` | 6 | บันทึก | ic_trans | PO | เจ้าหนี้ | flags [6,7]; อ้างอิงเอกสาร [4,2] | 99 |
| อนุมัติใบสั่งซื้อสินค้า | `menu_po_purchase_order_approve` | 8 | อนุมัติ | ic_trans | POA | เจ้าหนี้ | ต้นทาง 6 | 115 |
| ยกเลิกใบสั่งซื้อสินค้า | `menu_po_purchase_order_cancel` | 7 | ยกเลิก | ic_trans | POC | เจ้าหนี้ | ต้นทาง 6 | 129 |

**1.2 จ่ายเงินล่วงหน้า / มัดจำซื้อ** (10 เมนู; หัวคอมเมนูบรรทัด 144)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| จ่ายเงินล่วงหน้ายกมา | `menu_po_advance_payment_balance` | 9010 | บันทึก | ic_trans | PDB | เจ้าหนี้ |  | 145 |
| จ่ายเงินล่วงหน้า | `menu_po_deposit_payment_1` | 10 | บันทึก | ic_trans | PD | เจ้าหนี้ | อ้างอิงเอกสาร [6] | 159 |
| จ่ายเงินมัดจำยกมา | `menu_po_deposit_money_balance` | 9011 | บันทึก | ic_trans | PCB | เจ้าหนี้ |  | 175 |
| จ่ายเงินมัดจำ | `menu_po_deposit_payment_2` | 11 | บันทึก | ic_trans | PC | เจ้าหนี้ | อ้างอิงเอกสาร [6] | 189 |
| ยกเลิกจ่ายเงินล่วงหน้า | `menu_po_deposit_payment_1_cancel` | 150 | ยกเลิก | ic_trans | PDC | เจ้าหนี้ | ต้นทาง 10 | 205 |
| ยกเลิกจ่ายเงินมัดจำ | `menu_po_deposit_payment_2_cancel` | 151 | ยกเลิก | ic_trans | PCC | เจ้าหนี้ | ต้นทาง 11 | 219 |
| รับคืนจ่ายเงินล่วงหน้า | `menu_po_deposit_return_1` | 20 | บันทึก | ic_trans | PDR | เจ้าหนี้ | อ้างอิงเอกสาร [10] | 233 |
| รับคืนจ่ายเงินมัดจำ | `menu_po_deposit_return_2` | 25 | บันทึก | ic_trans | PCR | เจ้าหนี้ | อ้างอิงเอกสาร [11] | 249 |
| ยกเลิกรับคืนจ่ายเงินล่วงหน้า | `menu_po_deposit_return_1_cancel` | 161 | ยกเลิก | ic_trans | PDRC | เจ้าหนี้ | ต้นทาง 20 | 265 |
| ยกเลิกรับคืนจ่ายเงินมัดจำ | `menu_po_deposit_return_2_cancel` | 152 | ยกเลิก | ic_trans | PRT | เจ้าหนี้ | ต้นทาง 25 | 279 |

**1.3 ซื้อสินค้า / รับสินค้า / ตั้งหนี้ / ลดหนี้ / เพิ่มหนี้** (16 เมนู; หัวคอมเมนูบรรทัด 294)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ซื้อสินค้า/ตั้งหนี้ซื้อ | `menu_po_purchase_billing` | 12 | บันทึก | ic_trans | PU | เจ้าหนี้ | flags [12,310,315]; อ้างอิงเอกสาร [6] | 295 |
| ยกเลิกซื้อสินค้า/ตั้งหนี้ซื้อ | `menu_po_purchase_billing_cancel` | 13 | ยกเลิก | ic_trans | PUC | เจ้าหนี้ | ต้นทาง 12 | 311 |
| รับสินค้าตามใบสั่งซื้อ (ทะยอยรับ) | `menu_po_purchase_partial_item` | 310 | บันทึก | ic_trans | PI | เจ้าหนี้ | อ้างอิงเอกสาร [6] | 326 |
| ยกเลิกรับสินค้าตามใบสั่งซื้อ | `menu_po_purchase_partial_item_cancel` | 330 | ยกเลิก | ic_trans | CPIC | เจ้าหนี้ | ต้นทาง 310 | 342 |
| ตั้งหนี้ซื้อจากการรับสินค้า | `menu_po_purchase_partial_1` | 315 | บันทึก | ic_trans | PIU | เจ้าหนี้ | อ้างอิงเอกสาร [310] | 357 |
| ยกเลิกตั้งหนี้จากการรับสินค้า | `menu_po_purchase_partial_1_cancel` | 335 | ยกเลิก | ic_trans | PIUC | เจ้าหนี้ | ต้นทาง 315 | 373 |
| ส่งคืนสินค้า/ลดหนี้ซื้อ | `menu_po_credit_note` | 16 | บันทึก | ic_trans | PT | เจ้าหนี้ | อ้างอิงเอกสาร [12] | 388 |
| ส่งคืนสินค้าจากการรับ (ทะยอยรับ) | `menu_po_purchase_partial_item_debit` | 311 | บันทึก | ic_trans | PIA | เจ้าหนี้ | อ้างอิงเอกสาร [310] | 404 |
| ลดหนี้ซื้อจากใบตั้งหนี้ | `menu_po_purchase_partial_2` | 317 | บันทึก | ic_trans | PIC | เจ้าหนี้ | อ้างอิงเอกสาร [315] | 420 |
| ยกเลิกส่งคืนสินค้า/ลดหนี้ซื้อ | `menu_po_credit_note_cancel` | 17 | ยกเลิก | ic_trans | PTC | เจ้าหนี้ | ต้นทาง 16 | 436 |
| ยกเลิกส่งคืนสินค้าจากการรับ | `menu_po_purchase_partial_item_debit_cancel` | 331 | ยกเลิก | ic_trans | PIAC | เจ้าหนี้ | ต้นทาง 311 | 450 |
| ยกเลิกลดหนี้จากใบตั้งหนี้ | `menu_po_purchase_partial_2_cancel` | 337 | ยกเลิก | ic_trans | PICC | เจ้าหนี้ | ต้นทาง 317 | 464 |
| เพิ่มหนี้ซื้อ/ราคาผิด | `menu_po_addition_debt` | 14 | บันทึก | ic_trans | PA | เจ้าหนี้ | อ้างอิงเอกสาร [12] | 479 |
| เพิ่มหนี้ซื้อจากใบตั้งหนี้ | `menu_po_purchase_partial_3` | 316 | บันทึก | ic_trans | PID | เจ้าหนี้ | อ้างอิงเอกสาร [315] | 495 |
| ยกเลิกเพิ่มหนี้ซื้อ/ราคาผิด | `menu_po_addition_debt_cancel` | 15 | ยกเลิก | ic_trans | PAC | เจ้าหนี้ | ต้นทาง 14 | 511 |
| ยกเลิกเพิ่มหนี้จากใบตั้งหนี้ | `menu_po_purchase_partial_3_cancel` | 336 | ยกเลิก | ic_trans | PIDC | เจ้าหนี้ | ต้นทาง 316 | 525 |

### 2. ระบบขาย (SO) - บรรทัด 541-921

**2.1 ใบเสนอราคา / ใบสั่งจอง / ใบสั่งขาย** (9 เมนู)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ใบเสนอราคาขาย | `menu_so_quotation_order` | 30 | บันทึก | ic_trans | SO | ลูกหนี้ |  | 543 |
| อนุมัติใบเสนอราคาขาย | `menu_so_quotation_approve` | 32 | อนุมัติ | ic_trans | SOA | ลูกหนี้ | ต้นทาง 30 | 557 |
| ยกเลิกใบเสนอราคาขาย | `menu_so_quotation_cancel` | 31 | ยกเลิก | ic_trans | SOC | ลูกหนี้ | ต้นทาง 30 | 571 |
| ใบสั่งจองสินค้า | `menu_so_inquiry_order` | 34 | บันทึก | ic_trans | SR | ลูกหนี้ | flags [34,36]; อ้างอิงเอกสาร [30] | 586 |
| อนุมัติใบสั่งจองสินค้า | `menu_so_inquiry_order_approve` | 38 | อนุมัติ | ic_trans | SRA | ลูกหนี้ | ต้นทาง 34 | 602 |
| ยกเลิกใบสั่งจองสินค้า | `menu_so_inquiry_order_cancel` | 39 | ยกเลิก | ic_trans | SRC | ลูกหนี้ | ต้นทาง 34 | 616 |
| ใบสั่งขายสินค้า | `menu_so_sale_order` | 36 | บันทึก | ic_trans | SS | ลูกหนี้ | flags [36,37]; อ้างอิงเอกสาร [30,34] | 631 |
| อนุมัติใบสั่งขายสินค้า | `menu_so_sale_order_approve` | 52 | อนุมัติ | ic_trans | SSA | ลูกหนี้ | ต้นทาง 36 | 647 |
| ยกเลิกใบสั่งขายสินค้า | `menu_so_sale_order_cancel` | 37 | ยกเลิก | ic_trans | SSC | ลูกหนี้ | ต้นทาง 36 | 661 |

**2.2 รับเงินล่วงหน้า / มัดจำขาย** (10 เมนู; หัวคอมเมนูบรรทัด 676)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| รับเงินล่วงหน้ายกมา | `menu_so_advance_money_balance` | 9040 | บันทึก | ic_trans | SDB | ลูกหนี้ |  | 677 |
| รับเงินล่วงหน้า | `menu_so_deposit_receive_1` | 40 | บันทึก | ic_trans | SD | ลูกหนี้ | อ้างอิงเอกสาร [30,32,34,36] | 691 |
| รับเงินมัดจำยกมา | `menu_so_deposit_money_balance` | 9110 | บันทึก | ic_trans | SRVB | ลูกหนี้ |  | 707 |
| รับเงินมัดจำ | `menu_so_deposit_receive_2` | 110 | บันทึก | ic_trans | SRV | ลูกหนี้ | อ้างอิงเอกสาร [30,32,34,36] | 721 |
| ยกเลิกรับเงินล่วงหน้า | `menu_so_deposit_receive_1_cancel` | 41 | ยกเลิก | ic_trans | SDC | ลูกหนี้ | ต้นทาง 40 | 737 |
| ยกเลิกรับเงินมัดจำ | `menu_so_deposit_receive_2_cancel` | 111 | ยกเลิก | ic_trans | SCR | ลูกหนี้ | ต้นทาง 110 | 751 |
| คืนเงินรับล่วงหน้า | `menu_so_deposit_return_1` | 42 | บันทึก | ic_trans | SDR | ลูกหนี้ | อ้างอิงเอกสาร [40] | 765 |
| คืนเงินมัดจำ | `menu_so_deposit_return_2` | 112 | บันทึก | ic_trans | SRT | ลูกหนี้ | อ้างอิงเอกสาร [110] | 781 |
| ยกเลิกคืนเงินรับล่วงหน้า | `menu_so_deposit_return_1_cancel` | 43 | ยกเลิก | ic_trans | SDRC | ลูกหนี้ | ต้นทาง 42 | 797 |
| ยกเลิกคืนเงินมัดจำ | `menu_so_deposit_return_2_cancel` | 113 | ยกเลิก | ic_trans | SCT | ลูกหนี้ | ต้นทาง 112 | 811 |

**2.3 ขายสินค้า / รับคืน / เพิ่มหนี้ขาย** (6 เมนู; หัวคอมเมนูบรรทัด 826)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ขายสินค้า/บริการ | `menu_so_invoice` | 44 | บันทึก | ic_trans | SI | ลูกหนี้ | flags [44,144]; อ้างอิงเอกสาร [30,34,36] | 827 |
| ยกเลิกขายสินค้า/บริการ | `menu_so_invoice_cancel` | 45 | ยกเลิก | ic_trans | SIC | ลูกหนี้ | ต้นทาง 44 | 844 |
| รับคืนสินค้า/ลดหนี้ขาย | `menu_so_credit_note` | 48 | บันทึก | ic_trans | ST | ลูกหนี้ | อ้างอิงเอกสาร [44] | 859 |
| ยกเลิกรับคืนสินค้า/ลดหนี้ขาย | `menu_so_credit_note_cancel` | 49 | ยกเลิก | ic_trans | STC | ลูกหนี้ | ต้นทาง 48 | 875 |
| เพิ่มหนี้ขาย/ราคาผิด | `menu_so_invoice_add` | 46 | บันทึก | ic_trans | SA | ลูกหนี้ | flags [46,50]; อ้างอิงเอกสาร [44] | 890 |
| ยกเลิกเพิ่มหนี้ขาย/ราคาผิด | `menu_so_invoice_add_cancel` | 47 | ยกเลิก | ic_trans | SAC | ลูกหนี้ | ต้นทาง 46 | 906 |

### 3. ระบบสินค้าคงคลัง (IC) - บรรทัด 922-1206 (19 เมนู)

เบิก/รับคืนจากเบิก, โอนคลัง (เมนูที่ "โอนคลัง" ใช้ช่องคลังต้นทาง-ปลายทาง), ตรวจนับ และปรับปรุงสต็อก

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| สินค้า/วัตถุดิบ คงเหลือยกมา | `menu_ic_stk_balance` | 54 | บันทึก | ic_trans | IB | - |  | 924 |
| รับสินค้าสำเร็จรูป | `menu_ic_finish_receive` | 60 | บันทึก | ic_trans | IF | เจ้าหนี้ |  | 938 |
| ยกเลิกรับสินค้าสำเร็จรูป | `menu_ic_finish_receive_cancel` | 61 | ยกเลิก | ic_trans | IFC | - | ต้นทาง 60 | 952 |
| ขอเบิกสินค้า/วัตถุดิบ | `menu_ic_request_issue` | 122 | บันทึก | ic_trans | RIO | - |  | 967 |
| ยกเลิกขอเบิกสินค้า/วัตถุดิบ | `menu_ic_request_issue_cancel` | 123 | ยกเลิก | ic_trans | CRO | - | ต้นทาง 122 | 981 |
| เบิกสินค้า/วัตถุดิบ | `menu_ic_issue` | 56 | บันทึก | ic_trans | IO | - | อ้างอิงเอกสาร [122] | 996 |
| ยกเลิกใบเบิกสินค้า/วัตถุดิบ | `menu_ic_issue_cancel` | 57 | ยกเลิก | ic_trans | IOC | - | ต้นทาง 56 | 1012 |
| รับคืนสินค้า/วัตถุดิบ จากการเบิก | `menu_ic_return_receive` | 58 | บันทึก | ic_trans | IR | - | อ้างอิงเอกสาร [56] | 1027 |
| ยกเลิกรับคืนสินค้า/วัตถุดิบ จากการเบิก | `menu_ic_return_receive_cancel` | 59 | ยกเลิก | ic_trans | IRC | - | ต้นทาง 58 | 1043 |
| ขอโอนสินค้า/วัตถุดิบ | `menu_ic_request_transfer` | 124 | บันทึก | ic_trans | RIM | - | โอนคลัง | 1058 |
| โอนสินค้า/วัตถุดิบ | `menu_ic_transfer_wh_out` | 72 | บันทึก | ic_trans | IM | - | flags [72,124]; โอนคลัง; อ้างอิงเอกสาร [124] | 1073 |
| ยกเลิกโอนสินค้า/วัตถุดิบ | `menu_ic_transfer_wh_out_cancel` | 73 | ยกเลิก | ic_trans | IMC | - | ต้นทาง 72 | 1090 |
| ขอตรวจนับสินค้า | `menu_ic_request_stk_count` | 276 | บันทึก | ic_trans | RCO | - | flags [276,128] | 1105 |
| ขอตรวจนับสินค้า | `menu_ic_stk_count_request` | 276 | บันทึก | ic_trans | RCO | - | flags [276,128] | 1119 |
| ตรวจนับสินค้า | `menu_ic_stk_count` | 76 | บันทึก | ic_trans | CO | - | อ้างอิงเอกสาร [276,128] | 1133 |
| ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม) | `menu_ic_stk_adjust` | 66 | บันทึก | ic_trans | IA | - | flags [66,76] | 1149 |
| ปรับปรุงสต็อกสินค้า/วัตถุดิบ (ลด) | `menu_ic_stk_adjust_subtract` | 68 | บันทึก | ic_trans | IS | - |  | 1163 |
| ยกเลิกปรับปรุงสต๊อกสินค้า/วัตถุดิบ (เกิน) | `menu_ic_stk_adjust_over_cancel` | 67 | ยกเลิก | ic_trans | IAC | - | ต้นทาง 66 | 1177 |
| ยกเลิกปรับปรุงสต๊อกสินค้า/วัตถุดิบ (ขาด) | `menu_ic_stk_adjust_lost_cancel` | 69 | ยกเลิก | ic_trans | ISC | - | ต้นทาง 68 | 1191 |

**ข้อสังเกตจากข้อมูล**
- เมนูยกเลิก/อนุมัติทุกเมนูในไฟล์ (ทั้ง 66 เมนู) มีค่า "ต้นทาง" (`origFlag`) ตรงกับ `trans_flag` ของเมนูบันทึกอย่างน้อยหนึ่งเมนู (ตรวจด้วยสคริปต์ตอนสร้างโน้ต) จึงเพิ่มเอกสารชนิดใหม่ต้องเพิ่มทั้งคู่.
- ในหมวดสินค้าคงคลังมีสองเมนูชื่อ "ขอตรวจนับสินค้า" คือ `menu_ic_request_stk_count` (บรรทัด 1105) กับ `menu_ic_stk_count_request` (1119) ใช้ `trans_flag` 276 เหมือนกัน (ยังไม่ยืนยันว่าเหตุผลคือชื่อเมนูเดิมสองแบบหรือไม่).
- เมนูที่ไม่ใช่หน้าบันทึกเอกสารรายวันอยู่ใน `NON_TRANS_MENUS` (บรรทัด 37-50, 12 คีย์ เช่น `menu_ic_modify_price` และเมนู `*_doc_picture`) และ `getTransMenuConfig` คืน `undefined` ให้คีย์เหล่านั้น (2466-2467) - ห้ามเพิ่มเข้า `TRANS_MENU_MAP`.
- เมนูที่ไม่ได้ขายสินค้า (ค่าใช้จ่าย/รายได้) ตั้ง `itemLookup` ให้ช่องรหัสในตารางค้นตาราง `erp_expenses_list` หรือ `erp_income_list` แทน `ic_inventory` (ตัวอย่างบรรทัด 1256, 1454) - ดู [[fe-grid-component]].

**ข้อควรระวัง**
- รายการเมนูในโน้ตนี้อ่านจาก `transMenuMap.ts` ณ ขณะสร้างโน้ต; ถ้าเพิ่ม/ย้ายเมนู ต้องแก้ทั้ง `transMenuMap.ts` และ `transLayouts.ts` ([[fe-transaction-screens]]) และตรวจ `editionConfig` ว่ารุ่นไหนเห็นเมนูนี้ ([[fe-screen-registry-menu]]).
- ชื่อเมนูที่ผู้ใช้เห็นอาจต่างจากคอลัมน์ "ชื่อเมนู" เพราะ `getMenuTextByName` ดึงข้อความจากผังเมนูก่อน (`UniversalTransScreen.tsx:442`).

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1-35` - ชนิด `TransScreenMode`, `TransKind`, `TransMenuConfig`
- `frontend/account/tabs/transMenuMap.ts:37-50` - `NON_TRANS_MENUS`
- `frontend/account/tabs/transMenuMap.ts:54-540` - หมวดจัดซื้อ (PO) 32 เมนู
- `frontend/account/tabs/transMenuMap.ts:541-921` - หมวดขาย (SO) 25 เมนู
- `frontend/account/tabs/transMenuMap.ts:922-1206` - หมวดสินค้าคงคลัง (IC) 19 เมนู
- `frontend/account/tabs/transMenuMap.ts:2466` - `getTransMenuConfig`
- `frontend/account/transaction/UniversalTransScreen.tsx:402-505` - ใช้ config นี้

## ดูเพิ่ม
[[frontend-overview]] · [[fe-transaction-screens]] · [[fe-transaction-menu-debt-cashbank]] · [[fe-screen-registry-menu]] · [[process-overview]] · [[accounting-overview]]
