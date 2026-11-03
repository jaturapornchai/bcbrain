---
title: "รายการเมนูเอกสาร เจ้าหนี้ ลูกหนี้ เงินสด ธนาคาร เช็ค สมุดรายวัน (transMenuMap หมวด 4-6)"
tags: [frontend, transaction, menu, ap, ar, cashbank, cheque, gl, transMenuMap]
aliases: ["เมนูเจ้าหนี้", "เมนูลูกหนี้", "จ่ายชำระหนี้", "รับชำระหนี้", "ใบเสร็จรับเงิน", "ใบวางบิล", "ใบรับวางบิล", "เช็ครับ", "เช็คจ่าย", "ฝากเงิน", "ถอนเงิน", "โอนเงินระหว่างธนาคาร", "บัตรเครดิต", "เงินสดย่อย", "รายได้อื่นๆ", "ค่าใช้จ่ายอื่นๆ", "ข้อมูลรายวัน", "สมุดรายวัน", "gl_journal", "cb_chq_list", "ap_ar_trans"]
sources: ["frontend/account/tabs/transMenuMap.ts:1207", "frontend/account/tabs/transMenuMap.ts:1404", "frontend/account/tabs/transMenuMap.ts:1603", "frontend/account/tabs/transMenuMap.ts:1609", "frontend/account/tabs/transMenuMap.ts:2368", "frontend/account/tabs/transMenuMap.ts:2451"]
---

# รายการเมนูเอกสาร เจ้าหนี้ ลูกหนี้ เงินสด/ธนาคาร เช็ค สมุดรายวัน (หมวด 4-6 ของ `transMenuMap.ts`)

ต่อจาก [[fe-transaction-menu-purchase-sale-stock]]: 84 เมนูที่เหลือของ `TRANS_MENU_MAP` คือเจ้าหนี้ (AP) 13, ลูกหนี้ (AR) 13, เงินสด/ธนาคาร + บัญชีแยกประเภท (CB + GL) 58
หน้าจอทั้งหมดวาดด้วย `UniversalTransScreen` เหมือนกัน ([[fe-transaction-screens]]) ต่างที่ชนิดตาราง (`kind`) ซึ่งเลือก endpoint บันทึก/ลบ

## ทำงานอย่างไร

**วิธีอ่านตาราง** เหมือนโน้ตก่อนหน้า: `trans_flag` คือรหัสชนิดเอกสาร, โหมด บันทึก/ยกเลิก/อนุมัติ, "ต้นทาง N" = `origFlag`, "บรรทัด" = บรรทัดนิยามใน `frontend/account/tabs/transMenuMap.ts`.

