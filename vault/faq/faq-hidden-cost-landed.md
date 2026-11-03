---
title: "ค่าขนส่ง ค่าอากรขาเข้า (ต้นทุนแฝง / Landed Cost) เข้าต้นทุนสินค้ายังไง"
tags: [faq, ic, stock, cost, hidden-cost, landed-cost]
aliases: ["ต้นทุนแฝง", "landed cost", "ต้นทุนนำเข้า", "ปันส่วนค่าขนส่งเข้าต้นทุน", "menu_ic_hidden_cost_process", "ic_hidden_cost_process", "HiddenCostSave", "เมนู 2.22", "AFC"]
sources: ["backend/internal/application/process/hidden_cost.go:15", "backend/internal/application/process/hidden_cost.go:31", "backend/internal/application/process/hidden_cost.go:125", "backend/internal/application/process/hidden_cost.go:190", "backend/internal/application/process/hidden_cost.go:443", "backend/internal/application/process/hidden_cost.go:591", "backend/internal/application/process/service.go:297", "frontend/account/master/HiddenCostScreen.tsx:106"]
---
# ค่าขนส่ง ค่าอากรขาเข้า (ต้นทุนแฝง / Landed Cost) เข้าต้นทุนสินค้ายังไง

**ตอบสั้น:** ใช้จอ "ประมวลผลเฉลี่ยต้นทุนแฝง" (เมนู 2.22) เลือกเอกสารค่าใช้จ่าย (ตั้งหนี้อื่นๆ 87 / ค่าใช้จ่ายอื่นๆ 260) หรือกรอกค่าขนส่ง ประกันภัย อากร และพิธีการศุลกากรโดยตรง แล้วเลือกเอกสารซื้อที่จะรับต้นทุน (ซื้อ 12, รับสินค้า 310, รับสินค้าสำเร็จรูป 60) ระบบปันส่วนยอดลงแต่ละบรรทัดสินค้า แล้วสร้างเอกสารปรับปรุงเพิ่ม 66 แบบเพิ่มเฉพาะมูลค่า (จำนวน 0) เพื่อเพิ่มมูลค่าเข้าต้นทุนถัวเฉลี่ย

## รายละเอียด
**วิธีปันส่วน**
- ฐานของยอดค่าใช้จ่าย (`calFrom`): 0 = มูลค่าสุทธิของเอกสารค่าใช้จ่าย, 1 = มูลค่าก่อนภาษี
- เกณฑ์ปันส่วน (`calFollow`): 0 = ตามมูลค่าสินค้า, 1 = ตามจำนวนหน่วยหลัก, 2 = ตามจำนวนหน่วยขนานหรือน้ำหนัก (ถ้าไม่มีจะใช้จำนวนหลัก), 3 = เท่ากันทุกบรรทัด
- ค่าที่กรอกโดยตรง (ค่าขนส่ง ประกันภัย อากรขาเข้า ค่าชิปปิ้ง/ท่าเรือ) ห้ามติดลบ และถูกบวกเข้ายอดที่จะปันส่วนเต็มจำนวนไม่ว่าเลือก `calFrom` แบบไหน
- ส่วนแบ่งต่อบรรทัด = ยอดรวม × น้ำหนัก ÷ ผลรวมน้ำหนัก ปัดแบบ HALF_UP 2 ตำแหน่ง เศษจากการปัดไปลงบรรทัดแรกที่มีน้ำหนักสูงสุด ผลรวมจึงเท่ากับยอดรวมพอดี
- ต่อบรรทัดยังคำนวณ % ปันส่วน (HALF_UP 2 ตำแหน่ง), ต้นทุนรวมสุทธิ = มูลค่าเดิม + ส่วนแบ่ง (HALF_UP 2 ตำแหน่ง) และต้นทุนใหม่ต่อหน่วย = ต้นทุนรวม ÷ จำนวน (HALF_UP 4 ตำแหน่ง) เพื่อแสดงและเก็บใน `ic_hidden_cost_process_item` แต่ค่าที่เข้าสต็อกจริงคือส่วนแบ่งในใบ 66 เท่านั้น
- ต้องเลือกเอกสารซื้ออย่างน้อย 1 ใบ และมีเอกสารค่าใช้จ่ายหรือค่าที่กรอกโดยตรงอย่างน้อย 1 รายการ เลือกเอกสารอ้างอิงได้สูงสุด 200 ใบ

