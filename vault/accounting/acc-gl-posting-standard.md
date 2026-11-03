---
title: "การลงบัญชี Dr/Cr มาตรฐานแยกตามชนิดเอกสาร (Standard GL Posting)"
tags: [accounting, gl, debit-credit, posting]
aliases: ["ลงบัญชี", "Dr Cr", "เดบิต เครดิต", "ผังบัญชี default", "buildStandardGLLines", "บัญชีพัก 9999", "GL ขาย", "GL ซื้อ"]
sources: ["backend/internal/application/process/service.go:1585", "backend/internal/application/process/service.go:1766", "backend/internal/application/process/service.go:1781", "backend/internal/application/process/service.go:1786", "backend/internal/application/process/service.go:1796", "backend/internal/application/process/service.go:1806", "backend/internal/application/process/service.go:1822", "backend/internal/application/process/service.go:1829", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/service.go:1934", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/service.go:1995", "backend/internal/application/process/service.go:2009", "backend/internal/application/process/service.go:2061", "backend/internal/application/process/service.go:2075", "backend/internal/application/process/service.go:2135", "backend/internal/application/process/service.go:2157", "backend/internal/application/process/service.go:2164", "backend/internal/application/process/service.go:2170", "backend/internal/application/process/service.go:2196", "backend/internal/application/process/service.go:2218", "backend/internal/application/process/service.go:2366", "backend/internal/application/process/service.go:1470", "backend/internal/application/process/trans_deposit.go:48", "backend/internal/application/process/gl_pay_other.go:17", "backend/internal/application/process/gl_template_defaults.go:89"]
---

# การลงบัญชี Dr/Cr มาตรฐาน (`buildStandardGLLines`)

เมื่อรูปแบบเอกสารไม่มี template ใน `erp_doc_format_gl` ลงรายการให้ (service.go:1585) ระบบจะลง GL ตามชุดบัญชีมาตรฐานที่เขียนไว้ในโค้ด (service.go:1786) แยกตาม `trans_flag` ทุกบรรทัดใช้ยอดหัวเอกสาร (ก่อน VAT, VAT, ยอดรวม ปัด HALF_UP 2 ตำแหน่ง ถ้ายอดรวม − VAT ติดลบใช้ยอดก่อน VAT เป็นฐาน service.go:1788-1794) แล้วต้องสมดุล Dr = Cr

## ทำงานอย่างไร

### การหาบัญชี (`resolveChartAccount` service.go:1766)
ลองรหัสตามลำดับ (ตรงตัว หรือขึ้นต้นด้วย `รหัส-`) ถ้าไม่มีในผังบัญชีเลยสักตัว จะคืน**รหัสตัวแรกที่ขอ**ทั้งที่ไม่มีในผัง (`service.go:1781`) ส่วน "9999" (บัญชีพัก) ใช้เฉพาะกรณีไม่ได้ส่งรหัสมาเลย (`service.go:1783`) จากนั้นบางบทบาทถูก override ด้วยบัญชีจาก master:
- ธนาคาร: `account_code_1` ของสมุดใน `erp_pass_book` (สมุดจาก detail `item_code` → `cb_trans_detail.pass_book_code` → `ic_trans.pass_book_code` service.go:1806)
- ซื้อ: `erp_expenses_list.gl_account_code` ของ item บรรทัดแรก เฉพาะ 260 / 262 / 264 / 87 / 89 / 91 (service.go:1822)
- ขาย: `erp_income_list.gl_account_code` ของ item บรรทัดแรก เฉพาะ 250 / 252 / 254 (service.go:1829)
- มัดจำ/ล่วงหน้า: บัญชีตามชนิดเอกสาร (`depositKinds` trans_deposit.go:48) ดู [[acc-deposit-advance]]
- ลูกหนี้/เจ้าหนี้ใช้รหัสมาตรฐานด้านล่างเสมอ ไม่ได้อ่านบัญชีจากข้อมูลลูกค้า/ผู้จำหน่าย

