---
title: "บันทึกยอดยกมาลูกหนี้/เจ้าหนี้ยังไง ทำไมไม่มี GL"
tags: [faq, ar, ap, opening-balance, gl]
aliases: ["ลูกหนี้ยกมา", "เจ้าหนี้ยกมา", "ตั้งหนี้ยกมา", "AR opening balance", "AP opening balance", "trans_flag 93", "trans_flag 81", "headerAmountFlags", "ยอดยกมาไม่ลงบัญชี"]
sources: ["frontend/account/tabs/transMenuMap.ts:1406", "frontend/account/tabs/transMenuMap.ts:1209", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/trans.go:849", "backend/internal/application/process/trans_validate.go:71", "backend/internal/application/process/service.go:1737", "backend/internal/application/process/report_menu_ap_ar.go:384"]
---
# บันทึกยอดยกมาลูกหนี้/เจ้าหนี้ยังไง ทำไมไม่มี GL

**ตอบสั้น:** ใช้เมนู "ตั้งหนี้ยกมา" แยกฝั่ง คือลูกหนี้ 93 และเจ้าหนี้ 81 บันทึกเป็นรายบิล มีเฉพาะยอดเงินที่หัวเอกสารและวันครบกำหนด ไม่มีรายการสินค้า ยอดนี้เข้าไปในยอดหนี้และรับ/จ่ายชำระได้ตามปกติ แต่ระบบไม่สร้าง GL ให้ ยอดยกมาของบัญชีลูกหนี้/เจ้าหนี้ใน GL ต้องคีย์ใบสำคัญ (JV) แยกเอง

## รายละเอียด
**เอกสารยกมา**
- ลูกหนี้: ตั้งหนี้ยกมา 93, เพิ่มหนี้ยกมา 95, ลดหนี้ยกมา 97
- เจ้าหนี้: ตั้งหนี้ยกมา 81, เพิ่มหนี้ยกมา 83, ลดหนี้ยกมา 85
- ทั้ง 6 ประเภทอยู่ใน `headerAmountFlags` จึงบันทึกเฉพาะ `total_amount` ที่หัวเอกสาร ถ้าส่งรายการมาด้วยจะขึ้นข้อความ "เอกสารยกมาบันทึกเฉพาะยอดเงินที่หัวเอกสาร ไม่มีรายการ" และยอดเงินต้องมากกว่า 0
- ยอด VAT และส่วนลดถูกตั้งเป็น 0 ทั้งหมด

**ผลต่อยอดหนี้**
- 93/81 นับเป็นตั้งหนี้, 95/83 เพิ่มหนี้ และ 97/85 ลดหนี้ ในรายงานสถานะและรายงานอายุหนี้ (ดู [[faq-ap-ar-balance-where]])
- บิลยกมาจะขึ้นให้เลือกในใบรับชำระหนี้ 239 และใบจ่ายชำระหนี้ 19 รวมถึงใบวางบิล

**ทำไมไม่มี GL**
- `glRebuildTransFlags` ไม่มี 81–85 และ 93–97 ในโค้ดเขียนไว้ว่าเอกสารยกมาไม่ลง GL ตาม C# เดิม ยอดเงินมัดจำยกมา (90xx) ก็เช่นเดียวกัน
- วิธีที่สอดคล้องกับโค้ด: คีย์ยอดยกมาของบัญชีคุมลูกหนี้/เจ้าหนี้ใน GL ด้วยใบสำคัญรายวัน ([[faq-journal-voucher-jv]]) โดยใช้ยอดรวมให้ตรงกับผลรวมเอกสารยกมา
- เมื่อรับชำระบิลยกมา ใบรับชำระ 239 จะลง GL ตามปกติ (Dr เงิน / Cr ลูกหนี้) ทำให้ยอดลูกหนี้ใน GL ลดลง ถ้าไม่ได้คีย์ JV ยอดยกมาไว้ ยอดลูกหนี้ใน GL จะติดลบ

ยอดยกมาสินค้าเป็นอีกเอกสารหนึ่ง (54) ซึ่งมีแท็บ GL ของตัวเอง ดู [[faq-stock-opening-balance]]

## ข้อควรระวัง
- เอกสารยกมาข้ามการตรวจหน้าจอของเอกสารสินค้า (`checkScreenFields`, `checkParty`) แต่ยังผ่านการตรวจงวดบัญชี (`checkOpenPeriod` อยู่ก่อนจุดที่ข้าม)
- ถ้ายอดรวมเอกสารยกมาไม่เท่ากับยอดยกมาใน GL รายงานลูกหนี้กับงบทดลองจะไม่ตรงกัน (ดู [[faq-balance-mismatch-troubleshoot]])

## ดูเพิ่ม
- [[doc-ar-beginning-balance]]
- [[doc-ap-beginning-balance]]
- [[faq-new-company-setup]]
- [[faq-journal-voucher-jv]]
- [[faq-ar-receipt-ap-payment-gl]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1406` เมนูตั้งหนี้ยกมาลูกหนี้ 93 (95 ที่ `:1420`, 97 ที่ `:1434`)
- `frontend/account/tabs/transMenuMap.ts:1209` เมนูตั้งหนี้ยกมาเจ้าหนี้ 81 (85 ที่ `:1223`, 83 ที่ `:1237`)
- `backend/internal/application/process/trans.go:216` `headerAmountFlags` = 81, 83, 85, 93, 95, 97, 602, 604
- `backend/internal/application/process/trans.go:849` บันทึกเฉพาะยอดหัวเอกสาร และยอดต้องมากกว่า 0
- `backend/internal/application/process/trans_validate.go:71` ข้ามการตรวจหน้าจอของเอกสารสินค้า
- `backend/internal/application/process/service.go:1737` คอมเมนต์: 81–85/93–97 ไม่ลง GL
- `backend/internal/application/process/report_menu_ap_ar.go:384` ยกมานับในยอดหนี้ของรายงานสถานะ
