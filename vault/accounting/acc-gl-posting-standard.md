---
title: "การลงบัญชี Dr/Cr มาตรฐานแยกตามชนิดเอกสาร (Standard GL Posting)"
tags: [accounting, gl, debit-credit, posting]
aliases: ["ลงบัญชี", "Dr Cr", "เดบิต เครดิต", "ผังบัญชี default", "buildStandardGLLines", "บัญชีพัก 9999", "GL ขาย", "GL ซื้อ"]
sources: ["backend/internal/application/process/service.go:1755", "backend/internal/application/process/service.go:1775", "backend/internal/application/process/service.go:1923", "backend/internal/application/process/service.go:1965", "backend/internal/application/process/service.go:1998", "backend/internal/application/process/service.go:2050", "backend/internal/application/process/service.go:2146", "backend/internal/application/process/service.go:2150", "backend/internal/application/process/service.go:2207", "backend/internal/application/process/gl_pay_other.go:17"]
---

# การลงบัญชี Dr/Cr มาตรฐาน (`buildStandardGLLines`)

เมื่อรูปแบบเอกสารไม่มี template ใน `erp_doc_format_gl` ระบบจะลง GL ตามชุดบัญชีมาตรฐานที่เขียนไว้ในโค้ด (service.go:1775) แยกตาม `trans_flag` ทุกบรรทัดใช้ยอดหัวเอกสาร (ก่อน VAT, VAT, ยอดรวม) แล้วต้องสมดุล Dr = Cr

## ทำงานอย่างไร

### การหาบัญชี (`resolveChartAccount` service.go:1755)
ลองรหัสตามลำดับ (ตรงตัว หรือขึ้นต้นด้วย `รหัส-`) ถ้าไม่มีในผังบัญชีเลยสักตัว จะคืน**รหัสตัวแรกที่ขอ**ทั้งที่ไม่มีในผัง (`service.go:1769-1771`) ส่วน "9999" (บัญชีพัก) ใช้เฉพาะกรณีไม่ได้ส่งรหัสมาเลย (`service.go:1772`) จากนั้นถูก override ด้วยบัญชีจาก `erp_pass_book` (ธนาคาร), รายการค่าใช้จ่าย/รายได้อื่น และบัญชีของคู่ค้า

| บทบาท | รหัสที่ลองตามลำดับ |
|---|---|
| เงินสด | 1111, 1110, 1100 |
| ธนาคาร | 1112, 1113, 1111 |
| ลูกหนี้ | 1121... / เจ้าหนี้ 2111... |
| ซื้อ | 5111, 5110, 1151 / ขาย 4111... |
| ภาษีซื้อ | 1154, 1151, 1155, 1190 / ภาษีขาย 2134, 2121, 2135, 2190 |
| เช็คจ่าย | 2112 / เช็ครับ 1122 |
| สินค้า | 1131, 1130, 1141 / ต้นทุน 5110, 5111 |
| รายได้อื่น | 4210... |
| FX ขาดทุน / กำไร | 511030 / 420040 |

### Dr/Cr ตาม flag
| flag | Dr | Cr |
|---|---|---|
| 310 ทยอยรับสินค้า | ซื้อ | 212015 เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ |
| 311 ส่งคืนจากการรับ | 212015 | ซื้อ |
| 315 ตั้งหนี้จากการรับ | 212015 + ภาษีซื้อ | เจ้าหนี้ (หรือเงินที่จ่าย), มัดจำ |
| 12, 14, 18, 316, 260, 264, 87, 89 | ซื้อ + ภาษีซื้อ | เจ้าหนี้ หรือเงินที่จ่าย (inquiry 1/3 = เงินสด), มัดจำ |
| 16, 317, 262, 91 คืน/ลดหนี้ | เจ้าหนี้ หรือเงินที่รับคืน | ซื้อ, ภาษีซื้อ |
| 44, 46, 50, 144, 250, 254 ขาย | ลูกหนี้ หรือเงินที่รับ, มัดจำ | ขาย, ภาษีขาย |
| 48, 252 รับคืน/ลดหนี้ | ขาย, ภาษีขาย | ลูกหนี้ หรือเงินที่จ่ายคืน |
| 99, 101 ลูกหนี้อื่น | ลูกหนี้ หรือเงินสด | รายได้อื่น + ภาษีขาย (103 กลับข้าง) |
| 401 / 402 | ธนาคาร / เงินสด | เงินสด / ธนาคาร (ตามสมุดบัญชี) |
| 56, 68 เบิก/ปรับลด | ต้นทุน 5110 | สินค้า |
| 58, 60, 66 รับคืน/รับ/ปรับเพิ่ม | สินค้า | ต้นทุน |
| 300 เบิกเงินสดย่อย | เงินสดย่อย (1111-01 หรือบัญชีของรายการ) | เงินที่จ่าย |
| 301 คืนเงินสดย่อย | เงินที่รับ | เงินสดย่อย |
| 422 โอนเงิน | สมุดปลายทาง | สมุดต้นทาง |
| 19 / 239 ชำระหนี้ | เจ้าหนี้ / เงินที่รับ | เงินที่จ่าย / ลูกหนี้ (+ ผลต่างอัตราแลกเปลี่ยน) |
| 10, 11, 20, 25, 40, 42, 110, 112 | มัดจำ/ล่วงหน้า vs เงิน (11, 25, 110, 112 แยก VAT) | |

