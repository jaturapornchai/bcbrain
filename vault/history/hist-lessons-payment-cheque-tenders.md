---
title: "บทเรียนแท็บชำระเงิน เช็ค และช่องทางรับ/จ่าย (Payment Tab, Cheque & Tenders)"
tags: [history, lesson, payment, cheque, tender, bill]
aliases: ["ยอดการจ่ายเงินไม่สมบูรณ์", "ป้อนยอดชำระเกิน", "ห้ามวางบิลซ้ำ", "payCompleteCheck", "checkPayTotal", "RebuildChequeStatus", "cb_chq_list status"]
sources: ["backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/pay_check.go:57", "backend/internal/application/process/pay_check.go:86", "backend/internal/application/process/pay_check.go:142", "backend/internal/application/process/pay_check.go:168", "backend/internal/application/process/pay_check.go:221", "backend/internal/application/process/pay_check.go:263", "backend/internal/application/process/pay_check_test.go:26", "backend/internal/application/process/pay_check_test.go:106", "backend/internal/application/process/pay_other.go:60", "backend/internal/application/process/pay_other.go:133", "backend/internal/application/process/cheque.go:32", "backend/internal/application/process/cheque.go:68", "backend/internal/application/process/trans.go:619", "backend/internal/application/process/trans.go:916", "backend/internal/application/process/trans.go:1311", "backend/internal/application/process/docs.go:387", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/gl_pay_other.go:17", "AGENTS.md:50"]
---

# บทเรียนแท็บชำระเงิน เช็ค และช่องทางรับ/จ่าย

แท็บชำระเงินเก็บเงินสด เงินโอน PromptPay เช็ค บัตร ภาษีหัก ณ ที่จ่าย และรายได้/ค่าใช้จ่ายอื่น ลงตาราง `cb_trans` / `cb_trans_detail` ถ้าผลรวมช่องทางไม่เท่ายอดเอกสาร หรือบิลถูกชำระเกินยอดค้าง สมุดเงินสดกับบัญชีลูกหนี้/เจ้าหนี้จะไม่ตรงกับเอกสาร

## อะไรพังได้
- **ผลรวมช่องทางไม่เท่ายอดสุทธิ**: ถ้าเทียบกันคนละจุดทศนิยม (บริษัทที่ตั้ง `item_amount_decimal` ไม่ใช่ 2) ยอดจะคลาดกัน 1 หน่วย
- **ข้อความเตือนไม่ตรงหน้าจอ**: ยอดศูนย์ถูกแสดงเป็นว่างแทน 0.00 ผู้ใช้จึงไม่รู้ว่ายอดชำระเป็นศูนย์
- **ชำระบิลเกินยอดค้าง**: ยอดคงเหลือที่ client ส่งมาเชื่อไม่ได้ และสองเอกสารที่ชำระบิลเดียวกันพร้อมกันจะเห็นยอดเต็มทั้งคู่
- **วางบิลซ้ำ**: ใบวางบิลเดิมถูกนำไปวางใหม่บนเอกสารอีกใบ
- **รหัสรายได้/ค่าใช้จ่ายอื่นไม่มีในรายการ**: แถวถูกบันทึกแต่ GL หารหัสบัญชีไม่เจอ
- **สถานะเช็คค้าง**: เช็คมีเอกสารต่อเนื่อง (ฝาก คืน เปลี่ยน) แต่สถานะใน `cb_chq_list` ไม่ถูกคำนวณใหม่
- **GL ลงเงินสดทั้งยอด**: ทางสำรองไม่แยกเช็ค บัตร และภาษีหัก ณ ที่จ่าย

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| รู้ว่าเอกสารไหนมีแท็บชำระ | `backend/internal/application/process/pay_check.go:36` `payTabEnabled` | ชนิดเอกสารที่ผูกกับ `inquiry_type` เปิดแท็บเฉพาะบางค่า (เช่น flag 11 ใช้ 0, flag 16/317 ใช้ 2 หรือ 3); ถ้าปิดแท็บ `trans.go:916` ล้างแถว `cb_trans` เดิมแทนการตรวจ |
| ยอดช่องทางต้องเท่ายอดสุทธิ | `pay_check.go:57` `payCompleteCheck` | ช่องทาง + ภาษีหัก ณ ที่จ่ายจาก `gl_wht_list` + รายได้อื่น ต้องเท่ายอดสุทธิ + ค่าใช้จ่ายอื่น แล้วเขียน `total_tax_at_pay` / `total_amount_pay` ใน transaction เดียวกัน; เรียกจาก `trans.go:919` และ `backend/internal/application/process/docs.go:387` |
| เทียบที่จุดทศนิยมของบริษัท | `pay_check.go:142` `checkPayTotal` | ปัดทุกส่วนครึ่งขึ้นที่ `amountDec` ก่อนบวก ข้อความเตือนมีจุลภาคและคง 0.00; เทส `pay_check_test.go:26` (0.1+0.2, ขาด/เกินหนึ่งสตางค์, จุดครึ่ง, ยอดศูนย์) |
| ช่องทางหลายแถว | `pay_check.go:86` `sumPayTenderRows`; `trans.go:1311` `TransPay` | โอน PromptPay เช็ค บัตร ส่งเป็นหลายแถวได้ รวมที่ทศนิยมเดียวกับที่เก็บ และปฏิเสธยอดติดลบ |
| รายได้/ค่าใช้จ่ายอื่น | `pay_other.go:60` `parsePayOther`, `:133` `checkPayOtherCodes` | แถวไม่มีรหัสถูกตัดทิ้ง รหัสที่ไม่มีในรายการรายได้/ค่าใช้จ่ายถูกปฏิเสธเป็นข้อความไทย |
| บิลห้ามชำระเกิน/ซ้ำ | `pay_check.go:221` `checkBills`, `:263` `payExceedsBalance` | หนี้ (ยอดบวก) รับชำระ 0..ยอดค้าง ใบลดหนี้ (ยอดลบ) รับ ยอดค้าง..0 ยอดค้างศูนย์รับชำระไม่ได้; ใบวางบิลที่วางแล้วถูกปฏิเสธเมื่อบริษัทเปิดตัวเลือก; เทส `pay_check_test.go:106` |
| ยอดค้างบิลคำนวณฝั่งหลังบ้าน | `pay_check.go:168` `billSaveCheck` | ล็อก `pg_advisory_xact_lock` ต่อเลขบิล (เรียงลำดับกัน deadlock) แล้วหายอดค้างจากหนี้และการชำระที่เก็บไว้ |
| สถานะเช็ค rebuild ได้ | `backend/internal/application/process/cheque.go:32` `chequeStatusSQL`, `:68` `RebuildChequeStatus` | สถานะมาจากเอกสารล่าสุดของแต่ละเช็ค/บัตร/wallet; รันซ้ำแล้วอัปเดต 0 แถว; `trans.go:619` เรียกหลังบันทึกเอกสารเช็ค |
| GL แยกช่องทาง | `backend/internal/application/process/service.go:1871` `payTenders`, `gl_pay_other.go:17` `payOtherGL` | ทางสำรองอ่าน `cb_trans` แยกเงินสด โอน เช็ค บัตร ภาษีหัก ณ ที่จ่าย; รายได้/ค่าใช้จ่ายอื่นคืน error ถ้าอ่านไม่ได้ |

## กฎที่ต้องจำ
- เทียบยอดที่จุดทศนิยมของบริษัท ไม่ใช่ 2 ตายตัว และต้องเป็นยอดชุดเดียวกับที่ `payStmts` (`trans.go:1338`) เก็บ
- ยอดค้างบิลต้องหาใหม่ในหลังบ้านภายใต้ล็อก ห้ามเชื่อค่าที่หน้าจอส่งมา
- ภาษีหัก ณ ที่จ่ายนับเป็นยอดที่ชำระแล้ว ถ้าบวกซ้ำกับเงินสดเต็มยอดจะถูกปฏิเสธ
- เพิ่มช่องทางใหม่ = แก้ `payCompleteCheck`, `payStmts` และทางสำรอง GL พร้อมกัน แล้วเพิ่มเทส
- สถานะเช็คเป็นผลที่ rebuild ได้ (`AGENTS.md:50`) แก้ที่เอกสารต้นทางแล้วคำนวณใหม่ ไม่แก้ `cb_chq_list.status` ตรง ๆ

## ที่มาในโค้ด
- `backend/internal/application/process/pay_check.go:36-165` เปิด/ปิดแท็บ ตรวจยอดรวมและช่องทาง
- `backend/internal/application/process/pay_check.go:168-275` ตรวจบิล ล็อก เกณฑ์ชำระเกิน
- `backend/internal/application/process/cheque.go:32-80` คำนวณสถานะเช็คใหม่
- ดูเพิ่ม: [[hist-lessons-gl-posting-balance]] · [[hist-lessons-rounding-decimal]] · [[hist-lessons-concurrency-advisory-locks]] · [[history-overview]]