**สิ่งที่บันทึก**
- หัวเอกสารต้นทุนแฝงลง `ic_hidden_cost_process` เลขที่ขึ้นต้น AFC
- เอกสารปรับปรุงเพิ่ม 66 (เลขที่ IA) ที่ `doc_ref` = เลข AFC แต่ละบรรทัดมี `qty` 0 และ `sum_amount` เท่ากับส่วนแบ่ง และตั้ง `is_lock_record` = 1
- ตอนคำนวณสต็อกใหม่ บรรทัดที่จำนวนเป็น 0 จะเพิ่มเฉพาะมูลค่า แล้วคำนวณต้นทุนเฉลี่ยใหม่ (ดู [[faq-moving-average-cost]])
- ลบเอกสารต้นทุนแฝงผ่าน `HiddenCostDelete` ซึ่งลบเอกสาร 66 ที่ผูกอยู่ด้วย

**GL:** เอกสาร 66 ลง GL ตามมาตรฐานของเอกสารสต็อก คือ Dr สินค้าคงเหลือ / Cr 5110 ถ้ารหัสเอกสาร IA มีรูปแบบ GL ระบบจะใช้รูปแบบนั้นแทน ส่วนเอกสาร 87/260 มี GL ของตัวเองแยกต่างหาก (ดู [[faq-other-income-expense-gl]])

## ข้อควรระวัง
- มูลค่าเข้าในวันที่ของเอกสารต้นทุนแฝง ไม่ใช่วันที่ของเอกสารซื้อ สินค้าที่ขายไปก่อนวันนั้นจะไม่ได้รับส่วนแบ่ง และถ้าวันนั้นสินค้าหมดหรือติดลบแล้ว มูลค่าที่เพิ่มจะหายไปเมื่อมีรายการรับเข้าครั้งถัดไป เพราะระบบเริ่มนับใหม่ แต่ GL ของ 66 ยังเดบิตสินค้าคงเหลืออยู่
- GL มาตรฐานเครดิตต้นทุนขาย 5110 ไม่ได้เครดิตบัญชีค่าใช้จ่ายของเอกสาร 87/260 นักบัญชีต้องตรวจว่าค่าใช้จ่ายถูกนับซ้ำหรือไม่
- ระบบเก็บอัตราแลกเปลี่ยน (คอลัมน์ `exchange_rate`) และสกุลเงิน (`currency_code`) ไว้ แต่ไม่ได้นำไปคูณยอดในการปันส่วน ยอดที่กรอกจึงต้องเป็นเงินบาทแล้ว
- ข้อความ error เมื่อไม่ได้เลือกเอกสารครบเขียนว่า "อย่างละ 1 ใบ" แต่จริง ๆ ไม่มีเอกสารค่าใช้จ่ายก็ได้ถ้ากรอกค่านำเข้าตรงไว้ (`hidden_cost.go:207-208`)
- บันทึกผ่าน `saveTransTx` โดยตรง จึงไม่ผ่านการตรวจงวดบัญชี

## ดูเพิ่ม
- [[proc-hidden-cost]]
- [[scr-hidden-cost]]
- [[tbl-ic-hidden-cost-process]]
- [[faq-why-stock-cost-changed]]
- [[faq-purchase-invoice-gl-posting]]

## ที่มาในโค้ด
- `backend/internal/application/process/hidden_cost.go:15` คำอธิบาย: ปันส่วนเอกสาร 87/260 และค่าที่กรอกโดยตรง ลงเอกสาร 12/310/60 แล้วสร้าง 66
- `backend/internal/application/process/hidden_cost.go:31-32` ชุด flag เอกสารค่าใช้จ่ายและเอกสารซื้อ
- `backend/internal/application/process/hidden_cost.go:125` `allocateHiddenCost` ปัด HALF_UP และเศษลงบรรทัดน้ำหนักสูงสุด
- `backend/internal/application/process/hidden_cost.go:190` `hiddenCostCalc` ตรวจ `calFrom`/`calFollow` (:192) และเอกสารที่เลือก (:207); ค่าที่กรอกตรงห้ามติดลบ (:177); `exchangeRate` ไม่ถูกใช้คำนวณ (:276-279, :287)
- `backend/internal/application/process/hidden_cost.go:443` `HiddenCostSave` เลข AFC/IA (:467, :489), บรรทัด qty 0 (:504-507), `is_lock_record` (:518)
- `backend/internal/application/process/hidden_cost.go:591` `HiddenCostDelete`
- `backend/internal/application/process/service.go:297` บรรทัดจำนวน 0 เพิ่มเฉพาะมูลค่า
- `frontend/account/master/HiddenCostScreen.tsx:106` จอเมนู 2.22
