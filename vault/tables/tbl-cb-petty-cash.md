---
title: "วงเงินสดย่อย (cb_petty_cash)"
tags: [tables, cb]
aliases: ["cb_petty_cash", "เงินสดย่อย", "ทะเบียนวงเงินสดย่อย", "petty cash"]
sources: ["backend/internal/application/process/report_menu_cb.go:667", "backend/internal/application/process/report_menu_cb.go:692", "backend/internal/application/process/gl_template.go:202"]
---

# วงเงินสดย่อย `cb_petty_cash`

ตารางหลัก (master) ของ **วงเงินสดย่อยแต่ละวง** — หนึ่งแถวต่อหนึ่งวง (เช่น เงินสดย่อยของแผนก/สาขา). ตัวเลขเคลื่อนไหวไม่ได้เก็บในตารางนี้ แต่คำนวณจากเอกสารเบิก/คืน/ตัดจ่าย แล้วรวมกับยอดยกมา (`balance_money`) ที่เก็บในตารางนี้.

เอกสารที่เกี่ยวข้อง (ดู [[acc-trans-flag-map]]): 300 เบิก/ขอวงเงินสดย่อย, 301 คืน/ลดวงเงินสดย่อย, 302 ยกเลิกคืน/ลดวงเงิน (`doc_flow_graph.go:217-219`), และการตัดจ่ายผ่านแท็บชำระเงินเป็น `cb_trans_detail.doc_type = 4` ([[tbl-cb-trans-detail]]).

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสวงเงินสดย่อย (key ธุรกิจ) — `ic_trans_detail.item_code` ของ 300/301 และ `cb_trans_detail.trans_number` ของ doc_type 4 อ้างค่านี้ | `report_menu_cb.go:329,667-681,721-737` |
| `name_1` | ชื่อวงเงินสดย่อย | `report_menu_cb.go:329,692,737` |
| `balance_money` | ยอดยกมาของวงเงิน (ตั้งต้นของรายงานสถานะ/เคลื่อนไหว) | `report_menu_cb.go:692-737` (`COALESCE(pc.balance_money,0) + Σ movements ก่อนวันเริ่ม`) |
| `chart_of_account` | รหัสผังบัญชีของวงเงินสดย่อย ใช้ตอนลง GL ([[tbl-gl-chart-of-account]]) | `gl_template.go:202` (`SELECT chart_of_account FROM cb_petty_cash WHERE code=$1`) |

คอลัมน์อื่นของตารางไม่ปรากฏใน SQL ที่อ่าน → "(ไม่ชัดจากโค้ด)".

## วิธีคำนวณยอดเคลื่อนไหว (CTE `pm`)

`cbmPettyCTE` (`report_menu_cb.go:667-681`) สร้างรายการเคลื่อนไหวต่อ `code` แบบมีเครื่องหมาย:

| calc | ที่มา | เครื่องหมาย |
|---|---|---|
| 1 เบิก | `ic_trans` 300 (+ `ic_trans_detail.sum_amount`) ที่ `last_status = 0` ทั้งหัว-บรรทัด | − |
| 2 รับคืน | `ic_trans` 301 | + |
| 3 ตัดจ่าย | `cb_trans_detail` `doc_type = 4` ของเอกสารกลุ่มจ่าย (`cbmPettyPay`) | − |
| 4 รับ | `cb_trans_detail` `doc_type = 4` ของเอกสารกลุ่มรับ (`cbmPettyRcv`) | + |

ยอดคงเหลือ = `balance_money` + Σ การเคลื่อนไหว (`report_menu_cb.go:721-737`). รายงานสถานะ "ยอดยกมา เบิก คืน ตัดจ่าย รับ ยอดยกไป" ตามช่วงวันที่ และรายงานเคลื่อนไหวแบบแสดงรายละเอียด/ยอดสะสม ใช้ CTE นี้.

## ความสัมพันธ์

- ← [[tbl-ic-trans]] / [[tbl-ic-trans-detail]] (300/301) ผ่าน `item_code = code`
- ← [[tbl-cb-trans-detail]] (`doc_type = 4`) ผ่าน `trans_number = code`
- → [[tbl-gl-chart-of-account]] ผ่าน `chart_of_account`
- เอกสาร GL ที่เกิดขึ้นอธิบายใน [[acc-gl-template-engine]]

## ใครเขียน / ใครอ่าน

- **เขียน**: เป็น master ที่แก้ผ่านเส้นทาง master-data เดิม — หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011) ซึ่งต่างจากตารางเงิน `cb_trans*`; รายละเอียดการบันทึก master ดู [[proc-master-data]].
- **อ่าน**: รายงานเงินสดย่อยทั้งชุด (`report_menu_cb.go:329-335,692-737`) และชื่อวงเงินในรายงานเบิก/คืน (ใช้ `item_name` ถ้ามี ไม่งั้นดึง `pc.name_1`) ; GL template ชุดเงินสดย่อย (`gl_template.go:202`).
- ไม่มีที่ไหนใน backend ที่อัปเดต `balance_money` ตามการเคลื่อนไหว (ที่อ่านพบ) — เป็นยอดยกมาเท่านั้น.

## ข้อควรระวัง

- `balance_money` **ไม่ใช่ยอดคงเหลือปัจจุบัน** เป็นยอดยกมา; ต้องบวกเคลื่อนไหวเสมอ.
- ความหมายของเครื่องหมาย 300 (−) / 301 (+) ตรงข้ามกันในมุมวงเงินสดย่อย: เบิกเงินออกจากวง = ลด.
- กรองเอกสารยกเลิก: ใช้ `last_status = 0` ทั้งหัวและบรรทัดของ 300/301 และเงื่อนไข parent OK ของ `cb_trans_detail` (`report_menu_cb.go:154,681`) — ไม่เช่นนั้นยอดจะนับเอกสารที่ยกเลิกแล้ว.
- ตารางนี้อยู่ในกลุ่ม master ที่มี allow-list ต่างจากตารางเงิน — แต่การเปลี่ยน `code` ต้องตามอ้างอิงใน `ic_trans_detail.item_code` เอง (ไม่เห็นรายการ `cb_petty_cash` ใน `codeRef` ของ `workflow.go` → ไม่ชัดจากโค้ดว่ามี tool เปลี่ยนรหัสอัตโนมัติ).

## ที่มาในโค้ด

- `backend/internal/application/process/report_menu_cb.go:154,318-335,667-740`
- `backend/internal/application/process/gl_template.go:202`
- `backend/internal/application/process/doc_flow_graph.go:217-219`
