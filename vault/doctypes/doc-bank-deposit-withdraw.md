---
title: "บันทึกฝากเงิน / บันทึกถอนเงิน (Bank Deposit / Withdrawal)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 401", "trans_flag 402", "บันทึกฝากเงิน", "บันทึกถอนเงิน", "DM", "WM", "menu_cb_cash_payin", "menu_cb_cash_withdraw"]
sources: ["frontend/account/tabs/transMenuMap.ts:1887", "frontend/account/tabs/transMenuMap.ts:1902", "frontend/account/transaction/transLayouts.ts:133", "frontend/account/transaction/transLayouts.ts:134", "backend/internal/application/process/transcalc.go:18", "backend/internal/application/process/transcalc.go:23", "backend/internal/application/process/trans.go:1152", "backend/internal/application/process/service.go:1797", "backend/internal/application/process/service.go:1806", "backend/internal/application/process/service.go:1856", "backend/internal/application/process/service.go:1861", "backend/internal/application/process/service.go:2075", "backend/internal/application/process/pay_other.go:35", "backend/internal/application/process/pay_other.go:37", "backend/internal/application/process/trans_validate.go:45", "backend/internal/application/process/doc_cancel.go:56", "backend/internal/application/process/doc_cancel.go:143", "backend/internal/application/process/doc_cancel.go:585"]
---

# บันทึกฝากเงิน (401) / บันทึกถอนเงิน (402)

## ใช้เมื่อไร
- 401 "บันทึกฝากเงิน" ใช้นำเงินสดเข้าบัญชีธนาคาร (DM, transMenuMap.ts:1887)
- 402 "บันทึกถอนเงิน" ใช้ถอนเงินจากธนาคารเป็นเงินสด (WM, transMenuMap.ts:1902)
- รายการค้นจากสมุดบัญชีธนาคาร `erp_pass_book` (itemLookup ในเมนูทั้งสอง)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดย item_code ของบรรทัดคือรหัสสมุดบัญชีธนาคาร และ sum_amount คือยอด
- calc_flag ของบรรทัด: 401 = −1 และ 402 = +1 (`calcFlagByTransFlag` transcalc.go:23, :18 เขียนลงบรรทัดที่ trans.go:1152)

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่องหัวเอกสารพิเศษ มีแท็บ pay, gl (transLayouts.ts:133, :134)
- แท็บชำระมีตารางค่าใช้จ่ายอื่น/รายได้อื่น: 401 อยู่ใน `payOtherPayFlags` และ 402 อยู่ใน `payOtherReceiveFlags` (pay_other.go:35, :37)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585) case 401/402 อยู่ที่ service.go:2075

| flag | Dr | Cr |
|---|---|---|
| 401 | ธนาคาร (ตามสมุดบัญชี) = ยอดบรรทัด | เงินสด 1111/1110/1100 = `money(false)` |
| 402 | เงินสด 1111/1110/1100 = `money(true)` | ธนาคาร (ตามสมุดบัญชี) = ยอดบรรทัด |

- ฝั่งธนาคารแตก 1 บรรทัด GL ต่อบรรทัดเอกสารที่ sum_amount > 0 (ปัด half-up 2 ตำแหน่ง) ใช้ account_code_1 ของสมุดบัญชีบรรทัดนั้น (`glSQLPassBook`) เฉพาะเมื่อผลรวมบรรทัดเท่ากับยอดเอกสาร มิฉะนั้นลงบรรทัดเดียวเต็มยอดด้วยบัญชีธนาคารตั้งต้น (service.go:2076-2126)
- บัญชีธนาคารตั้งต้น = account_code_1 ของสมุดบัญชีตัวแรกในบรรทัดเอกสาร (หรือ pass_book_code ใน cb_trans_detail / ic_trans) ถ้าไม่มีใช้ 1112/1113/1111 (service.go:1797, :1806-1820)
- `money` (service.go:1861): ฝั่งเดบิต = ยอดรวม + (รายได้อื่น − ค่าใช้จ่ายอื่น) ฝั่งเครดิต = ยอดรวม − (รายได้อื่น − ค่าใช้จ่ายอื่น) และบรรทัดค่าใช้จ่ายอื่น (Dr) / รายได้อื่น (Cr) จากแท็บชำระลงเพิ่ม (`payOtherGL` service.go:1856, gl_pay_other.go:17)

## เอกสารต้นทาง-ปลายทาง
- ไม่มีเอกสารอ้างอิง (FLAG_SPEC 401/402 ไม่มี refDoc transLayouts.ts:133-134)

## ยกเลิก/แก้ไข
- ยกเลิก 401 ด้วย 403 และยกเลิก 402 ด้วย 404 (doc_cancel.go:56) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45) การยกเลิกตรวจทั้งวันที่ต้นฉบับและวันที่เอกสารยกเลิก (`checkCancelPeriod` doc_cancel.go:143, period.go:95)

## ข้อควรระวัง
- ถ้าผลรวมบรรทัดไม่เท่ากับยอดเอกสาร GL ฝั่งธนาคารเหลือบรรทัดเดียวด้วยบัญชีของสมุดบัญชีตัวแรก ไม่แยกตามสมุดบัญชีแต่ละบรรทัด

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1887` / `:1902` เมนู
- `frontend/account/transaction/transLayouts.ts:133` / `:134` FLAG_SPEC
- `backend/internal/application/process/service.go:2075` GL
- `backend/internal/application/process/doc_cancel.go:56` ยกเลิก 403/404

## ดูเพิ่ม
- [[doc-bank-transfer]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
