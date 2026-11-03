---
title: "บันทึก/ลบเอกสารแล้วข้อมูลไม่ครบหรือเหลือครึ่ง ๆ กลาง ๆ ได้ไหม (atomic transaction ทำงานอย่างไร)"
tags: [faq, transaction, atomic, troubleshooting, backend, dev]
aliases: ["บันทึกไม่ครบ","ข้อมูลค้างครึ่งเดียว","rollback","atomic save","inTransTx","บันทึกแล้วสต็อกไม่ขึ้น","บันทึกแล้ว GL ไม่ตาม","timeout 60 วินาที","execBatch transactional","partial save"]
sources: ["backend/internal/application/process/trans.go:267", "backend/internal/application/process/trans.go:446", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/trans.go:395", "backend/internal/adapter/outbound/dynamicsql/gateway.go:197", "backend/internal/application/process/master_detail.go:152", "backend/internal/application/process/doc_cancel.go:120"]
---
# บันทึก/ลบเอกสารแล้วข้อมูลไม่ครบหรือเหลือครึ่ง ๆ กลาง ๆ ได้ไหม

**ตอบสั้น:** เอกสารซื้อ-ขาย-สต็อก-การเงิน (`/process/trans/save` และ `/delete`) ทำเป็น transaction เดียว: เขียนแถวเอกสาร, คำนวณสต็อก, ลงบัญชี GL, สถานะเช็ค, เลขซีเรียล ในก้อนเดียว ถ้าขั้นใดพังหรือเกิน 60 วินาที ทุกอย่างถูกย้อนกลับ ผู้ใช้จะได้ error และข้อมูลเหมือนก่อนกดบันทึก ดังนั้น "เอกสารเข้าแต่ GL ไม่เข้า" จากเส้นทางนี้ไม่ควรเกิด ถ้าเจอ ให้สงสัยข้อมูลเก่าจากบั๊กรุ่นก่อน หรือจอที่ยังเขียนผ่าน `query/exec` ทีละคำสั่ง

## รายละเอียด
**ลำดับของ `SaveTrans`** (`trans.go:267`):
1. ก่อนเปิด tx: หาสาขา, เงื่อนไขจ่ายเงิน, ล็อตอัตโนมัติ, ทำบรรทัดสินค้าให้เป็นมาตรฐาน, สร้าง `transArgs` (ถ้าผิดตรงนี้ ยังไม่มีอะไรถูกเขียน)
2. `inTransTx` (`:446`) เปิด timeout 60 วินาที + `pool.Begin` + `defer tx.Rollback` แล้วเรียก `checkAndSaveTransTx` (`:301`): ตรวจจอ/เลขภาษี/สินค้าถูกกัน/เอกสารอ้างอิง แล้ว `saveTransTx` (`:510`)
3. `saveTransTx` ล็อกเอกสารและสินค้า (ดู [[faq-concurrent-save-deadlock]]) ลบ-เขียนแถวเอกสารใหม่ทั้งชุด, แท็บชำระเงิน (`cb_trans`), ภาษี/หัก ณ ที่จ่าย, มัดจำ, `docFlowTx` (สถานะเอกสารต้นทาง), `rebuildSerialTx`
4. `rebuildTransDerived` (`:593`) ใน tx เดียวกัน: `rebuildStockTx` (สต็อก), คู่โอนคลัง, `rebuildGLTx` (บัญชี), สถานะเช็ค ดูเงื่อนไขที่ [[faq-gl-rebuild-when]] และ [[faq-stock-rebuild]]
5. `tx.Commit` เป็นขั้นสุดท้าย มีแค่จุดนี้ที่ข้อมูลมองเห็นได้ทั้งก้อน

**ลบเอกสาร:** `DeleteTrans` (`:382`) → `deleteTransTx` (`:395`) ใช้ `inTransTx` และล็อกแบบเดียวกัน ตรวจว่ามัดจำถูกใช้แล้ว/มีเอกสารอื่นอ้างอิงหรือไม่ (ถ้าใช่ปฏิเสธทั้งหมด) แล้วลบแถวลูกถึงหัวและ GL ที่เกี่ยวข้อง ([[faq-cannot-delete-document]])

**ยกเลิกเอกสาร:** `CancelDoc` (`doc_cancel.go:120`) ก็ผ่าน `inTransTx` เหมือนกัน ([[faq-cancel-vs-edit-vs-delete]])

**จอข้อมูลหลักหัว-รายการ:** `/process/master-detail/save` เปิด tx เดียว timeout 30 วินาที เขียนหัว+ตารางย่อยแล้ว commit (`master_detail.go:152-169`)

**ทางอื่นที่เขียน DB และ atomic ต่างกัน:**
| ทาง | พฤติกรรม |
|---|---|
| `/query/exec` (จอ master ตารางเดียว) | 1 คำสั่ง = 1 การเขียน ย้อนกลับทั้งก้อนไม่ได้ถ้าจอยิงหลายครั้ง ([[faq-query-exec-write-blocked]]) |
| `/query/execBatch` | รันทุกคำสั่งใน tx เดียว คำสั่งใดพัง rollback ทั้งหมด และ error ระบุลำดับคำสั่ง (`dynamicsql/gateway.go:197-228`) |
| `/process/*` | tx ฝั่ง Go ตามข้างบน |

## ข้อควรระวัง
- **timeout 60 วินาทีรวมทั้งก้อน** (บันทึกเอกสารที่มีสินค้าเยอะหรือสต็อกต้อง rebuild มาก) เมื่อเกิน ผู้ใช้จะได้ error และไม่มีอะไรถูกบันทึก อย่าเข้าใจผิดว่าบันทึกไปครึ่งหนึ่ง กดซ้ำได้ (ล็อกเอกสารกันเลขซ้ำ) เพียงแต่ต้องแก้เหตุที่ช้าก่อน; นอกจากนี้ router มี timeout 60 วินาทีเช่นกัน (`router.go:64`)
- **ข้อมูลเก่าที่ "ครึ่ง ๆ" มาจากไหน:** ประวัติโปรเจกต์มีบั๊กที่ทิ้ง error ของคำสั่งเขียน (`_, _ = Exec`) แล้วตอบสำเร็จ และ frontend เคยเขียน SQL ตรงเข้าตารางนอก tx ของเอกสาร ([[hist-lessons-atomic-transactions-swallowed-errors]]) ตอนนี้งานเอกสารย้ายเข้า tx แล้ว แต่ข้อมูลที่เกิดก่อนแก้ยังค้างอยู่ได้ ให้ใช้รีบิวด์ (สต็อก/GL) ซ่อมจากแถวเอกสารดิบ
- **ยังเหลือ `_, _ = ExecBatch(...)` ที่ทิ้งผลในโมดูล WMS** (`adapter/inbound/http/wms/handler.go:840` ใน `buildOverview` ที่ rebuild ยอด bin ก่อนสรุปหน้าภาพรวม และ `:1737` ใน `ensureWmsSeeded` ที่ตั้ง `seedDone` ต่อให้ rebuild พัง) ไม่ใช่เส้นทางบัญชีหลัก แต่ถ้ายอด bin ใน WMS ไม่ตรงโดยไม่มี error ให้ดูจุดนี้ก่อน
- ยอดสต็อกและ GL เป็น **ค่าที่คำนวณซ้ำได้จากแถวเอกสาร** ถ้าสงสัยว่าไม่ตรง ให้ rebuild มากกว่าไล่แก้ยอดมือ
- ถ้าผู้ใช้เห็น error แล้วกดบันทึกซ้ำจนสำเร็จ เป็นพฤติกรรมปกติของ rollback ไม่ใช่เอกสารซ้ำ เว้นแต่ error เกิด **หลัง** commit (เช่น เครือข่ายขาดระหว่างตอบกลับ) ให้ค้นเลขเอกสารก่อนบันทึกใหม่

## ดูเพิ่ม
- [[faq-concurrent-save-deadlock]]
- [[faq-gl-rebuild-when]]
- [[faq-stock-rebuild]]
- [[faq-cancel-vs-edit-vs-delete]]
- [[faq-payment-tab-tenders]]
- [[acc-transaction-save-flow]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:267` `SaveTrans` (เตรียมข้อมูลก่อน tx) / `:301` `checkAndSaveTransTx` / `:510` `saveTransTx`
- `backend/internal/application/process/trans.go:446` `inTransTx` (timeout 60 วินาที, begin, defer rollback, commit)
- `backend/internal/application/process/trans.go:593` `rebuildTransDerived` (สต็อก, GL, เช็ค ใน tx เดียว)
- `backend/internal/application/process/trans.go:382` `DeleteTrans` / `:395` `deleteTransTx`
- `backend/internal/application/process/doc_cancel.go:120` `CancelDoc` ใช้ `inTransTx`
- `backend/internal/application/process/master_detail.go:152` tx + timeout 30 วินาทีของ master-detail
- `backend/internal/adapter/outbound/dynamicsql/gateway.go:197` `ExecBatch` (begin :205, commit :228)
- `backend/internal/adapter/inbound/http/router.go:64` timeout 60 วินาทีระดับ router
