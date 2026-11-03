---
title: "ตั้งหนี้ เพิ่มหนี้ ลดหนี้ ชำระหนี้ และหนี้ค้าง (AP/AR debt / ap_ar_trans / debt_balance)"
tags: [glossary, ap, ar, debt]
aliases: ["ตั้งหนี้", "ตั้งหนี้ยกมา", "ตั้งหนี้อื่นๆ", "เพิ่มหนี้", "ลดหนี้", "ใบลดหนี้", "ใบเพิ่มหนี้", "ชำระหนี้", "จ่ายชำระหนี้", "รับชำระหนี้", "ใบเสร็จรับเงิน", "ใบวางบิล", "ใบรับวางบิล", "วางบิล", "หนี้ค้าง", "ยอดหนี้คงค้าง", "debt_balance", "ap_ar_trans", "ap_ar_trans_detail", "billing_no", "sum_debt_amount", "balance_ref", "sum_pay_money", "total_net_value", "aparStatMoves", "aparStatFlags", "สถานะลูกหนี้", "สถานะเจ้าหนี้", "DE", "EE", "DD", "ED"]
sources: ["backend/internal/application/process/report_menu_ap_ar.go:384", "backend/internal/application/process/report_menu_ap_ar.go:398", "backend/internal/application/process/ap_outstanding.go:9", "backend/internal/application/process/docs.go:342", "backend/internal/application/process/docs.go:566", "frontend/account/tabs/transMenuMap.ts:1209", "frontend/account/tabs/transMenuMap.ts:1251", "frontend/account/tabs/transMenuMap.ts:1345", "frontend/account/tabs/transMenuMap.ts:1374", "frontend/account/tabs/transMenuMap.ts:1544", "frontend/account/tabs/transMenuMap.ts:1573", "frontend/src/config/bcMenu.json:6217", "frontend/src/config/bcMenu.json:6230", "frontend/src/config/bcMenu.json:7024", "frontend/src/config/bcMenu.json:7037"]
---

# ตั้งหนี้ / เพิ่มหนี้ / ลดหนี้ / ชำระหนี้

## ในระบบนี้คืออะไร
ระบบไม่มีตารางยอดหนี้คงค้างที่เชื่อถือได้ ยอดหนี้คำนวณจากเอกสารดิบ 4 กลุ่ม (`aparStatMoves`, `report_menu_ap_ar.go:398-406`) ได้แก่ calc 1 ตั้งหนี้, 2 เพิ่มหนี้, 3 ลดหนี้ (ติดลบ) และ 4 ชำระ (ติดลบ) นับเฉพาะเอกสารที่ `last_status = 0`

## flag ในแต่ละกลุ่ม (`aparStatFlags`, `report_menu_ap_ar.go:384-394`)
| กลุ่ม | เจ้าหนี้ (AP) | ลูกหนี้ (AR) |
|---|---|---|
| 1 ตั้งหนี้ | 12/315/260 (inquiry 0,2), 11 (inquiry 1), 81, 87 | 418/44/250 (inquiry 0,2), 93, 99 |
| 2 เพิ่มหนี้ | 316, 14, 83, 89, 264 (inquiry 0,2) | 46, 95, 101 |
| 3 ลดหนี้ | 16/317 (inquiry 0,1), 85/91/262 (inquiry 0,2) | 48 (inquiry 0,2,4), 97, 103, 252 |
| 4 ชำระ | 19 (`ap_ar_trans.total_net_value`) | 239 |
ชื่อเอกสาร (จาก `transMenuMap.ts`): 81 DA ตั้งหนี้ยกมา (`:1209`), 85 DC ลดหนี้ยกมา, 83 DB เพิ่มหนี้ยกมา, 87 ตั้งหนี้อื่นๆ (เจ้าหนี้) (`:1251`), 93 EA / 95 EB / 97 EC ยกมาฝั่งลูกหนี้, 99 ตั้งหนี้อื่นๆ (ลูกหนี้)

## เอกสารหนี้ใน `ap_ar_trans`
- 213 DD ใบรับวางบิล (เจ้าหนี้) (`transMenuMap.ts:1345`), 19 DE จ่ายชำระหนี้ (`:1374`), 235 ED ใบวางบิล (ลูกหนี้) (`:1544`), 239 EE รับชำระหนี้/ออกใบเสร็จรับเงิน (`:1573`)
- รายการบิลเก็บใน `ap_ar_trans_detail`: `billing_no`, `billing_date`, `bill_type`, `ref_doc_no`, `ref_doc_date`, `due_date`, `doc_ref`, `sum_debt_amount`, `balance_ref`, `sum_pay_money` (`docs.go:566-567`)
- `total_net_value` = ผลรวม `sum_pay_money` (`docs.go:334`, `:342`)

## ข้อควรระวัง
- `ap_supplier.debt_balance` ที่เก็บไว้ไม่มีโค้ดส่วนไหนอัปเดต โค้ดจึงคำนวณสดจากเอกสาร (ผลรวม `aparStatMoves` ทุกวันที่ ไม่จำกัดวัน) ส่วน `chq_balance` และ `bill_balance` ยังเป็นค่าที่เก็บไว้ (`ap_outstanding.go:9-12` แทนที่เฉพาะ `debt_balance`)
- ฝั่ง AR ไม่นับ 254 (รายได้อื่น เพิ่มหนี้) ในกลุ่มเพิ่มหนี้ของรายงานสถานะ (`report_menu_ap_ar.go:392`) แต่รายงานเคลื่อนไหวนับ (`aparMovementBlocks`, `:454`)
- 418 "คืนเช็ค/ตั้งหนี้ใหม่" อยู่ในกลุ่มตั้งหนี้ลูกหนี้ ดู [[term-cheque-status]]
- เมนูหลัก: ใบรับวางบิล (เจ้าหนี้) bcMenu.json:6217, จ่ายชำระหนี้ :6230, ใบวางบิล (ลูกหนี้) :7024, รับชำระหนี้/ออกใบเสร็จรับเงิน :7037

## ลิงก์
[[tbl-ap-ar-trans]] · [[tbl-ap-ar-trans-detail]] · [[term-inquiry-type]] · [[term-credit-due]] · [[term-party-ap-ar]] · [[fe-transaction-menu-debt-cashbank]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/report_menu_ap_ar.go:384-406`, `:454`
- `backend/internal/application/process/ap_outstanding.go:9-12`
- `backend/internal/application/process/docs.go:334`, `:342`, `:566-567`
- `frontend/account/tabs/transMenuMap.ts:1209`, `:1251`, `:1345`, `:1374`, `:1544`, `:1573`
- `frontend/src/config/bcMenu.json:6217`, `:6230`, `:7024`, `:7037`
