---
title: "บิลขาย POS เข้าบัญชีและตัดสต็อกอย่างไร"
tags: [faq, pos, sale, stock, gl]
aliases: ["POS ตัดสต็อกยังไง", "บิล POS เข้าบัญชี", "pos_bill_inbox", "pos_stock_queue", "บิลขาย POS flag 44", "ยกเลิกบิล POS CNM", "ขายหน้าร้านลงบัญชี", "บิล POS ส่งมาแล้วไม่เห็นสต็อกลด", "ReceivePosBill"]
sources: ["backend/internal/application/process/pos_bill.go:123", "backend/internal/application/process/pos_bill.go:314", "backend/internal/application/process/pos_bill.go:415", "backend/internal/application/process/pos_bill.go:601", "backend/internal/application/process/trans.go:573", "backend/internal/application/process/service.go:2012", "backend/internal/application/process/stock_rebuild.go:18"]
---
# บิลขาย POS เข้าบัญชีและตัดสต็อกอย่างไร

**ตอบสั้น:** บิลที่เครื่อง POS ส่งมาถูกเก็บลง `pos_bill_inbox` ก่อน แล้วแปลงเป็นเอกสารขายสด flag 44 ลงบัญชีทันทีด้วยสูตรเดียวกับใบขายสด ส่วนสต็อกและต้นทุนไม่ได้ตัดในจังหวะบันทึก ระบบใส่รหัสสินค้าลงคิว `pos_stock_queue` แล้วรีบิลด์เป็นชุดหลังประมาณ 2 วินาที

## รายละเอียด

ลำดับต่อบิล (`ReceivePosBill` → `processPosBill` ใน transaction เดียว):
1. **รับบิล** เก็บ JSON ลง `pos_bill_inbox` คีย์ `bill_guid` ส่งซ้ำไม่สร้างเอกสารซ้ำ (`pos_bill.go:123`, handler `pos/sync.go:111`)
2. **สร้างเอกสาร** `savePosBillTx` สร้าง `ic_trans` เป็น `TransType 2`, `TransFlag 44`, `InquiryType 1` (ขายสด) ตั้ง `is_pos = 1` ทั้งหัวและบรรทัด (`pos_bill.go:314`, `:360-361`, `:402-405`) ราคาในบรรทัดใช้ราคาตอนขายจากเครื่อง
3. **บันทึกการรับเงิน** `savePosPaymentTx` เขียน `cb_trans` และ `cb_trans_detail` แยกยอดตามวิธีจ่าย (เงินสด, โอน, QR/วอลเล็ต, บัตร) (`pos_bill.go:411-412`, `:424`)
4. **ลงบัญชี** `rebuildGLTx` ของ flag 44 (`pos_bill.go:415`) เพราะเป็นขายสด สูตรจึงแตกบรรทัดเดบิตตามยอดใน `cb_trans`: เงินสดเข้าบัญชีเงินสด, โอนกับ QR/วอลเล็ตเข้าบัญชีธนาคาร, บัตรเข้าบัญชีลูกหนี้ แล้วเครดิตรายได้ขายและภาษีขาย (`service.go:2012-2058`) ถ้ายอดสามช่องรวมไม่เท่ายอดบิล สูตรจะใช้ช่องทางรับเงินตามปกติแทน (`service.go:2028`) สูตรนี้ไม่มีบรรทัดต้นทุนขาย ดู [[faq-sale-invoice-gl-posting]]
5. **สต็อก** บิลตั้ง `deferStock = true` (`pos_bill.go:368`) `saveTransTx` จึงไม่รีบิลด์สต็อกทันที แต่ใส่รหัสสินค้า (ทั้งของเดิมและใหม่) ลง `pos_stock_queue` (`trans.go:573`, `pos_bill.go:517`) แล้ว `schedulePosStockDrain` รวมบิลที่ทยอยเข้ามาให้รีบิลด์ครั้งเดียวต่อฐานบริษัท หน่วง 2 วินาที (`pos_bill.go:682-686`) และ `DrainPosStock` ดึงจากคิวทีละ 200 รหัสแล้ว `rebuildStockTx` (`pos_bill.go:703`, `:725`)
6. **แต้มสมาชิกและคูปอง** รีบิลด์ใหม่จากบิลทั้งหมด ไม่ได้บวกลบทีละรายการ (`pos_bill.go:636`, `:668`)

