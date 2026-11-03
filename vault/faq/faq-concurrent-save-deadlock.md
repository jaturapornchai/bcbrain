---
title: "หลายคนบันทึกเอกสารพร้อมกันแล้วช้า/ค้าง/ขึ้น deadlock หรือเลขที่ซ้ำ ระบบกันอย่างไร"
tags: [faq, concurrency, lock, deadlock, troubleshooting, backend, dev]
aliases: ["deadlock detected","40P01","บันทึกพร้อมกัน","pg_advisory_xact_lock","lockStockItems","lockGLShared","บันทึกช้ารอ rebuild","เลขที่เอกสารซ้ำ","POS inbox timeout","advisory lock"]
sources: ["backend/internal/application/process/service.go:1003", "backend/internal/application/process/service.go:1308", "backend/internal/application/process/service.go:1376", "backend/internal/application/process/trans.go:473", "backend/internal/application/process/trans.go:510", "backend/internal/application/process/doc_cancel.go:433", "backend/internal/application/process/pay_check.go:170"]
---
# หลายคนบันทึกเอกสารพร้อมกันแล้วช้า/ค้าง/ขึ้น deadlock หรือเลขที่ซ้ำ ระบบกันอย่างไร

**ตอบสั้น:** การบันทึก/ลบ/ยกเลิกเอกสารใช้ PostgreSQL advisory lock ภายใน tx เดียวกัน 3 ชั้นตามลำดับคงที่: (1) ล็อกเอกสาร `ic_trans:<เลขที่>:<flag>` (2) ล็อก GL แบบ shared (3) ล็อก shared ของสต็อกทั้งฐาน แล้วล็อกรายสินค้าเรียงรหัส ล็อกพวกนี้ปล่อยเองตอน commit/rollback อาการ "รอนาน" ส่วนมากคือรอ rebuild GL ช่วงวันที่ (ล็อก exclusive) หรือรอเอกสารอื่นที่ถือสินค้าเดียวกัน ไม่ใช่ระบบค้าง

## รายละเอียด
**ลำดับล็อกใน `saveTransTx`** (`trans.go:510`):
1. `lockTransDoc` (`:473`): `pg_advisory_xact_lock(hashtext("ic_trans:<doc>:<flag>"))` — กันบันทึก/ลบเลขเดียวกันซ้อนกัน จากนั้น `lockGLShared` ทันที แล้วอ่านรายการสินค้า/เลขเช็คที่เอกสารเดิมถืออยู่
2. `lockStockItems` (`service.go:1003`) รับสินค้าของเอกสารเดิม + ใหม่ รวมเป็น `uniqueSorted` แล้ว: ล็อก shared `ic_inventory:rebuild` และล็อกรายสินค้า `ic_stock:<code>` เรียงตามรหัส ทำให้สองเอกสารที่มีสินค้าเดียวกันหลายตัวไม่ล็อกสลับลำดับ (สาเหตุของ deadlock เดิม: บันทึกที่ทำให้ต้นทุนเปลี่ยนไปแก้แถว `ic_trans_detail` ของเอกสารอื่นในสินค้าเดียวกัน ดู [[faq-why-stock-cost-changed]])
3. `rebuildTransDerived` ใช้ `uniqueSorted(items)` อีกรอบ (`trans.go:595`) เพื่อ rebuild สต็อกในลำดับคงที่

**ล็อก exclusive (ตัวที่ทำให้ทุกคนรอ):**
- `RebuildGL` (`service.go:1308`) เปิด tx 60 วินาทีและล็อก `gl_journal:rebuild` แบบ exclusive ระหว่างลบ-ลงบัญชีใหม่ทั้งช่วงวันที่ ส่วนการบันทึก/อนุมัติ/ยกเลิก/ขายสินทรัพย์ถือ shared จึงทำงานคู่กันได้ แต่ต้องรอ rebuild จบ ([[faq-gl-rebuild-when]])
- `RebuildStock` ทั้งฐาน (ไม่ระบุสินค้า) ล็อก `ic_inventory:rebuild` แบบ exclusive (`service.go:1025`) ทุกเอกสารที่มีสินค้ารอจนจบ ([[faq-stock-rebuild]])

