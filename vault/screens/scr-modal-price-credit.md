---
title: "ป๊อปอัปราคาขาย ต้นทุน และอนุมัติวงเงินเครดิต (PriceFormulaModal / PriceInfoModal / CostLockModal / CreditApproveModal)"
tags: [screens, transaction]
aliases: ["PriceFormulaModal", "PriceInfoModal", "CostLockModal", "CreditApproveModal", "สูตรราคาขาย", "ดูราคาขาย 3 ตาราง", "ล็อกต้นทุน", "ขออนุมัติวงเงินเครดิต", "CREDIT_PASSWORD"]
sources: ["frontend/account/transaction/PriceFormulaModal.tsx:28", "frontend/account/transaction/PriceInfoModal.tsx:14", "frontend/account/transaction/CostLockModal.tsx:15", "frontend/account/transaction/CreditApproveModal.tsx:9", "frontend/account/transaction/TransItemGrid.tsx:1178", "frontend/account/transaction/UniversalTransScreen.tsx:2796", "frontend/src/lib/query-client.ts:453", "backend/internal/application/process/trans_credit.go:24", "backend/internal/application/process/trans_save_rules.go:522"]
---
# ป๊อปอัปราคาขาย · ต้นทุนรายบรรทัด · อนุมัติวงเงินเครดิต

สี่ป๊อปอัปที่เปิดจากแถวสินค้าหรือจังหวะบันทึกของจอ transaction ทุกตัวเป็นกล่องซ้อน (`fixed inset-0 z-50`) ป๊อปอัปราคา **อ่านอย่างเดียวและคำนวณฝั่ง Go** ส่วนตัวที่เขียนค่ากลับมีสองตัว (สูตรราคา → ใส่ราคาแถว, ล็อกต้นทุน → ใส่ต้นทุนแถว) ผู้เรียกคือ [[scr-universal-trans]] และ [[scr-trans-item-grid]] (กลไกตารางดู [[fe-grid-component]]) ป๊อปอัปซีเรียล/ล็อต/ยอดคงเหลือดู [[scr-modal-serial-lot-stock]]; ป๊อปอัปเอกสาร/หมายเหตุดู [[scr-modal-document-item]]

| ป๊อปอัป | เปิดจาก | ใช้ในจอ |
|---|---|---|
| `PriceFormulaModal` | ปุ่ม "฿" ข้างช่องราคา และปุ่ม "฿ สูตรราคาขาย" ที่แถบใต้ตาราง | `UniversalTransScreen` (`:4201`), `StockBeginningBalanceScreen` (`:3956`) |
| `PriceInfoModal` | ปุ่ม "ราคาขาย" ในคอลัมน์จัดการ | `UniversalTransScreen` (`:4225`) เฉพาะเอกสาร flag 30, 34, 36, 44, 46 (`:268`) |
| `CostLockModal` | ไอคอนกุญแจในคอลัมน์จัดการ | `TransItemGrid` (`:1178`) |
| `CreditApproveModal` | อัตโนมัติเมื่อ backend ตอบ `CREDIT_PASSWORD:` ตอนบันทึก | `UniversalTransScreen` (`:4234`) |