- **ผลต่อสต็อก:** 44 อยู่ในรายการ flag ที่ตัวนับสต็อกรับ (`stock_rebuild.go:18-19`) ยอดคงเหลือและต้นทุนจึงมาจากการรีบิลด์ในคิว ดู [[faq-stock-rebuild]] และ [[faq-moving-average-cost]]
- **ยกเลิกบิล:** ตั้ง `cancelled_at` บน inbox แล้วประมวลผลบิลซ้ำ (`pos_bill.go:575-594`) `cancelPosBillTx` ตั้ง `last_status = 1` ที่ `ic_trans`, `ic_trans_detail`, `cb_trans_detail` ของใบ 44 (หัว `ic_trans` ตั้ง `is_cancel = 1` ด้วย) สร้างหัวเอกสาร flag 45 เลข `CNM-<เลขบิลเดิม>` ที่ `doc_ref` ชี้บิลเดิม แล้วเรียกรีบิลด์ GL ของบิลเดิม ซึ่งเพราะ `is_cancel = 1` จะลบ journal เดิมออกและไม่สร้างใหม่ (`pos_bill.go:601-630`, `service.go:1424-1451`, `:1490-1491`) ส่วนสต็อก บิลเดิมหลุดจากการนับเมื่อคิวรีบิลด์รอบถัดไปทำงาน การยกเลิกจากเครื่อง POS เรียก action `cancel_bill` (`pos_config.go:991-997`) เทียบกับการยกเลิกใบขายปกติได้ที่ [[faq-cancel-vs-edit-vs-delete]]
- **ประมวลผลซ้ำ:** บิลที่ค้างสถานะผิดพลาดสั่ง `ReprocessPosBills` ได้ (`pos_bill.go:175`) การตั้งค่าเครื่อง กะ และการเงินในกะอยู่ใน [[proc-pos-config-shift]] ส่วนการซิงก์ข้อมูลเครื่องอยู่ใน [[proc-pos-sync]]

## ข้อควรระวัง

- บิล POS ที่ส่งมาแล้วสต็อกยังไม่ลด ให้ตรวจก่อนว่ามีรหัสสินค้านั้นค้างใน `pos_stock_queue` หรือไม่ การรีบิลด์ที่พลาดไม่ทำให้บิลล้ม รายการยังค้างคิวรอรอบถัดไป (`pos_bill.go:703`)
- เลขที่บิลที่ซ้ำกับใบขาย flag 44 ที่ไม่ใช่บิล POS ของเครื่องเดียวกันจะบันทึกไม่ได้ (`pos_bill.go:372-376`)
- ยอดรับชำระรวมต้องไม่น้อยกว่ายอดบิลที่เซิร์ฟเวอร์คำนวณ ไม่เช่นนั้นเกิด error "ยอดรับชำระ … น้อยกว่ายอดบิล" (`pos_bill.go:391`) และบิลค้างสถานะผิดพลาดใน inbox
- ใบ 45 (`CNM-…`) ไม่อยู่ในรายการ flag ที่ลง GL (`service.go:1742-1756`) บิลที่ยกเลิกจึงไม่มีรายการบัญชีเหลือเลย ไม่ได้เก็บคู่กับรายการกลับ ต่างจากคอมเมนต์ที่ `service.go:1490` ที่เขียนว่าเอกสารที่ยกเลิกเก็บ GL ไว้และให้ใบยกเลิกลงรายการกลับ

## ดูเพิ่ม

- [[proc-pos-bill]] · [[faq-payment-tab-tenders]] · [[faq-gl-rebuild-when]] · [[faq-negative-stock]] · [[flow-order-to-cash]]

## ที่มาในโค้ด

- `backend/internal/application/process/pos_bill.go:26` (`posBillFlag = 44`), `:123` (`ReceivePosBill`), `:202` (`processPosBill`), `:314` (`savePosBillTx`), `:360-368`, `:402-405`, `:411-415`, `:424` (`savePosPaymentTx`)
- `backend/internal/application/process/pos_bill.go:517` (`queuePosStock`), `:682-686`, `:703-725` (`DrainPosStock`)
- `backend/internal/application/process/pos_bill.go:575-594` (`CancelPosBill`), `:601-630` (`cancelPosBillTx`), `:391` (ตรวจยอดรับชำระ)
- `backend/internal/application/process/trans.go:573` (`deferStock` → คิว)
- `backend/internal/application/process/service.go:2012-2058` (GL ของ 44 แยกตามช่องทางรับเงิน), `:1424-1451` และ `:1490-1491` (รีบิลด์ลบ journal แล้วเลือกเฉพาะ `is_cancel = 0`)
- `backend/internal/application/process/stock_rebuild.go:18-19` (flag ที่นับสต็อก)
- `backend/internal/application/process/pos_config.go:991-997` (action `cancel_bill`)