เช็ค/บัตรเครดิต ดู [[acc-cheque-transfer]], อัตราแลกเปลี่ยน ดู [[acc-fx-multi-currency]], มัดจำ ดู [[acc-deposit-advance]]

### บรรทัดรายได้/ค่าใช้จ่ายอื่นจากแท็บจ่าย (`payOtherGL` gl_pay_other.go:17)
- `cb_trans_detail.doc_type` 11 = ค่าใช้จ่ายอื่น (Dr), 12 = รายได้อื่น (Cr) ตามบัญชีใน `erp_expenses_list` / `erp_income_list`
- รายการที่ไม่มีบัญชี ใช้รายได้อื่น 4210... หรือค่าใช้จ่าย 5111...
- อ่านไม่ได้ = error (ไม่ข้าม เพราะรายการขาดหายจะยังสมดุลและซ่อนความผิดพลาด)

### กฎทั่วไป
- บรรทัดยอดศูนย์ถูกตัดทิ้ง
- ขายเงินสดแยกเงินสด/ธนาคาร/บัตรตามแท็บจ่าย (`payTenders`) ดู [[acc-payment-tab]]

## จุดเสี่ยง
- **Known gap ที่โค้ดระบุเอง** (service.go:2150): IA 66 ที่มี qty และ inquiry_type <> 1 เข้าสต็อกด้วย qty x ราคาเฉลี่ย แต่ GL ลง Dr สินค้าด้วยยอดหัวเอกสารที่คีย์ จึงทำให้ GL ไม่เท่ากับมูลค่าสต็อก (comment ระบุว่ารอลุงจืดตัดสิน)
- **การขาย 44 ใน standard ไม่มีบรรทัดต้นทุนขาย (COGS)/ลดสินค้า**: มีได้เฉพาะใน template (action 101 ต้นทุนขาย / 103 สินค้า) และรูปแบบเริ่มต้นที่ดึงมาขณะ `inventory_gl_post` = 0 จะไม่มี 2 action นี้ ดู [[acc-gl-template-engine]] (การลงต้นทุนขายของบริษัทจริงขึ้นกับแถวใน `erp_doc_format_gl` ยังไม่ยืนยัน)
- ยอดสต็อกใช้ยอดหัวเอกสาร ไม่ใช่ `sum_of_cost` ที่ rebuild แล้ว (ยกเว้นเอกสารที่ total = 0)
- รหัสบัญชี fallback ที่ hardcode อาจไม่ตรงกับผังบัญชีของบริษัท และจะลงบัญชีด้วยรหัสที่ไม่มีในผังโดยไม่เตือน (ไม่ได้ไปตก 9999)

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1755` resolveChartAccount
- `backend/internal/application/process/service.go:1775` buildStandardGLLines
- `backend/internal/application/process/service.go:1923` 310 / 311 / 315
- `backend/internal/application/process/service.go:1965` ซื้อ
- `backend/internal/application/process/service.go:1998` ขาย
- `backend/internal/application/process/service.go:2050` รับคืน
- `backend/internal/application/process/service.go:2146` เอกสารสต็อก
- `backend/internal/application/process/service.go:2150` known gap 66
- `backend/internal/application/process/gl_pay_other.go:17` payOtherGL

## ดูเพิ่ม
- [[acc-gl-rebuild]]
- [[acc-gl-template-engine]]
- [[acc-trans-flag-map]]
- [[acc-inventory-cost-moving-average]]
