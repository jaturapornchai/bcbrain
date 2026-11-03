---
title: "ยอดลูกหนี้/เจ้าหนี้คงค้างดูได้ที่ไหน ระบบคิดจากอะไร"
tags: [faq, ar, ap, balance, report]
aliases: ["ยอดลูกหนี้คงเหลือ", "ยอดเจ้าหนี้คงเหลือ", "AR balance", "AP balance", "รายงานสถานะลูกหนี้", "รายงานอายุลูกหนี้", "aparStatMoves", "debt_balance", "หนี้ค้างชำระ"]
sources: ["backend/internal/application/process/report_menu_ap_ar.go:384", "backend/internal/application/process/report_menu_ap_ar.go:398", "backend/internal/application/process/report_menu_ap_ar.go:409", "backend/internal/application/process/report_menu_ap_ar.go:586", "backend/internal/application/process/ap_outstanding.go:3", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/docs.go:628", "frontend/src/config/bcMenu.json:7419"]
---
# ยอดลูกหนี้/เจ้าหนี้คงค้างดูได้ที่ไหน ระบบคิดจากอะไร

**ตอบสั้น:** ระบบไม่ได้เก็บยอดหนี้คงค้างไว้เป็นตัวเลขสำเร็จ ทุกรายงานคำนวณใหม่จากเอกสารที่ยังไม่ถูกยกเลิก (`last_status` = 0) คือ ตั้งหนี้ + เพิ่มหนี้ − ลดหนี้ − รับ/จ่ายชำระ ดูได้จาก "รายงานสถานะลูกหนี้" / "รายงานสถานะเจ้าหนี้" (ยอดต่อราย), "รายงานอายุลูกหนี้/เจ้าหนี้" (แยกตามอายุหนี้) และ "รายงานเคลื่อนไหวลูกหนี้/เจ้าหนี้"

## รายละเอียด
**สูตรของรายงานสถานะ** (`aparStatMoves`) แบ่งเป็น 4 กลุ่ม
1. ตั้งหนี้ (`total_amount`)
2. เพิ่มหนี้ (`total_amount`)
3. ลดหนี้ (ติดลบ)
4. ชำระ (ติดลบ) จากใบรับชำระหนี้ 239 (ลูกหนี้) / ใบจ่ายชำระหนี้ 19 (เจ้าหนี้) ใช้ `total_net_value` ใน `ap_ar_trans`

**ลูกหนี้ (AR)**
- ตั้งหนี้: ขาย 44, รายได้อื่นๆ 250, คืนเช็ค/ตั้งหนี้ใหม่ 418 (ทั้งสามนับเมื่อ `inquiry_type` 0/2), ยกมา 93, ตั้งหนี้อื่นๆ 99
- เพิ่มหนี้: เพิ่มหนี้ขาย 46, เพิ่มหนี้ยกมา 95, เพิ่มหนี้อื่นๆ 101
- ลดหนี้: รับคืน/ลดหนี้ขาย 48 (`inquiry_type` 0/2/4), ลดหนี้ยกมา 97, ลดหนี้อื่นๆ 103, ลดหนี้รายได้อื่นๆ 252

**เจ้าหนี้ (AP)**
- ตั้งหนี้: ซื้อ 12, ตั้งหนี้จากใบรับสินค้า 315, ค่าใช้จ่ายอื่นๆ 260 (`inquiry_type` 0/2), จ่ายเงินมัดจำ 11 (`inquiry_type` 1), ยกมา 81, ตั้งหนี้อื่นๆ 87
- เพิ่มหนี้: 316, เพิ่มหนี้ซื้อ 14, เพิ่มหนี้ยกมา 83, เพิ่มหนี้อื่นๆ 89, เพิ่มหนี้ค่าใช้จ่ายอื่นๆ 264 (`inquiry_type` 0/2)
- ลดหนี้: ส่งคืน/ลดหนี้ซื้อ 16 และ 317 (`inquiry_type` 0/1), ลดหนี้ยกมา 85, ลดหนี้อื่นๆ 91, ลดหนี้ค่าใช้จ่ายอื่นๆ 262 (สามตัวนี้นับเมื่อ `inquiry_type` 0/2)

ตัวเลข flag ที่ยกมาเป็นของรายงานสถานะ ส่วนตอนเลือกบิลค้างชำระในใบรับชำระ/จ่ายชำระและใบวางบิล ระบบใช้ชุดเงื่อนไขของตัวเอง (`arDebtWhere` / `apDebtWhere` ใน `docs.go`) ซึ่งรวม 254 และการขายสินทรัพย์เชื่อ 1802 ด้วย

**จุดอื่นที่แสดงยอด**
- ช่อง "หนี้ค้าง" (`debt_balance`) ในหน้าค้นหาผู้จำหน่าย คำนวณสดจากสูตรเดียวกับรายงานสถานะเจ้าหนี้ ไม่มีการจำกัดวันที่
- การตรวจวงเงินเครดิตตอนบันทึกขาย ใช้ยอดลูกหนี้ตามสูตรสถานะ บวกเช็ครับในมือ หักเงินมัดจำ/ล่วงหน้าที่ยังไม่ใช้ (ดู [[faq-credit-limit-approval]])
- "รายงานตรวจสอบยอดวงเงิน" (`menu_ar_report_check_balance`) ใช้เทียบยอดหนี้กับวงเงินของลูกค้า

## ข้อควรระวัง
- รายงานสถานะลูกหนี้ไม่นับ 254 (รายได้อื่น เพิ่มหนี้) เป็นเพิ่มหนี้ แต่รายงานเคลื่อนไหวและหน้าจอเลือกบิลนับ 254 ยอดจากสองที่จึงอาจต่างกัน
- ช่อง `chq_balance` / `bill_balance` ของผู้จำหน่ายเป็นค่าที่เก็บไว้ในตาราง ไม่ได้คำนวณใหม่ ค่าอาจเก่า
- ยอดยกมาลูกหนี้/เจ้าหนี้ (93/81 ฯลฯ) อยู่ในยอดหนี้ แต่ไม่มี GL (ดู [[faq-ap-ar-opening-balance]])

## ดูเพิ่ม
- [[term-ap-ar-balance]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[faq-billing-ar-ap]]
- [[faq-balance-mismatch-troubleshoot]]
- [[faq-run-report-conditions]]

## ที่มาในโค้ด
- `backend/internal/application/process/report_menu_ap_ar.go:384` `aparStatFlags` ชุด flag ตั้งหนี้/เพิ่มหนี้/ลดหนี้ (AR ไม่นับ 254)
- `backend/internal/application/process/report_menu_ap_ar.go:398` `aparStatMoves` สูตร 4 กลุ่ม และใบชำระ 19/239
- `backend/internal/application/process/report_menu_ap_ar.go:409` `aparStatusReport` รายงานสถานะ
- `backend/internal/application/process/report_menu_ap_ar.go:586` `aparAgingReport` รายงานอายุหนี้
- `backend/internal/application/process/ap_outstanding.go:3` `debt_balance` ของผู้จำหน่ายคำนวณสดจากเอกสาร
- `backend/internal/application/process/docs.go:600` `arDebtWhere` / `apDebtWhere` ของการเลือกบิลค้าง
- `backend/internal/application/process/docs.go:628` `OutstandingBills`
- `frontend/src/config/bcMenu.json:7419` เมนู `menu_ar_report_status_ar` "รายงานสถานะลูกหนี้"
