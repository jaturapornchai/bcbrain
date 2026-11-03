---
title: "โอนสินค้าระหว่างคลัง/ที่เก็บ (72/70) ทำงานยังไง ต้นทุนเปลี่ยนไหม"
tags: [faq, ic, stock, transfer, warehouse]
aliases: ["โอนสินค้าข้ามคลัง", "โอนย้ายคลัง", "stock transfer", "trans_flag 72", "trans_flag 70", "menu_ic_transfer_wh_out", "ใบขอโอน 124", "ป้อนข้อมูลคลังสินค้าไม่ครบ"]
sources: ["frontend/account/tabs/transMenuMap.ts:1073", "backend/internal/application/process/trans.go:1120", "backend/internal/application/process/stock_rebuild.go:47", "backend/internal/application/process/service.go:233", "backend/internal/application/process/trans_lines_check.go:242", "backend/internal/application/process/trans_save_rules.go:283", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/doc_cancel.go:49"]
---
# โอนสินค้าระหว่างคลัง/ที่เก็บ (72/70) ทำงานยังไง ต้นทุนเปลี่ยนไหม

**ตอบสั้น:** ใช้เมนู "โอนสินค้า/วัตถุดิบ" (`menu_ic_transfer_wh_out`, `trans_flag` 72) บันทึกครั้งเดียว ระบบสร้างบรรทัดโอนออก 72 จากคลังต้นทาง และบรรทัดรับโอน 70 เข้าคลังปลายทางให้เอง ยอดรวมและต้นทุนเฉลี่ยของสินค้าไม่เปลี่ยน เพราะ 70 รับมูลค่าเท่ากับที่ 72 ตัดออกไป (จำนวน × ต้นทุนเฉลี่ย)

## รายละเอียด
**การบันทึก**
- แต่ละบรรทัดของหน้าจอจะกลายเป็น 2 แถวใน `ic_trans_detail` คือแถว 72 (`calc_flag` -1, คลัง/ที่เก็บต้นทาง) และแถว 70 (`calc_flag` +1, คลัง/ที่เก็บปลายทาง)
- เวลาของแถว 70 คือเวลาของ 72 บวก 1 นาที เพื่อให้ระบบตัดต้นทุนฝั่งโอนออกก่อน ถ้าเวลาเป็น 23:59 จะคงเวลาเดิม แล้วใช้กฎ "70 อยู่ท้ายสุด" ในการเรียงแทน
- เลข LOT และ serial ถูกเขียนให้ทั้งสองฝั่ง
- ต้องมีคลังและที่เก็บครบทั้งต้นทางและปลายทาง (บรรทัดหรือหัวเอกสาร) ถ้าไม่ครบจะขึ้นข้อความ "ป้อนข้อมูลคลังสินค้าไม่ครบ" / "ป้อนข้อมูลที่เก็บสินค้าไม่ครบ"
- ดึงรายการจากใบขอโอน 124 ได้ (`transFlags` [72, 124]) ดู [[faq-doc-ref-import]]

**ต้นทุน** (ดู [[faq-moving-average-cost]])
- แถว 72 คิดมูลค่าเป็นจำนวนฐาน × ต้นทุนเฉลี่ย ณ ขณะนั้น และแถว 70 ใช้มูลค่าเดียวกันตามลำดับบรรทัด
- จำนวนและมูลค่ารวมของสินค้าไม่เปลี่ยน แต่ยอดต่อคลังและต่อที่เก็บเปลี่ยน
- ถ้าบรรทัด 70 ล็อกต้นทุน (`sum_of_cost_fix`) ผลต่างจะถูกบวกเข้ามูลค่าสต็อก และต้นทุนเฉลี่ยจะเปลี่ยน

**ห้ามติดลบ:** โอนย้ายตรวจยอดคงเหลือเฉพาะเมื่อเปิด `erp_option.transfer_stock_control` (และสวิตช์หลักของการตรวจสต็อก) ดู [[faq-negative-stock]]

**GL:** 72 อยู่ในกลุ่มที่ลง GL เฉพาะเมื่อรหัสเอกสารมีรูปแบบ GL กำหนดไว้ ถ้าไม่ได้ตั้งไว้จะไม่มีรายการบัญชี (ดู [[faq-gl-template-doc-format]])

**ยกเลิก:** ใช้เอกสารยกเลิก 73 ซึ่งยกเลิกได้ทั้ง 70 และ 72 (ดู [[faq-cancel-vs-edit-vs-delete]])

## ข้อควรระวัง
- ไม่พบการตรวจว่าคลังและที่เก็บต้นทางกับปลายทางต้องต่างกัน (ค้นใน `trans*.go` แล้วไม่พบ) จึงอาจบันทึกโอนเข้าที่เดิมได้
- เมื่อรัน "คำนวณยอดสต๊อกใหม่" ขั้นแรกจะสร้างหรือซิงก์แถว 70 ของใบ 72 เก่าที่ขาดอยู่ ยอดต่อคลังจึงอาจเปลี่ยนหลังรัน (ดู [[faq-stock-rebuild]])

## ดูเพิ่ม
- [[doc-stock-transfer]]
- [[doc-transfer-request]]
- [[term-wh-shelf]]
- [[faq-wh-shelf-permission]]
- [[acc-stock-special-docs]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1073` เมนู `menu_ic_transfer_wh_out` flag 72 ดึงจาก 124
- `backend/internal/application/process/trans.go:1120` สร้างคู่แถว 72 (-1) / 70 (+1)
- `backend/internal/application/process/stock_rebuild.go:47` `transferInTime` เวลา 70 = 72 + 1 นาที
- `backend/internal/application/process/service.go:233` ต้นทุน 72/70 ไม่เปลี่ยนมูลค่ารวม
- `backend/internal/application/process/trans_lines_check.go:242` `checkWh` ต้องมีคลัง/ที่เก็บครบ
- `backend/internal/application/process/trans_save_rules.go:283` ไม่ตรวจยอดโอนถ้าไม่ได้เปิด `transfer_stock_control`
- `backend/internal/application/process/gl_template.go:1096` `glTemplateOnlyFlags` {72, 418}
- `backend/internal/application/process/doc_cancel.go:49` `cancelOrigFlags` 73 ยกเลิก 70/72