**ล็อกเฉพาะเรื่องอื่น ๆ:**
| จุด | ล็อกอะไร | ที่ |
|---|---|---|
| ออกเลขเอกสารสถานะ (ยกเลิก/อนุมัติ) | `docno:<table>:<prefix>` กันเลขซ้ำ | `doc_cancel.go:433` |
| ใบรับ/จ่ายชำระบิลเดียวกัน | `bill:<เลขวางบิล>` เรียงด้วย `ORDER BY` แล้วค่อยตรวจยอดคงเหลือ | `pay_check.go:170` |
| มัดจำที่หลายใบใช้ร่วมกัน | วนล็อกตามลำดับ sorted | `trans_deposit.go:147` |
| แก้ต้นทุนแฝง (hidden cost) | ล็อกเลขเอกสารเรียงลำดับ | `hidden_cost.go:381` |
| ขายสินทรัพย์ | ล็อก `asset-sale` ก่อน แล้วล็อก GL shared | `fa_sale.go:406` |

**ถ้าเลขที่เอกสารชนกัน:** ล็อกเอกสารทำให้คนที่สองรอ แล้ว `rejectDuplicate` ตอบ "เลขที่เอกสารซ้ำ" (`trans.go:1256`) ไม่ใช่เขียนทับ ([[faq-doc-number-format]])

## ข้อควรระวัง
- ค้นโค้ดแล้วไม่พบการแปลง SQLSTATE `40P01` เป็นข้อความไทย ถ้ามี deadlock หลุดจริง ผู้ใช้จะเห็น error ภายในดิบ ให้กดบันทึกใหม่ได้เพราะ rollback ทั้งก้อน ([[faq-save-atomic-partial]]) แต่ให้แจ้งผู้พัฒนาพร้อมเลขเอกสารและสินค้า เพราะแปลว่ามีเส้นทางที่ล็อกผิดลำดับ
- **ข้อจำกัดที่โค้ดเขียนไว้เอง** (คอมเมนต์ `service.go:1366-1375`): ใช้คีย์ GL คีย์เดียวทั้งฐาน การ rebuild ช่วงยาวทำให้ทุกใบรอสูงสุดราว 60 วินาที ถ้า inbox ของ POS รอคิวหลัง rebuild อาจหมดเวลา 60 วินาทีของตัวเอง ทางแก้ที่โค้ดระบุคือเปลี่ยนเป็นคีย์รายงวด ยังไม่ได้ทำ ดังนั้นอย่า rebuild ช่วงยาวช่วงชั่วโมงขายหนัก
- ล็อกเป็นแบบ advisory ใช้ได้เฉพาะโค้ดที่เรียก `lock*` เท่านั้น ทางเขียนใหม่ที่แตะ `ic_trans_detail`/`gl_journal` ต้องล็อกตามลำดับเดียวกัน (เอกสาร, GL shared, สต็อกเรียงรหัส) ก่อนเขียนแถวแรก
- เทสต์ที่กันลำดับล็อก (`service_test.go:58`, `:85`) ใช้ tx จำลองตรวจลำดับคำสั่ง ไม่ได้ทดสอบกับ PostgreSQL จริง ประวัติระบุว่าการรัน repro ซ้ำกับฐานจริงยังไม่ได้ยืนยัน ([[hist-lessons-concurrency-advisory-locks]])

## ดูเพิ่ม
- [[faq-save-atomic-partial]]
- [[faq-stock-rebuild]]
- [[faq-gl-rebuild-when]]
- [[faq-doc-number-format]]
- [[hist-lessons-concurrency-advisory-locks]]
- [[acc-gl-rebuild]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1003` `lockStockItems` (ค่าคงที่ `stockRebuildLock` บรรทัด 1001; exclusive ที่ `:1025`)
- `backend/internal/application/process/service.go:1308` `RebuildGL` ล็อก exclusive / `:1367-1376` `glRebuildLock` พร้อมคอมเมนต์ข้อจำกัด / `:1381` `lockGLShared`
- `backend/internal/application/process/trans.go:473` `lockTransDoc` / `:510` `saveTransTx` (เรียก `lockStockItems` บรรทัด 515)
- `backend/internal/application/process/trans.go:1256` `rejectDuplicate` "เลขที่เอกสารซ้ำ"
- `backend/internal/application/process/doc_cancel.go:433` ล็อกเลขเอกสารต่อ prefix
- `backend/internal/application/process/pay_check.go:170` ล็อกบิลเรียงลำดับ
- `backend/internal/application/process/service_test.go:58` `TestSavesTakeGLRebuildLockFirst`