**ตารางที่เก็บ (`kind`) และ endpoint** (จาก `UniversalTransScreen.tsx:2649-2905`)
| `kind` | จำนวนเมนูหมวด 4-6 | บันทึก | ลบ |
|---|---|---|---|
| `ic_trans` | 69 (หมวด 4-6 ส่วนมากเป็น `ic_trans` เพราะ C# เปิด `_icTransControl`) | `POST /api/process/trans/save` | `POST /api/process/trans/delete` |
| `ap_ar_trans` | 8 (ใบรับวางบิล/ใบวางบิล, จ่ายชำระหนี้/รับชำระหนี้ และเมนูยกเลิกของ 4 เมนูนี้ - บรรทัด 1345-1388 และ 1544-1587) | `POST /api/process/doc/save` | `POST /api/process/doc/delete` |
| `cb_chq_list` | 5 (ทะเบียนเช็ค) | `POST /api/process/doc/save` | `POST /api/process/doc/delete` |
| `gl_journal` | 2 (ข้อมูลรายวัน) | `POST /api/process/doc/save` | `POST /api/process/doc/delete` |

- โหมดยกเลิก/อนุมัติทุกชนิด เรียก `POST /api/process/doc/cancel|approve` ผ่าน `setDocStatus` ([[fe-transaction-screens]]).
- `kind: "cb_trans"` มีใน type แต่ **ไม่มีเมนูใดใช้** และจอจะ throw "ยังไม่รองรับ" ถ้าบันทึก/ลบ (`UniversalTransScreen.tsx:2649,2897`).
- จอที่มีแท็บรับ/จ่ายชำระ (เงินสด/โอน/พร้อมเพย์/เช็ค/บัตร/รายได้-ค่าใช้จ่ายอื่น) ส่งข้อมูลใน `pay` ของ `saveTrans` (`UniversalTransScreen.tsx:2610-2646`) ดูโน้ต [[fe-transaction-screens]].

**ข้อมูลจากคอมเมนูหัวหมวด 6** (`transMenuMap.ts:1603-1608`)
- เมนูเงินสด/ธนาคารทุกเมนูใน C# เปิด `_clone_icTrans` -> `_icTransControl` คือเก็บหัว `ic_trans` + รายการ `ic_trans_detail`; เมนูยกเลิก = เก็บเฉพาะหัว โดย `doc_ref` ชี้เอกสารต้นฉบับ.
- `trans_type` ตาม `_transType()` ของ BCERP เดิม: เช็คจ่าย = 1, โอนเงินออก (flag 422) = 0, ที่เหลือ = 2.
- C# ไม่กำหนด `_screen_code` ให้จอเงินสด; `prefix` ในไฟล์เป็น "ค่าเริ่มต้นของเว็บ" (ไม่ใช่ค่าจาก C#).
- คอมเมนู `ponytail:` ที่ 1871 ระบุว่า C# เขียนแถวโอนเข้าคู่กันด้วยสำหรับ flag 422 แต่เว็บบันทึกเฉพาะขาออก; ที่ 1990 ระบุว่ายังไม่มีคอลัมน์เลขเช็ค/ตัวเลือกเช็คตามสถานะ และยังไม่คำนวณ `cb_chq_list.status` (งานฝั่ง backend แยก) - ถือเป็นข้อจำกัดที่รู้อยู่ ไม่ใช่บั๊กใหม่.

### 4. ระบบเจ้าหนี้ (AP) - บรรทัด 1207-1403 (13 เมนู)

trans_type = 1; เมนูที่ `trans_flag` 81-91 เก็บใน `ic_trans`, flag 19 และ 213 เก็บใน `ap_ar_trans` (คอมเมนูบรรทัด 1207)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ตั้งหนี้ยกมา (เจ้าหนี้) | `menu_ap_debt_balance` | 81 | บันทึก | ic_trans | DA | เจ้าหนี้ |  | 1209 |
| ลดหนี้ยกมา (เจ้าหนี้) | `menu_ap_cn_balance` | 85 | บันทึก | ic_trans | DC | เจ้าหนี้ |  | 1223 |
| เพิ่มหนี้ยกมา (เจ้าหนี้) | `menu_ap_increase_debt` | 83 | บันทึก | ic_trans | DB | เจ้าหนี้ |  | 1237 |
| ตั้งหนี้อื่นๆ (เจ้าหนี้) | `menu_ap_debt_other` | 87 | บันทึก | ic_trans | COB | เจ้าหนี้ | อ้างอิงเอกสาร [6] | 1251 |
| ลดหนี้อื่นๆ (เจ้าหนี้) | `menu_ap_cn_debt_other` | 91 | บันทึก | ic_trans | CCO | เจ้าหนี้ | อ้างอิงเอกสาร [87] | 1268 |
| เพิ่มหนี้อื่นๆ (เจ้าหนี้) | `menu_ap_increase_debt_other` | 89 | บันทึก | ic_trans | CDO | เจ้าหนี้ | อ้างอิงเอกสาร [87] | 1285 |
| ยกเลิกตั้งหนี้อื่นๆ (เจ้าหนี้) | `menu_ap_cancel_debt_balance_other` | 88 | ยกเลิก | ic_trans | COC | เจ้าหนี้ | ต้นทาง 87 | 1302 |
| ยกเลิกลดหนี้อื่นๆ (เจ้าหนี้) | `menu_ap_cancel_cn_debt_other` | 92 | ยกเลิก | ic_trans | CNO | เจ้าหนี้ | ต้นทาง 91 | 1316 |
| ยกเลิกเพิ่มหนี้อื่นๆ (เจ้าหนี้) | `menu_ap_cancel_increase_debt_other` | 90 | ยกเลิก | ic_trans | CIC | เจ้าหนี้ | ต้นทาง 89 | 1330 |
| ใบรับวางบิล (เจ้าหนี้) | `menu_ap_pay_bill` | 213 | บันทึก | ap_ar_trans | DD | เจ้าหนี้ |  | 1345 |
| ยกเลิกใบรับวางบิล (เจ้าหนี้) | `menu_ap_cancel_pay_bill` | 214 | ยกเลิก | ap_ar_trans | DDC | เจ้าหนี้ | ต้นทาง 213 | 1359 |
| จ่ายชำระหนี้ (เจ้าหนี้) | `menu_ap_debt_billing` | 19 | บันทึก | ap_ar_trans | DE | เจ้าหนี้ |  | 1374 |
| ยกเลิกจ่ายชำระหนี้ (เจ้าหนี้) | `menu_ap_cancel_debt_billing` | 23 | ยกเลิก | ap_ar_trans | DEC | เจ้าหนี้ | ต้นทาง 19 | 1388 |

### 5. ระบบลูกหนี้ (AR) - บรรทัด 1404-1602 (13 เมนู)

trans_type = 2; flag 93-103 เก็บใน `ic_trans`, flag 235 และ 239 เก็บใน `ap_ar_trans` (คอมเมนูบรรทัด 1404)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ตั้งหนี้ยกมา (ลูกหนี้) | `menu_ar_debt_balance` | 93 | บันทึก | ic_trans | EA | ลูกหนี้ |  | 1406 |
| เพิ่มหนี้ยกมา (ลูกหนี้) | `menu_ar_increase_debt` | 95 | บันทึก | ic_trans | EB | ลูกหนี้ |  | 1420 |
| ลดหนี้ยกมา (ลูกหนี้) | `menu_ar_cn_balance` | 97 | บันทึก | ic_trans | EC | ลูกหนี้ |  | 1434 |
| ตั้งหนี้อื่นๆ (ลูกหนี้) | `menu_ar_debt_other` | 99 | บันทึก | ic_trans | AOB | ลูกหนี้ | อ้างอิงเอกสาร [30] | 1449 |
| เพิ่มหนี้อื่นๆ (ลูกหนี้) | `menu_ar_increase_debt_other` | 101 | บันทึก | ic_trans | ADO | ลูกหนี้ | อ้างอิงเอกสาร [99] | 1466 |
| ลดหนี้อื่นๆ (ลูกหนี้) | `menu_ar_cn_debt_other` | 103 | บันทึก | ic_trans | ACO | ลูกหนี้ | อ้างอิงเอกสาร [99] | 1483 |
| ยกเลิกตั้งหนี้อื่นๆ (ลูกหนี้) | `menu_ar_cancel_debt_balance_other` | 100 | ยกเลิก | ic_trans | AOC | ลูกหนี้ | ต้นทาง 99 | 1501 |
| ยกเลิกลดหนี้อื่นๆ (ลูกหนี้) | `menu_ar_cancel_cn_debt_other` | 104 | ยกเลิก | ic_trans | ADC | ลูกหนี้ | ต้นทาง 103 | 1515 |
| ยกเลิกเพิ่มหนี้อื่นๆ (ลูกหนี้) | `menu_ar_cancel_increase_debt_other` | 102 | ยกเลิก | ic_trans | AIC | ลูกหนี้ | ต้นทาง 101 | 1529 |
| ใบวางบิล (ลูกหนี้) | `menu_ar_pay_bill` | 235 | บันทึก | ap_ar_trans | ED | ลูกหนี้ |  | 1544 |
| ยกเลิกใบวางบิล (ลูกหนี้) | `menu_ar_cancel_pay_bill` | 236 | ยกเลิก | ap_ar_trans | EDCC | ลูกหนี้ | ต้นทาง 235 | 1558 |
| รับชำระหนี้/ออกใบเสร็จรับเงิน | `menu_ar_debt_billing` | 239 | บันทึก | ap_ar_trans | EE | ลูกหนี้ | flags [239,240] | 1573 |
| ยกเลิกชำระหนี้/ยกเลิกใบเสร็จรับเงิน | `menu_ar_cancel_debt_billing` | 240 | ยกเลิก | ap_ar_trans | EEC | ลูกหนี้ | ต้นทาง 239 | 1587 |

### 6. เงินสด/ธนาคาร (CB) และบัญชีแยกประเภท (GL) - บรรทัด 1603-2461 (58 เมนู)

**6.1 รายได้อื่นๆ** (6 เมนู; คอมเมนู 1609 อ้างช่องรหัสรายได้ `income_code`)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| รายได้อื่นๆ | `menu_cash_income_other` | 250 | บันทึก | ic_trans | OI | ลูกหนี้ |  | 1610 |
| ลดหนี้รายได้อื่นๆ | `menu_cash_income_other_credit` | 252 | บันทึก | ic_trans | OCN | ลูกหนี้ | อ้างอิงเอกสาร [250] | 1625 |
| เพิ่มหนี้รายได้อื่นๆ | `menu_cash_income_other_debit` | 254 | บันทึก | ic_trans | ODN | ลูกหนี้ | อ้างอิงเอกสาร [250] | 1643 |
| ยกเลิกรายได้อื่นๆ | `menu_cash_income_other_cancel` | 251 | ยกเลิก | ic_trans | OIC | ลูกหนี้ | ต้นทาง 250 | 1661 |
| ยกเลิกลดหนี้รายได้อื่นๆ | `menu_cash_income_other_credit_cancel` | 253 | ยกเลิก | ic_trans | OCC | ลูกหนี้ | ต้นทาง 252 | 1675 |
| ยกเลิกเพิ่มหนี้รายได้อื่นๆ | `menu_cash_income_other_debit_cancel` | 255 | ยกเลิก | ic_trans | ODC | ลูกหนี้ | ต้นทาง 254 | 1689 |

**6.2 ค่าใช้จ่ายอื่นๆ** (6 เมนู; คอมเมนู 1703)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ค่าใช้จ่ายอื่นๆ | `menu_cash_expense_other` | 260 | บันทึก | ic_trans | EPO | เจ้าหนี้ |  | 1704 |
| ลดหนี้ค่าใช้จ่ายอื่นๆ | `menu_cash_expense_other_credit` | 262 | บันทึก | ic_trans | EPC | เจ้าหนี้ | อ้างอิงเอกสาร [260] | 1719 |
| เพิ่มหนี้ค่าใช้จ่ายอื่นๆ | `menu_cash_expense_other_debit` | 264 | บันทึก | ic_trans | EPD | เจ้าหนี้ | อ้างอิงเอกสาร [260] | 1737 |
| ยกเลิกค่าใช้จ่ายอื่นๆ | `menu_cash_expense_other_cancel` | 261 | ยกเลิก | ic_trans | EOC | เจ้าหนี้ | ต้นทาง 260 | 1755 |
| ยกเลิกลดหนี้ค่าใช้จ่ายอื่นๆ | `menu_cash_expense_other_credit_cancel` | 263 | ยกเลิก | ic_trans | ECC | เจ้าหนี้ | ต้นทาง 262 | 1769 |
| ยกเลิกเพิ่มหนี้ค่าใช้จ่ายอื่นๆ | `menu_cash_expense_other_debit_cancel` | 265 | ยกเลิก | ic_trans | EDC | เจ้าหนี้ | ต้นทาง 264 | 1783 |

**6.3 เงินสดย่อย** (5 เมนู; คอมเมนู 1797)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| คืน/ลด วงเงินสดย่อย | `menu_cb_petty_cash_receive` | 300 | บันทึก | ic_trans | PCD | - |  | 1798 |
| รับ/เพิ่ม วงเงินสดย่อย | `menu_cb_petty_return` | 301 | บันทึก | ic_trans | PRM | - |  | 1813 |
| ยกเลิกคืน/ลด วงเงินสดย่อย | `menu_cb_petty_cash_receive_cancel` | 302 | ยกเลิก | ic_trans | PEC | - | ต้นทาง 300 | 1828 |
| ยกเลิกรับ/เพิ่ม วงเงินสดย่อย | `menu_cb_petty_return_cancel` | 303 | ยกเลิก | ic_trans | PMC | - | ต้นทาง 301 | 1842 |
| ยกมาเงินสด | `menu_cb_cash_balance` | 602 | บันทึก | ic_trans | CAB | - |  | 1856 |

**6.4 เงินฝากธนาคาร** (8 เมนู; คอมเมนู 1870)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| เงินฝากธนาคารยกมา | `menu_cb_bank_balance` | 604 | บันทึก | ic_trans | BBL | - |  | 1872 |
| บันทึกฝากเงิน | `menu_cb_cash_payin` | 401 | บันทึก | ic_trans | DM | - |  | 1887 |
| บันทึกถอนเงิน | `menu_cb_cash_withdraw` | 402 | บันทึก | ic_trans | WM | - |  | 1902 |
| บันทึกโอนเงินระหว่างธนาคาร | `menu_cash_transfer` | 422 | บันทึก | ic_trans | TM | - |  | 1917 |
| บันทึกยกเลิกฝากเงิน | `menu_cb_cash_payin_cancle` | 403 | ยกเลิก | ic_trans | DMC | - | ต้นทาง 401 | 1932 |
| บันทึกยกเลิกถอนเงิน | `menu_cb_cash_withdraw_cancle` | 404 | ยกเลิก | ic_trans | WMC | - | ต้นทาง 402 | 1946 |
| บันทึกขึ้นเงินwallet | `menu_cb_wallet_pass` | 463 | บันทึก | ic_trans | WLD | - |  | 1960 |
| บันทึกยกเลิกโอนเงินระหว่างธนาคาร | `menu_cash_transfer_cancel` | 423 | ยกเลิก | ic_trans | TMC | - | ต้นทาง 422 | 1975 |

**6.5 เช็ครับ** (13 เมนู; คอมเมนู 1989 - `item_code` เป็นสมุดบัญชี (flag 410-412) หรือเลขเช็ค (405/413/416/418))

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ทะเบียนเช็ครับ | `menu_cb_chq_in_receive_master` | 1 | บันทึก | cb_chq_list | CQR | - |  | 1991 |
| เช็ครับยกมา | `menu_cb_chq_in_receive_balance` | 405 | บันทึก | ic_trans | CHB | ลูกหนี้ |  | 2004 |
| บันทึกนำฝาก (เช็ครับ) | `menu_cb_chq_in_payin` | 410 | บันทึก | ic_trans | CHD | - |  | 2019 |
| บันทึกเช็คผ่าน (เช็ครับ) | `menu_cb_chq_in_pass` | 411 | บันทึก | ic_trans | CHP | - |  | 2034 |
| บันทึกเช็คคืน (เช็ครับ) | `menu_cb_chq_in_return` | 412 | บันทึก | ic_trans | CRT | - |  | 2049 |
| บันทึกเช็คขาดสิทธิ์ (เช็ครับ) | `menu_cb_chq_in_cancel` | 413 | บันทึก | ic_trans | CRC | - |  | 2064 |
| บันทึกการเปลี่ยนเช็ค (เช็ครับ) | `menu_cb_chq_renew` | 416 | บันทึก | ic_trans | CDE | ลูกหนี้ |  | 2079 |
| บันทึกคืนเช็ค/ตั้งหนี้ใหม่ | `menu_cb_return_chq_new_debt` | 418 | บันทึก | ic_trans | CND | ลูกหนี้ |  | 2094 |
| บันทึกยกเลิกนำฝากเช็ค | `menu_cb_chq_in_payin_cancle` | 430 | ยกเลิก | ic_trans | CDC | - | ต้นทาง 410 | 2109 |
| บันทึกยกเลิกเช็คผ่าน | `menu_cb_chq_in_pass_cancel` | 431 | ยกเลิก | ic_trans | CCP | - | ต้นทาง 411 | 2123 |
| บันทึกยกเลิกเช็ครับคืน | `menu_cb_chq_in_return_cancel` | 432 | ยกเลิก | ic_trans | CTC | - | ต้นทาง 412 | 2137 |
| บันทึกยกเลิกเช็คขาดสิทธิ์ | `menu_cb_chq_in_cancel_cancel` | 433 | ยกเลิก | ic_trans | DCC | - | ต้นทาง 413 | 2151 |
| บันทึกยกเลิกเปลี่ยนเช็ค | `menu_cb_chq_renew_cancel` | 436 | ยกเลิก | ic_trans | CED | - | ต้นทาง 416 | 2165 |

**6.6 เช็คจ่าย** (10 เมนู; trans_type = 1, คอมเมนู 2179)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ทะเบียนเช็คจ่าย | `menu_cb_chq_out_payment_master` | 2 | บันทึก | cb_chq_list | CQP | - |  | 2180 |
| เช็คจ่ายยกมา | `menu_cb_chq_out_payment_balance` | 406 | บันทึก | ic_trans | CPB | เจ้าหนี้ |  | 2193 |
| บันทึกเช็คผ่าน (เช็คจ่าย) | `menu_cb_chq_out_pass` | 451 | บันทึก | ic_trans | CPP | - |  | 2208 |
| บันทึกเช็คคืน (เช็คจ่าย) | `menu_cb_chq_out_return` | 453 | บันทึก | ic_trans | CPR | - |  | 2223 |
| บันทึกเช็คขาดสิทธิ์ (เช็คจ่าย) | `menu_cb_chq_out_cancel` | 452 | บันทึก | ic_trans | CHC | - |  | 2238 |
| บันทึกการเปลี่ยนเช็ค (เช็คจ่าย) | `menu_cb_chq_out_renew` | 456 | บันทึก | ic_trans | CPE | เจ้าหนี้ |  | 2253 |
| บันทึกยกเลิกเช็คจ่ายผ่าน | `menu_cb_chq_out_pass_cancel` | 471 | ยกเลิก | ic_trans | CPC | - | ต้นทาง 451 | 2268 |
| บันทึกยกเลิกเช็คขาดสิทธิ์ | `menu_cb_chq_out_cancel_cancel` | 472 | ยกเลิก | ic_trans | DPC | - | ต้นทาง 452 | 2282 |
| บันทึกยกเลิกเช็คคืน | `menu_cb_chq_out_return_cancel` | 473 | ยกเลิก | ic_trans | CEC | - | ต้นทาง 453 | 2296 |
| บันทึกยกเลิกเปลี่ยนเช็คจ่าย | `menu_cb_chq_out_renew_cancel` | 476 | ยกเลิก | ic_trans | CEP | - | ต้นทาง 456 | 2310 |

**6.7 บัตรเครดิต** (3 เมนู; คอมเมนู 2324 - flag 462 เป็นเอกสาร ไม่ใช่จอยกเลิก)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| รายละเอียดบัตรเครดิตรับ | `menu_cb_credit_card_receive` | 3 | บันทึก | cb_chq_list | CCR | - |  | 2325 |
| บันทึกขึ้นเงินบัตรเครดิต | `menu_cb_credit_card_pass` | 461 | บันทึก | ic_trans | CRD | - |  | 2338 |
| บันทึกยกเลิกบัตรเครดิต | `menu_cb_credit_card_cancel` | 462 | บันทึก | ic_trans | CRN | - |  | 2353 |

**6.8 สมุดรายวัน (GL) และเมนูทางลัด** (7 เมนู, บรรทัด 2368-2461)

| ชื่อเมนู | menuKey | trans_flag | โหมด | ตาราง | prefix | คู่ค้า | หมายเหตุ | บรรทัด |
|---|---|---|---|---|---|---|---|---|
| ข้อมูลรายวัน | `menu_gl_journal` | 0 | บันทึก | gl_journal | JV | - |  | 2368 |
| ใบเสนอราคาขาย | `menu_so_quotation` | 30 | บันทึก | ic_trans | SO | ลูกหนี้ |  | 2381 |
| ทะเบียนเช็ครับ | `menu_cb_chq_list_receive` | 1 | บันทึก | cb_chq_list | CQR | - |  | 2395 |
| ทะเบียนเช็คจ่าย | `menu_cb_chq_list_pay` | 2 | บันทึก | cb_chq_list | CQP | - |  | 2408 |
| รายได้อื่นๆ | `menu_cb_receive_money` | 250 | บันทึก | ic_trans | OI | ลูกหนี้ |  | 2421 |
| ค่าใช้จ่ายอื่นๆ | `menu_cb_pay_money` | 260 | บันทึก | ic_trans | EPO | เจ้าหนี้ |  | 2436 |
| บันทึกข้อมูลรายวันแบบเร็ว | `menu_gl_journal_fast` | 0 | บันทึก | gl_journal | JV | - |  | 2451 |

**ข้อสังเกตจากข้อมูล**
- `menu_gl_journal` และ `menu_gl_journal_fast` เป็น `gl_journal` ที่ `trans_type = 0`, `trans_flag = 0`, `prefix JV` (บรรทัด 2368-2380, 2451-2462) - จอสมุดรายวันบันทึกผ่าน `saveDoc` และแสดงรายการจากตาราง `gl_journal` (รหัสในช่องคู่ค้าคือ `book_code`, `UniversalTransScreen.tsx:1094-1100`). จอ `gl_journal` ทุกเมนูแสดงแถบเลือก "รายวันประจำ" จาก `gl_recurring` (`GlRecurringBar`, เงื่อนไข `kind === "gl_journal"` ที่ `UniversalTransScreen.tsx:3300`).
- เมนูทางลัด `menu_cb_chq_list_receive/pay` (ทะเบียนเช็ค), `menu_cb_receive_money` (รายได้อื่นๆ) และ `menu_cb_pay_money` (ค่าใช้จ่ายอื่นๆ) มีบรรทัดนิยามของตัวเองต่างจากชุด 6.1-6.6 (บรรทัด 2395-2450).
- คีย์ `menu_so_quotation` (บรรทัด 2381) ชื่อ "ใบเสนอราคาขาย" แต่ตั้งค่า `trans_flag 260`, `prefix EPO`, `partyType ap` และค้นรหัสจาก `erp_expenses_list` - ต่างจากเมนูใบเสนอราคาในหมวดขาย (ยังไม่ยืนยันเหตุผล; อาจเป็นค่าที่ตั้งผิดชื่อ ควรถามผู้ดูแลเมนู).
- เมนูที่ `partyType none` ไม่แสดงช่องคู่ค้า (`showParty: partyType !== "none"`, `transLayouts.ts:316`).

**ข้อควรระวัง**
- โน้ตนี้สร้างจากไฟล์ตอนอ่าน ถ้าเพิ่ม/ย้ายเมนูต้องอัปเดตจำนวนและตาราง; ตัวนับ (13/13/58) ตรวจจากการอ่านไฟล์ด้วยสคริปต์.
- เอกสารเช็คจ่ายใช้ `trans_type = 1` ต่างจากเมนูเงินสด/ธนาคารอื่นที่เป็น 2 (คอมเมนู 1607) อย่าใช้ `trans_type` เป็นตัวแยกฝั่งรับ/จ่ายเพียงอย่างเดียว.

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1207-1403` - เมนูเจ้าหนี้ 13
- `frontend/account/tabs/transMenuMap.ts:1404-1602` - เมนูลูกหนี้ 13
- `frontend/account/tabs/transMenuMap.ts:1603-2461` - เมนูเงินสด/ธนาคาร + GL 58 (คอมเมนู 1603-1608, 1609, 1703, 1797, 1870, 1989, 2179, 2324)
- `frontend/account/transaction/UniversalTransScreen.tsx:2649-2905` - เลือก endpoint ตาม `kind`
- `frontend/account/transaction/GlRecurringBar.tsx:1-57` - รายวันประจำ

## ดูเพิ่ม
[[frontend-overview]] · [[fe-transaction-screens]] · [[fe-transaction-menu-purchase-sale-stock]] · [[fe-screen-registry-menu]] · [[accounting-overview]] · [[process-overview]]