| บทบาท | รหัสที่ลองตามลำดับ |
|---|---|
| เงินสด | 1111, 1110, 1100 |
| ธนาคาร | 1112, 1113, 1111 |
| ลูกหนี้ | 1121, 1131, 1130, 1120 / เจ้าหนี้ 2111, 2110, 2100 |
| ซื้อ | 5111, 5110, 1151 / ขาย 4111, 4110, 4100 |
| ภาษีซื้อ | 1154, 1151, 1155, 1190 / ภาษีขาย 2134, 2121, 2135, 2190 |
| เช็คจ่าย | 2112 / เช็ครับ 1122 (ในแท็บจ่าย) |
| ภาษีหัก ณ ที่จ่ายในแท็บจ่าย | จ่าย 2122, 2123, 2120 / รับ 1153, 1154, 1152, 2122 |
| สินค้า | 1131, 1130, 1141 / ต้นทุน 5110, 5111 |
| รายได้อื่น | 4210, 4200, 4111, 4110 |
| เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ | 212015, 2113 |
| เงินสดย่อย | 1111-01, 1112, 1111 |
| FX ขาดทุน / กำไร | 511030 / 420040 |

### Dr/Cr ตาม flag
| flag | Dr | Cr |
|---|---|---|
| 310 ทยอยรับสินค้า | ซื้อ | 212015 เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ |
| 311 ส่งคืนจากการรับ | 212015 | ซื้อ |
| 315 ตั้งหนี้จากการรับ | 212015 + ภาษีซื้อ | เจ้าหนี้ (หรือเงินที่จ่าย เมื่อ inquiry 1/3), มัดจำ |
| 12, 14, 18, 316, 260, 264, 87, 89 | ซื้อ + ภาษีซื้อ | เจ้าหนี้ หรือเงินที่จ่าย (inquiry 1/3 ยกเว้น 14 / 316 หรือ 260 / 264 ที่มียอดจ่ายใน `cb_trans`), มัดจำ |
| 16, 317, 262, 91 คืน/ลดหนี้ | เจ้าหนี้ หรือเงินที่รับคืน (16 / 317 inquiry ≥ 2 หรือ 262) | ซื้อ, ภาษีซื้อ |
| 44, 46, 50, 144, 250, 254 ขาย | ลูกหนี้ หรือเงินที่รับ, มัดจำ | ขาย, ภาษีขาย |
| 48, 252 รับคืน/ลดหนี้ | ขาย, ภาษีขาย | ลูกหนี้ หรือเงินที่จ่ายคืน |
| 99, 101 ลูกหนี้อื่น | ลูกหนี้ หรือเงินสด (inquiry 1), มัดจำ | รายได้อื่น + ภาษีขาย (103 กลับข้าง) |
| 401 ฝาก / 402 ถอน | 401: ธนาคารตามสมุดของแต่ละบรรทัด / 402: เงินสด | 401: เงินสด / 402: ธนาคาร |
| 56, 68 เบิก/ปรับลด | ต้นทุน 5110 | สินค้า |
| 58, 60, 66 รับคืน/รับ/ปรับเพิ่ม | สินค้า | ต้นทุน |
| 300 เบิกเงินสดย่อย | เงินสดย่อย (1111-01 หรือบัญชีของรายการ) | เงินที่จ่าย |
| 301 คืนเงินสดย่อย | เงินที่รับ | เงินสดย่อย |
| 422 โอนเงิน | สมุดปลายทาง | สมุดต้นทาง |
| 19 / 239 ชำระหนี้ | เจ้าหนี้ / เงินที่รับ | เงินที่จ่าย / ลูกหนี้ (+ ผลต่างอัตราแลกเปลี่ยน) |
| 10, 11, 20, 25, 40, 42, 110, 112 | มัดจำ/ล่วงหน้า vs เงิน (11, 25, 110, 112 แยก VAT) | |

- ขาย/ซื้อที่ใช้มัดจำ: ฝั่งซื้อ/ขายบวกยอดมัดจำ (ก่อน VAT) กลับเข้าไป แล้วตัดบัญชีมัดจำอีกฝั่ง
- เช็ค/บัตรเครดิต ดู [[acc-cheque-transfer]], อัตราแลกเปลี่ยน ดู [[acc-fx-multi-currency]], มัดจำ ดู [[acc-deposit-advance]]

