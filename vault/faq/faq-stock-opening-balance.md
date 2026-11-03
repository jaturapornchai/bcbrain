---
title: "บันทึกสินค้ายกมา (ยอดยกมาสต็อก) ยังไง และลงบัญชีอะไร"
tags: [faq, ic, stock, opening-balance, gl]
aliases: ["สินค้ายกมา", "ยอดยกมาสินค้า", "stock opening balance", "trans_flag 54", "menu_ic_stk_balance", "StockBeginningSave", "สินค้า/วัตถุดิบ คงเหลือยกมา", "Dr สินค้าคงเหลือ Cr ทุน"]
sources: ["frontend/account/tabs/transMenuMap.ts:924", "backend/internal/application/process/stock_beginning.go:23", "backend/internal/application/process/stock_beginning.go:40", "backend/internal/application/process/stock_beginning.go:292", "backend/internal/application/process/stock_beginning.go:307", "backend/internal/application/process/stock_beginning.go:619", "frontend/account/transaction/StockBeginningBalanceScreen.tsx:375-399", "backend/internal/application/process/service.go:1677"]
---
# บันทึกสินค้ายกมา (ยอดยกมาสต็อก) ยังไง และลงบัญชีอะไร

**ตอบสั้น:** ใช้จอ "สินค้า/วัตถุดิบ คงเหลือยกมา" (`menu_ic_stk_balance`, `trans_flag` 54) กรอกสินค้า คลัง ที่เก็บ จำนวน และราคาทุนต่อหน่วย ระบบคิดมูลค่าแต่ละบรรทัดเป็น `qty × price` และใช้มูลค่านี้เป็นต้นทุนตั้งต้นของการคำนวณถัวเฉลี่ย ส่วน GL มาจากแท็บ "GL" ของจอนี้เอง ค่าตั้งต้นของแท็บคือ Dr สินค้าคงเหลือ `1131-00` / Cr `3110-00`

## รายละเอียด
**ฝั่งสต็อก**
- จอนี้บันทึกผ่าน `StockBeginningSave` ซึ่งเป็นเส้นทางเฉพาะ ไม่ได้ใช้จอเอกสารทั่วไป และรับได้สูงสุด 5,000 บรรทัด และ 20,000 serial ต่อเอกสาร
- มูลค่าบรรทัด = จำนวน × ราคา ปัดแบบ HALF_UP 2 ตำแหน่ง ระบบคำนวณเองที่ฝั่ง server ไม่ได้ใช้ค่าที่ส่งมาจากหน้าจอ
- ถ้าไม่ได้ระบุสาขา ระบบใส่ `00000`
- หลังบันทึก ระบบคำนวณสต็อกและต้นทุนของสินค้าในเอกสารใหม่ และบันทึกตาราง lot (`ic_trans_detail_lot`) และ serial ให้ด้วย
- 54 เป็นรายการรับเข้าแบบปกติ จึงเริ่มต้นทุนถัวเฉลี่ยได้ (ดู [[faq-moving-average-cost]])

**ฝั่งบัญชี (แท็บ GL)**
- ถ้าไม่ได้ติ๊ก "ลงบัญชีโดยตรง" หน้าจอจะสร้าง 2 บรรทัดให้อัตโนมัติ คือ Dr `1131-00` สินค้าคงเหลือสำเร็จรูป / Cr `3110-00` ด้วยยอดรวมของเอกสาร
- ถ้าติ๊ก "ลงบัญชีโดยตรง" ผู้ใช้แก้บรรทัด GL เองได้ ระบบบันทึก `gl_journal.trans_direct` = 1
- server ตรวจว่ายอดเดบิตต้องเท่ากับเครดิต (เทียบที่ 2 ตำแหน่ง) ถ้าไม่เท่าจะไม่บันทึก
- สมุดรายวันตั้งต้น `01` ส่วนงวดและปีบัญชีมาจากวันที่เอกสาร ปีเก็บเป็น ค.ศ.

ยอดยกมาของลูกหนี้และเจ้าหนี้แยกเป็นอีกเรื่อง ดู [[faq-ap-ar-opening-balance]]

## ข้อควรระวัง
- `StockBeginningSave` ไม่เรียก `checkOpenPeriod` จึงบันทึกยอดยกมาลงงวดที่ปิดแล้วได้ (ดู [[faq-period-closed-cannot-save]])
- ชื่อบัญชีฝั่งเครดิตที่หน้าจอตั้งไว้คือ "ทุนเรือนหุ้นสามัญ" (`3110-00`) ถ้าบริษัทใช้บัญชีพักยอดยกมาหรือกำไรสะสม ต้องติ๊กลงบัญชีโดยตรงแล้วแก้เอง
- เมื่อรัน "ประมวลผล GL ใหม่" GL ของ 54 จะไม่ถูกลบหรือสร้างใหม่ แต่ถ้ารหัสบัญชีในบรรทัด GL ของ 54 ไม่มีในผังบัญชี ระบบจะเปลี่ยนเป็นรหัสสินค้าคงเหลือ (1131/1130/1140) สำหรับฝั่งเดบิต และรหัสทุน (3110/3100/3210) สำหรับฝั่งเครดิต โดยไม่แจ้งเตือน

## ดูเพิ่ม
- [[doc-stock-beginning-balance]]
- [[scr-stock-beginning-balance]]
- [[faq-ap-ar-opening-balance]]
- [[faq-new-company-setup]]
- [[faq-gl-rebuild-when]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:924` เมนู `menu_ic_stk_balance` flag 54
- `backend/internal/application/process/stock_beginning.go:23` ค่าคงที่ flag 54, จำนวนบรรทัดสูงสุด, สาขา `00000`
- `backend/internal/application/process/stock_beginning.go:40` มูลค่า = qty × price ปัด HALF_UP 2 ตำแหน่ง
- `backend/internal/application/process/stock_beginning.go:292` ตรวจเดบิตเท่ากับเครดิตในแท็บ GL
- `backend/internal/application/process/stock_beginning.go:307` `StockBeginningSave` (ไม่มีการตรวจงวด)
- `backend/internal/application/process/stock_beginning.go:619` บันทึก `trans_direct` ตามตัวเลือกลงบัญชีโดยตรง
- `frontend/account/transaction/StockBeginningBalanceScreen.tsx:375-399` สร้าง GL อัตโนมัติ Dr `1131-00` / Cr `3110-00`
- `backend/internal/application/process/service.go:1677` เปลี่ยนรหัสบัญชี GL ของ 54 ที่ไม่มีในผังบัญชี