## ตารางสูตรราคาขาย (`PriceFormulaModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, custCode, isEditing, onSelectPrice(price)` (`:28-40`) `custCode` คือลูกค้าหัวเอกสาร ใช้ให้ backend เลือกระดับราคาของลูกค้า (`ar_customer.price_level`)
- **ข้อมูล**: เรียก `POST /api/process/transgrid/formula` (`transGridFormula`) ได้แถวต่อหน่วยนับ แต่ละแถวมีระดับราคา 0-9 พร้อม "สูตร" และ "ราคาที่คำนวณแล้ว" (`query-client.ts:453-469`, หน้าจอ `:61`) สูตรอ้างราคาระดับ 0, ทศนิยมและการปัดเศษคำนวณฝั่ง Go ตามคอมเมนต์ (อ้างอิง C# `_calcFormulaPrice`) บวกราคาตามบาร์โค้ดจาก `ic_inventory_barcode` ของสินค้านั้น (`:83`)
- **สามแท็บ**:
  1. "ตารางสูตรราคา 0 - 9 (Price Matrix)" คอลัมน์หน่วยนับ + ราคา 0..9 ช่องที่ราคาคำนวณได้ > 0 คลิกได้ (ขณะแก้ไข) ช่องที่ยังไม่มีราคาแสดงตัวสูตรดิบหรือ "-" (`:173, :216-262`)
  2. "ราคาขายมาตรฐาน (1 - 4)" การ์ดสี่ใบ: ราคาขาย 1 (ทั่วไป) · 2 (สมาชิก) · 3 (ตัวแทน) · 4 (ส่งพิเศษ) — ค่ามาจากระดับ 1-4 ของ **แถวหน่วยนับแรก** เท่านั้น (`:62-70, :269-272`)
  3. "ราคาตามบาร์โค้ด (N)" คอลัมน์ บาร์โค้ด · หน่วยนับ · ราคาปกติ · ราคาสมาชิก · เลือก (`:305-332`) ปุ่ม "เลือก" ใช้ **ราคาปกติ** (`price`) ไม่ใช่ราคาสมาชิก
- **การนำราคาไปใช้**: คลิกตัวเลข/การ์ด/ปุ่ม "เลือก" (เฉพาะ `isEditing` และราคา > 0) → `onSelectPrice` แล้วปิด (`:110-116`) ในจอ transaction ทั่วไปจะอัปเดตช่อง `price` ของแถวเดิมแล้วคิดยอดบรรทัดใหม่ผ่าน backend (`UniversalTransScreen.tsx:4201-4222`) ส่วนในจอยกยอดสินค้าใส่ช่อง `price` ของแถวผ่าน `handleDetailChange` (`StockBeginningBalanceScreen.tsx:3962-3966`)
- หัวป๊อปอัปบอก "(Ctrl+3 / Ctrl+4)" — คีย์ลัดนี้มีเฉพาะจอยกยอดสินค้าคงเหลือ ([[scr-stock-beginning-balance]]) จอ transaction ทั่วไปไม่ผูกคีย์นี้ เปิดได้ด้วยปุ่มเท่านั้น

## ดูราคาขาย 3 ตาราง (`PriceInfoModal`)
- **Props**: `isOpen, onClose, itemCode, itemName, custCode, roworder` (`:14-23`) `roworder` คือ `ic_inventory_price.roworder` ของราคาที่แถวใช้อยู่ ใช้ไฮไลต์
- ข้อมูลจาก `POST /api/process/transgrid/priceinfo` (`transGridPriceInfo`) ได้ 3 ชุดข้อมูล: `normal`, `group`, `standard` และกลุ่มลูกค้าของเอกสาร `custGroup` (`query-client.ts:487-520`) ผลที่ตอบไม่ตรงคำขอปัจจุบันจะถูกถือว่ายังโหลดอยู่ (ป้องกันผลช้าเขียนทับ `:126-142`)
- **ตาราง**: "ราคาขายทั่วไป", "ราคาขายตามกลุ่มลูกค้า (กลุ่ม …)" (แสดงเมื่อมีแถว), "ราคาขายมาตรฐาน" คอลัมน์: (กลุ่มลูกค้าหลัก/ชื่อ/ย่อย/ชื่อ เฉพาะตารางกลุ่ม) · ราคาขาย 1 · ราคาขาย 2 · หน่วยนับ · ชื่อหน่วย · จากจำนวน · ถึงจำนวน · จากวันที่ · ถึงวันที่ · ประเภทการขาย (ทั้งหมด / เงินสด / เงินเชื่อ) · สถานะ (ใช้งาน / ไม่ใช้งาน สีแดงเมื่อ `status = 1`) (`:25, :54-113`)
- แถวที่ตรงกับ `roworder` ของแถวบิล = ตัวหนาสีแดง (`:87-90`) ว่างเปล่าแสดง "ไม่มีข้อมูลราคา" ท้ายป๊อปอัป "โหมดดูข้อมูลอย่างเดียว — แก้ราคาที่ทะเบียน…" (`:201`) ไม่มีปุ่มนำราคาไปใช้ ใช้ `PriceFormulaModal` แทน
- ปุ่มนี้แสดงเฉพาะเอกสารกลุ่มขาย (flag 30, 34, 36, 44, 46) ตามคอมเมนต์ "จอขายที่ C# เปิดดูราคาขาย" (`UniversalTransScreen.tsx:266-268, 3759`)

## ล็อกต้นทุนรายบรรทัด (`CostLockModal`)
- **Props**: `itemCode, itemName, locked, sumOfCostFix, isEditing, onClose, onApply(isLockCost: 0|1, sumOfCostFix)` (`:5-18`)
- ช่องเดียว "ต้นทุนรวมของรายการนี้ (บาท)" — เป็น **ต้นทุนรวมทั้งบรรทัด ไม่ใช่ต่อหน่วย** (`NumberBox` ชนิด `amount` ไม่รับค่าติดลบ) พร้อมข้อความสถานะ: "ล็อกต้นทุนอยู่ — ประมวลผลสต็อกจะใช้ต้นทุนนี้แทนต้นทุนเฉลี่ย" หรือ "ยังไม่ล็อก — ใช้ต้นทุนเฉลี่ยตามปกติ" (`:45-49`)
- ปุ่ม **ล็อกต้นทุน** (ส่ง 1 + ค่าที่กรอก), **ปลดล็อกต้นทุน** (ส่ง 0, เห็นเมื่อกำลังล็อกอยู่ขณะแก้ไข), ยกเลิก/ปิด; การกดตกลงเก็บ `is_lock_cost` และ `sum_of_cost_fix` ในแถว (`TransItemGrid.tsx:1178-1190`) แล้วไปกับการบันทึกเอกสาร ฝั่ง Go ใช้ค่าเหล่านี้ตอน rebuild สต็อก/ต้นทุน (`process/service.go:308, 1157`) และเขียนลง `ic_trans_detail.is_lock_cost / sum_of_cost_fix` (`trans.go:704`)
- ไอคอนกุญแจในตารางโผล่เมื่อแถวมีรหัสสินค้า ไม่ใช่โหมดจำนวนเงิน/เช็ค และ (กำลังแก้ไข หรือแถวนั้นล็อกอยู่) (`TransItemGrid.tsx:1020-1030`) รายละเอียดเงื่อนไขดู [[scr-trans-item-grid]] คอมเมนต์ต้นทางอ้าง C# Ctrl+F9 / Shift+F9 แต่ในเว็บเปิดได้ด้วยปุ่มเท่านั้น (ไม่พบการผูกคีย์ใน `TransItemGrid.tsx`)
- ต้นทุนซ่อน/ต้นทุนมาตรฐานของสินค้าดู [[scr-hidden-cost]]

## ขออนุมัติวงเงินเครดิต (`CreditApproveModal`)
- **เปิดเมื่อไร**: ตอนกดบันทึก ถ้า Go ตอบ 409 ข้อความขึ้นต้น `CREDIT_PASSWORD:` จอตัดข้อความหลังโคลอนมาแสดงเป็นกล่องแดง แล้วรอให้ผู้ใช้กรอกผู้อนุมัติ (`UniversalTransScreen.tsx:2796-2812`) ส่งซ้ำพร้อม `creditApproveUser` / `creditApprovePassword` (กดยกเลิก = ไม่บันทึก)
- **หน้าตา**: หัว "ขออนุมัติวงเงินเครดิต", ข้อความจาก backend, ช่อง "รหัสผู้อนุมัติ" (สูงสุด 100 ตัว, โฟกัสอัตโนมัติ), ช่อง "รหัสผ่าน", ปุ่ม **อนุมัติ** (ปิดไว้จนกว่าจะกรอกรหัสผู้อนุมัติ) และ ยกเลิก (`CreditApproveModal.tsx:18-65`) Enter ส่งฟอร์ม
- **เงื่อนไขฝั่ง Go** (`checkTransCredit` `trans_credit.go:33-46`, `checkCreditLimit` `trans_save_rules.go:522+`, `creditApprover` `trans_credit.go:50-70`, `approveCredit` `:77-82`): ลูกค้าที่ `credit_status <> 0` = บล็อกเลย ไม่มีป๊อปอัป ("ลูกค้า … ถูกปิดสถานะเครดิต" `:547`; สถานะ 2 มีข้อความ "ยังไม่อนุมัติเปิดสถานะเครดิต" `:545`); เกินวงเงินเมื่อ `erp_option` เปิด `lock_credit_money` และ `password_ar_credit` = ขอรหัสผู้อนุมัติ (`:564`); ผู้อนุมัติต้องอยู่ใน `erp_user` และมี `approve_ar_credit = 1` ข้อความเมื่อผิดทุกกรณีเหมือนกัน "รหัสผู้อนุมัติหรือรหัสผ่านไม่ถูกต้อง" ชื่อผู้อนุมัติถูกเขียนลง `ic_trans.user_approve` (`trans_credit.go:42-45`) เอกสารสั่งจอง/สั่งขาย flag 34/36 ใช้เส้นทางตรวจแยก (`checkOrderCredit` `:178`, ทำงานเมื่อเปิดตัวเลือกตรวจเครดิตใบสั่ง `o.orderCredit`) ข้อมูลเครดิตลูกค้าดู [[scr-customer-detail]]
- รหัสผ่านไม่ถูกเก็บลง log หรือส่งกลับ (คอมเมนต์ `trans.go:204`: never echoed or logged)

## ข้อควรระวัง
- ราคาที่นำไปใส่ผ่านสูตรราคาเป็นสตริงทศนิยมจาก backend ไม่ผ่านการคำนวณฝั่งเบราว์เซอร์ ([[fe-numeric-money]]) แต่จอยกยอดสินค้าเก็บเป็น number
- ถ้า backend ตอบข้อผิดพลาดอื่นที่ไม่ใช่ `CONFIRM:` / `CREDIT_PASSWORD:` ตอนบันทึก จอแจ้งข้อผิดพลาดตามปกติ ไม่มีป๊อปอัปนี้
- `PriceInfoModal` แสดงเฉพาะ 5 flag ขาย ปุ่ม "ราคาขาย" จึงไม่มีในจอซื้อ/สต็อก ส่วนปุ่ม "฿" สูตรราคาขายไม่ถูกจำกัดตาม flag ในที่เรียก (`UniversalTransScreen.tsx:3745-3758`) แต่ซ่อนเมื่อแถวไม่มีรหัสสินค้า
- ป๊อปอัปราคาไม่แก้ทะเบียนราคา การตั้งสูตร/ราคาทำที่จอข้อมูลสินค้า ([[scr-item-master]], [[scr-modify-price]])

## ที่มาในโค้ด
- `frontend/account/transaction/PriceFormulaModal.tsx:28-40` props; `:54-108` โหลด; `:110-116` นำไปใช้; `:164-200` แท็บ; `:216-262` เมทริกซ์; `:269-296` มาตรฐาน; `:305-335` บาร์โค้ด
- `frontend/account/transaction/PriceInfoModal.tsx:14-25` props/ป้ายประเภทการขาย; `:34-123` ตาราง; `:125-205` ตัวป๊อปอัป
- `frontend/account/transaction/CostLockModal.tsx:5-70`
- `frontend/account/transaction/CreditApproveModal.tsx:5-65`
- `frontend/account/transaction/TransItemGrid.tsx:916-923, 990-996, 1020-1030, 1116-1120, 1178-1190`
- `frontend/account/transaction/UniversalTransScreen.tsx:266-268, 2796-2812, 3745-3768, 4201-4236`
- `frontend/src/lib/query-client.ts:453-520` (`transGridFormula`, `transGridPriceInfo`)
- `backend/internal/adapter/inbound/http/process/transgrid_handler.go:36, 54`; `backend/internal/adapter/inbound/http/process/permission.go:29`; `backend/internal/application/process/trans_credit.go:24-90`; `trans_save_rules.go:513-570`; `trans.go:204, 704`; `backend/internal/application/process/service.go:308, 1157`
- ดูเพิ่ม: [[fe-transaction-screens]] · [[term-vat-type]] · [[screens-overview]]
