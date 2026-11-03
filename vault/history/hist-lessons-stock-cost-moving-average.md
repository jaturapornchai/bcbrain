---
title: "บทเรียนสต็อกและต้นทุนถัวเฉลี่ย (Stock & Moving Average Cost)"
tags: [history, lesson, stock, cost, inventory]
aliases: ["ต้นทุนเฉลี่ยเพี้ยน", "moving average", "CalculateMovingAverage", "รับคืนขาย 48", "โอนคลัง 72 70", "ล็อกต้นทุน sum_of_cost_fix", "ต้นทุนแฝง flag 66"]
sources: ["backend/internal/application/process/service.go:189", "backend/internal/application/process/service.go:228", "backend/internal/application/process/service.go:268", "backend/internal/application/process/service.go:1001", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/stock_rebuild.go:47", "backend/internal/application/process/stock_rebuild_test.go:5", "backend/internal/application/process/stock_rebuild_test.go:17", "backend/internal/application/process/stock_rebuild_test.go:33", "backend/internal/application/process/stock_rebuild_test.go:117", "backend/internal/application/process/cost_lock_test.go:6", "backend/internal/application/process/cost_lock_test.go:47", "backend/internal/application/process/uat_s1_fixes_test.go:86", "backend/internal/application/process/uat_s1_fixes_test.go:111", "backend/internal/application/process/hidden_cost.go:125", "backend/internal/application/process/hidden_cost_test.go:13", "backend/internal/application/process/trans_validate.go:112", "backend/internal/application/process/trans_save_rules.go:389", "backend/internal/application/process/trans_set_item.go:22", "AGENTS.md:50"]
---

# บทเรียนสต็อกและต้นทุนถัวเฉลี่ย

ต้นทุนเฉลี่ยของสินค้าคำนวณซ้ำจากแถว `ic_trans_detail` ทีละแถวตามลำดับเวลา ถ้านับแถวผิดชุด ใช้ราคาขายเป็นมูลค่ารับเข้า หรือปล่อยให้สองเอกสารแก้ต้นทุนสินค้าเดียวกันพร้อมกัน ต้นทุนเฉลี่ย กำไรขั้นต้น และมูลค่าสินค้าคงเหลือใน GL จะเพี้ยนต่อเนื่องทุกเอกสารหลังจากนั้น

## อะไรพังได้
- **รับคืนขาย (48) เข้าสต็อกที่ราคาขาย**: กำไรจากการขายถูกรวมเข้าต้นทุนเฉลี่ย ต้นทุนสินค้าสูงเกินจริงหลังรับคืน
- **นับแถวผิดชุด**: แถวสำเนาเอกสาร (`is_doc_copy`), แถวที่ยกเลิก, แถวชุดสินค้า (`item_type` 3/5) ที่ไม่ได้ถือสต็อกจริง ถูกนับรวมในยอดและต้นทุน
- **ใบเพิ่ม/ลดหนี้ราคา (14/16/311)** เปลี่ยนมูลค่าแต่ไม่เปลี่ยนจำนวน ถ้าถูกนับเป็นจำนวนด้วยยอดคงเหลือจะเพี้ยน
- **โอนคลัง 72/70**: การโอนไม่ควรเปลี่ยนจำนวนหรือมูลค่ารวมของสินค้า แต่ถ้าคิดฝั่งรับ (70) ก่อนฝั่งส่ง (72) หรือเอาต้นทุนที่ติดมาตอนบันทึกไปใช้ ต้นทุนเฉลี่ยจะรั่ว
- **ต้นทุนที่ผู้ใช้ล็อก** (`sum_of_cost_fix`) ถูกคำนวณทับ หรือกลับกัน ค่า fix ที่ไม่ได้ล็อกถูกใช้
- **ต้นทุนแฝงกระจายแล้วผลรวมไม่เท่ายอด** เพราะปัดแต่ละแถวแยกกัน
- **ปรับเพิ่ม (66) ที่นับสต็อกเข้าที่ราคาของแถว** แทนต้นทุนเฉลี่ยปัจจุบัน
- **ตรวจยอดคงเหลือจากตัวนับ** `ic_inventory` ที่อาจเก่ากว่าแถวดิบ
- **บันทึก/ประมวลผลสต็อกสินค้าเดียวกันพร้อมกัน** ล็อกสลับลำดับกัน เกิด deadlock (40P01)

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| เล่นซ้ำจากแถวดิบด้วยเลขแม่นยำ | `backend/internal/application/process/service.go:189` `CalculateMovingAverage` | วนแถวตามลำดับด้วย `big.Rat` ปัดครึ่งขึ้นที่ทศนิยมราคา/จำนวนเงินของบริษัท คืนจำนวนและต้นทุนเฉลี่ยท้ายสุด |
| เลือกแถวที่นับ | `backend/internal/application/process/stock_rebuild.go:18` `stockRowsSQL` | เฉพาะ `last_status = 0`, ไม่ใช่สำเนา, `item_type` 0/4/6 (ตัดชุดสินค้า 3/5 ที่ `trans_set_item.go:22` `isSetItem` เพราะมีแต่แถวลูกถือสต็อก), รายการ flag ที่เคลื่อนไหวสต็อก และตัด 46/48/44 บางกรณี |
| บรรทัดมูลค่าอย่างเดียว | `stock_rebuild.go:26` `stockValueOnlySQL` | 14/16/311 ที่ `inquiry_type` 1 หรือ 3 เปลี่ยนมูลค่าแต่ไม่นับจำนวน; เทส `stock_rebuild_test.go:33` |
| รับเข้าที่ไม่ใช่ซื้อเข้าที่ต้นทุนเฉลี่ย | `backend/internal/application/process/service.go:268-278` | 48 (รับคืนขาย) และ 58/60 ที่ไม่มีต้นทุนต่อหน่วยใช้ `จำนวน x ต้นทุนเฉลี่ยปัจจุบัน`; 66 ที่นับจำนวนเข้าที่ต้นทุนเฉลี่ยเว้น `inquiry_type` 1; เทส `uat_s1_fixes_test.go:86` และ `:111` (เฉลี่ยคงที่ 282.31 หลังรับคืน), `cost_lock_test.go:47` |
| 66 ติดลบคือการเบิกออก | `backend/internal/application/process/service.go:228` | แถว 66 ที่จำนวนติดลบถูกนับเป็นออกที่ต้นทุนเฉลี่ย; เทส `stock_rebuild_test.go:5` |
| ล็อกต้นทุน | `backend/internal/application/process/service.go:220-226`; เทส `cost_lock_test.go:6` | เฉพาะแถวที่ `is_lock_cost` เปิดจึงใช้ `sum_of_cost_fix` ทั้งเข้าและออก ค่า fix ที่ไม่ล็อกถูกเมิน |
| โอนคลังไม่เปลี่ยนมูลค่ารวม | `backend/internal/application/process/service.go:233-258`; `stock_rebuild.go:47` `transferInTime`; เทส `stock_rebuild_test.go:17`, `:47`, `:117` | 72 ตีมูลค่า = จำนวน x เฉลี่ย แล้วส่งต้นทุนนั้นให้ 70; เวลา 70 = เวลา 72 + 1 นาที (ไม่ล้นข้ามวัน); ต้นทุนเก่าที่ค้างบนแถว 70 ไม่รั่วเข้าค่าเฉลี่ย |
| แบ่งต้นทุนแฝงให้ผลรวมเท่ายอด | `backend/internal/application/process/hidden_cost.go:125` `allocateHiddenCost` | แบ่งตามน้ำหนักปัดครึ่งขึ้น แล้วเศษที่เหลือไปลงแถวแรกที่น้ำหนักมากสุด; เทส `hidden_cost_test.go:13` ตรวจว่าผลรวมเท่ายอดทุกกรณี (รวม 0.1+0.2) |
| ใบปรับต้นทุนแฝงถูกล็อกแก้ | `backend/internal/application/process/trans_validate.go:112` `refuseLockedRecord` | เอกสาร flag 66 ที่สร้างจากเมนูประมวลผลเฉลี่ยต้นทุนแฝงมี `is_lock_record = 1` แก้/ลบจากหน้าจอไม่ได้ ต้องไปที่เมนูต้นทาง |
| ยอดคงเหลือจากแถวดิบ | `backend/internal/application/process/trans_save_rules.go:389` `checkStockBalance` | รวมจาก `ic_trans_detail` ด้วย `stockBalancePredicate` ไม่อ่านตัวนับ `ic_inventory` |
| ล็อกตามรหัสสินค้า | `backend/internal/application/process/service.go:1001-1015` `lockStockItems` | บันทึก/ลบ/ประมวลผลล็อกเรียงตามรหัสสินค้าก่อนแก้แถว ป้องกัน deadlock |

## กฎที่ต้องจำ
- ต้นทุนและยอดคงเหลือเป็นผลคำนวณซ้ำได้จากแถวดิบ (`AGENTS.md:50`) ห้ามบวกลดตัวนับตรง ๆ
- เอกสารรับเข้าที่ไม่ใช่ซื้อ (รับคืนขาย รับคืนจากเบิก รับผลผลิต) ต้องเข้าที่ต้นทุนเฉลี่ยเมื่อไม่มีต้นทุนจริง ห้ามใช้ราคาขาย
- เพิ่ม flag ที่เคลื่อนไหวสต็อก = ต้องแก้ `stockRowsSQL` และ `CalculateMovingAverage` พร้อมกัน และเขียนเทสด้วยเลขจริง (ค่าเฉลี่ยต้องคงเดิมหลังรับคืน)
- ลำดับเวลามีผล: ฝั่งส่งโอน (72) ต้องมาก่อนฝั่งรับ (70) เสมอ
- งานที่แก้ `ic_trans_detail` ของสินค้าเดียวกันต้องผ่าน `lockStockItems` ในลำดับรหัสเดียวกัน

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:189-335` เล่นซ้ำต้นทุนเฉลี่ย
- `backend/internal/application/process/stock_rebuild.go:18-50` ตัวกรองแถวและเวลาโอนเข้า
- `backend/internal/application/process/hidden_cost.go:125-146` แบ่งต้นทุนแฝง
- ดูเพิ่ม: [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-trans-save-rules]] · [[hist-lessons-gl-posting-balance]] · [[hist-lessons-rounding-decimal]] · [[history-overview]]