### บรรทัดรายได้/ค่าใช้จ่ายอื่นจากแท็บจ่าย (`payOtherGL` gl_pay_other.go:17)
- `cb_trans_detail.doc_type` 11 = ค่าใช้จ่ายอื่น (Dr), 12 = รายได้อื่น (Cr) ตามบัญชีใน `erp_expenses_list` / `erp_income_list`
- รายการที่ไม่มีบัญชี ใช้รายได้อื่น 4210, 4200, 4111, 4110 หรือค่าใช้จ่าย 5111, 5110, 1151
- บรรทัดเงินบวก/ลบส่วนต่าง (รายได้ − ค่าใช้จ่าย) และบรรทัดเหล่านี้ลงเฉพาะเมื่อเอกสารมีบรรทัดเงิน
- อ่านไม่ได้ = error (ไม่ข้าม เพราะรายการขาดหายจะยังสมดุลและซ่อนความผิดพลาด)

### กฎทั่วไป
- บรรทัดยอดศูนย์ถูกตัดทิ้ง (service.go:2366)
- เงินที่รับ/จ่ายแยกเป็นเงินสด/โอน/เช็ค/บัตร/ภาษีหัก ณ ที่จ่าย ตาม `cb_trans` (`payTenders` service.go:1871) เมื่อผลรวมตรงยอด ไม่งั้นลงเงินสดบรรทัดเดียว ดู [[acc-payment-tab]]

## จุดเสี่ยง
- **Known gap ที่โค้ดระบุเอง** (service.go:2164): IA 66 ที่มี qty และ inquiry_type <> 1 เข้าสต็อกด้วย qty x ราคาเฉลี่ย แต่ GL ลง Dr สินค้าด้วยยอดหัวเอกสารที่คีย์ จึงทำให้ GL ไม่เท่ากับมูลค่าสต็อก (comment ระบุว่ารอลุงจืดตัดสิน)
- **การขาย 44 ใน standard ไม่มีบรรทัดต้นทุนขาย (COGS)/ลดสินค้า**: มีได้เฉพาะใน template (action 101 / 103 ลงด้วยต้นทุนรวม `totalCost` ทั้งคู่) และรูปแบบเริ่มต้นที่ดึงมาขณะ `erp_option.inventory_gl_post` = 0 จะไม่มี 2 action นี้ (gl_template_defaults.go:89) ต้นทุนขายจึงลงหรือไม่ขึ้นกับแถวใน `erp_doc_format_gl` ของบริษัท ดู [[acc-gl-template-engine]]
- ยอดสต็อกใช้ยอดหัวเอกสาร ไม่ใช่ `sum_of_cost` ที่ rebuild แล้ว (ยกเว้นเอกสารที่ total = 0 ซึ่งรวมจากบรรทัด service.go:1470)
- รหัสบัญชี fallback ที่ hardcode อาจไม่ตรงกับผังบัญชีของบริษัท และจะลงบัญชีด้วยรหัสที่ไม่มีในผังโดยไม่เตือน (ไม่ได้ไปตก 9999)

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1766` resolveChartAccount
- `backend/internal/application/process/service.go:1786` buildStandardGLLines
- `backend/internal/application/process/service.go:1796-1803` รหัสบัญชีมาตรฐาน
- `backend/internal/application/process/service.go:1934` 310 / 311 / 315
- `backend/internal/application/process/service.go:1976` ซื้อ
- `backend/internal/application/process/service.go:2009` ขาย
- `backend/internal/application/process/service.go:2061` รับคืน
- `backend/internal/application/process/service.go:2157` เอกสารสต็อก
- `backend/internal/application/process/service.go:2164` known gap 66
- `backend/internal/application/process/gl_pay_other.go:17` payOtherGL

## ดูเพิ่ม
- [[acc-gl-rebuild]]
- [[acc-gl-template-engine]]
- [[acc-trans-flag-map]]
- [[acc-inventory-cost-moving-average]]
