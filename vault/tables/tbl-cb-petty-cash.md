---
title: "วงเงินสดย่อย (cb_petty_cash)"
tags: [tables, cb]
aliases: ["cb_petty_cash", "เงินสดย่อย", "ทะเบียนวงเงินสดย่อย", "petty cash"]
sources: ["scripts/sql/02_data_schema.sql:2130","backend/internal/application/process/report_menu_cb.go:667","backend/internal/application/process/report_menu_cb.go:692","backend/internal/application/process/gl_template.go:202","backend/internal/application/process/service.go:2218","backend/internal/domain/query/write_policy_legacy.go:16","frontend/src/config/schemas/icMasterSchemas.ts:758","backend/internal/application/process/doc_flow_graph.go:217","backend/internal/application/process/workflow.go:93"]
---

# วงเงินสดย่อย `cb_petty_cash`

ตารางหลัก (master) ของ **วงเงินสดย่อยแต่ละวง** — หนึ่งแถวต่อหนึ่งวง (เช่น เงินสดย่อยของแผนก/สาขา). ตัวเลขเคลื่อนไหวไม่ได้เก็บในตารางนี้ แต่คำนวณจากเอกสาร 300/301 และแถว `cb_trans_detail.doc_type = 4` แล้วรวมกับ `balance_money` ที่เก็บในตารางนี้.

โครงสร้างตารางมาจาก DDL `scripts/sql/02_data_schema.sql:2130-2148` (มีดัชนี `idx_cb_petty_cash_code` บน `code`); ไม่มี `CREATE TABLE` ในโค้ด Go.

เอกสารที่เกี่ยวข้อง (ดู [[acc-trans-flag-map]]):

| flag | ชื่อเมนูในระบบ | รายงานนับเป็น |
|---|---|---|
| 300 | "คืน/ลด วงเงินสดย่อย" (`doc_flow_graph.go:217`; หน้าจอ `transMenuMap.ts:1798-1812`) | ยอดเบิก ติดลบ (`report_menu_cb.go:671-672`) |
| 301 | "รับ/เพิ่ม วงเงินสดย่อย" (`doc_flow_graph.go:218`; `transMenuMap.ts:1813-1827`) | ยอดคืน บวก (`report_menu_cb.go:671-672`) |
| 302, 303 | ยกเลิก 300 / ยกเลิก 301 (`doc_flow_graph.go:219-220`) | ไม่อยู่ใน CTE (รายงานนับเฉพาะ 300/301 ที่ `last_status = 0`) |

**ทิศทางของรายงานกับ GL ไม่ตรงกัน**: รายงานนับ 300 เป็นลบและ 301 เป็นบวก (`report_menu_cb.go:671-672`) แต่ใบ GL ของ 300 ลง Dr บัญชีเงินสดย่อย และ 301 ลง Cr (`service.go:2226-2230`) — ไม่ชัดจากโค้ดว่าตั้งใจ. การตัดจ่ายผ่านแท็บชำระเงินเป็น `cb_trans_detail.doc_type = 4` ([[tbl-cb-trans-detail]]).

## คอลัมน์

ชนิดจาก DDL `02_data_schema.sql:2130-2145`; "ใช้ที่ไหน" คือที่ที่โค้ดอ่านจริง.

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสวงเงินสดย่อย (key ธุรกิจ, `varchar(25)`) — `ic_trans_detail.item_code` ของ 300/301 และ `cb_trans_detail.trans_number` ของ doc_type 4 อ้างค่านี้ | `report_menu_cb.go:329`, `:670`, `:676`, `:692` |
| `name_1` | ชื่อวงเงินสดย่อย | `report_menu_cb.go:329`, `:694`, `:723` |
| `balance_money` | ยอดยกมาของวง — จุดตั้งต้นของรายงานสถานะ/เคลื่อนไหว | `report_menu_cb.go:695`, `:698`, `:720`, `:734` |
| `chart_of_account` | รหัสผังบัญชีของวงเงินสดย่อย ใช้ตอนลง GL ([[tbl-gl-chart-of-account]]) | `gl_template.go:202`, `:571-580`; `service.go:2222` |
| `credit_money` | "วงเงินสดย่อย" (ฟอร์ม master) — ไม่มีโค้ด Go อ่าน | `icMasterSchemas.ts:764` |
| `currency_code`, `remark` | สกุลเงิน, หมายเหตุ — แก้ในฟอร์ม master เท่านั้น | `icMasterSchemas.ts:766-782` |
| `name_2`, `status`, `guid_code` | อยู่ใน DDL ไม่มีโค้ด Go อ่าน | `02_data_schema.sql:2136`, `:2141-2142` |

## วิธีคำนวณยอดเคลื่อนไหว (CTE `pm`)

`cbmPettyCTE` (`report_menu_cb.go:667-683`) สร้างรายการเคลื่อนไหวต่อ `code` แบบมีเครื่องหมาย:

| calc | ที่มา | เครื่องหมาย |
|---|---|---|
| 1 เบิก | `ic_trans` 300 + `ic_trans_detail.sum_amount` (`last_status = 0` ทั้งหัวและบรรทัด `:674`) | − |
| 2 คืน | `ic_trans` 301 (ตัวกรองเดียวกัน) | + |
| 3 ตัดจ่าย | `cb_trans_detail` `doc_type = 4` ที่ flag อยู่ในชุดฝั่งจ่าย `cbmPettyPay` (`:157`) ใช้ `amount` | − |
| 4 รับ | `cb_trans_detail` `doc_type = 4` ที่ flag อยู่ในชุดฝั่งรับ `cbmPettyRcv` (`:158`) | + |

- ยอดยกมา = `balance_money` + Σ การเคลื่อนไหวก่อนวันเริ่ม; ยอดยกไป = `balance_money` + Σ ถึงวันสิ้นสุด (รายงานสถานะ `cbmRunPettyStatus` `report_menu_cb.go:685-706`).
- รายงานเคลื่อนไหว `cbmRunPettyMovement` (`:708-743`): แบบสรุปรวมยอดรับ/ตัดจ่ายต่อวง (`:733-740`), แบบรายละเอียดคำนวณยอดคงเหลือสะสมต่อบรรทัดด้วย window `SUM(...) OVER` (`:718-724`).
- แถว `doc_type = 4` นับเฉพาะเมื่อเอกสารเจ้าของไม่ถูกยกเลิก (`cbmParentOK` `:155`, ใช้ที่ `:680`): 19/239 ตรวจ `ap_ar_trans.last_status`, ที่เหลือตรวจ `ic_trans.last_status`.

## ความสัมพันธ์

- ← [[tbl-ic-trans]] / [[tbl-ic-trans-detail]] (300/301) ผ่าน `item_code = code`
- ← [[tbl-cb-trans-detail]] (`doc_type = 4`) ผ่าน `trans_number = code`
- → [[tbl-gl-chart-of-account]] ผ่าน `chart_of_account`
- เอกสาร GL ที่เกิดขึ้นอธิบายใน [[acc-gl-template-engine]]; กลุ่มตาราง: [[tbl-group-cb]]

## ใครเขียน / ใครอ่าน

- **เขียน**: ไม่มี `INSERT`/`UPDATE` ของ `cb_petty_cash` ในโค้ด Go. แถวถูกแก้จากหน้าจอ master กำหนดวงเงินสดย่อย (`menu_petty_cash` `icMasterSchemas.ts:758-784`) ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011; `cb_petty_cash` อยู่ที่ `write_policy_legacy.go:16`) ซึ่งต่างจากตารางเงิน `cb_trans*`; รายละเอียดการบันทึก master ดู [[proc-master-data]].
- **อ่าน**: รายงานเบิก/คืนเงินสดย่อย ดึงชื่อวงเมื่อบรรทัดไม่มี `item_name` (`report_menu_cb.go:329`, `:334-335`); รายงานสถานะและเคลื่อนไหว (`:685-743`); GL template รายการ "เงินสดย่อย" (key = `trans_number`) และ "รายวันเงินสดย่อย" (key = `pass_book_code`) หาผังบัญชีจากตารางนี้ (`gl_template.go:571-580`); การลง GL ของเอกสาร 300/301 หาผังบัญชีของรหัสเงินสดย่อยบรรทัดแรกด้วยคิวรีเดียวกัน (`service.go:2218-2224`); หน้าจอเอกสาร 300/301 ใช้ค้นรหัส (`transMenuMap.ts:1811`, `:1826`).
- ไม่มีโค้ดที่อัปเดต `balance_money` ตามการเคลื่อนไหว — เป็นยอดยกมาเท่านั้น.

## ข้อควรระวัง

- `balance_money` **ไม่ใช่ยอดคงเหลือปัจจุบัน** แม้ฟอร์ม master ตั้งป้ายว่า "ยอดคงเหลือ" (`icMasterSchemas.ts:765`) — รายงานถือเป็นยอดยกมาแล้วบวกเคลื่อนไหวเสมอ (`report_menu_cb.go:695`, `:698`).
- แถว `cb_trans_detail.doc_type = 4` ไม่มีโค้ดเว็บเขียน ([[tbl-cb-trans-detail]]) — ส่วนตัดจ่าย/รับ (calc 3, 4) ของรายงานจึงนับเฉพาะแถวที่อยู่ในฐานข้อมูลอยู่แล้ว.
- เอกสาร 300/301 ที่ยกเลิกต้องมี `last_status ≠ 0` ทั้งหัวและบรรทัด ไม่เช่นนั้นยอดจะถูกนับ (`report_menu_cb.go:674`).
- การเปลี่ยน `code` ต้องตามแก้ `ic_trans_detail.item_code` และ `cb_trans_detail.trans_number` เอง — เครื่องมือเปลี่ยนรหัสใน `workflow.go` (`codeRef` `:93-99`) ไม่มีรายการของ `cb_petty_cash`.

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:2130-2148` DDL และดัชนี
- `backend/internal/application/process/report_menu_cb.go:155,157-158,329,334-335,667-743`
- `backend/internal/application/process/gl_template.go:202,571-580`
- `backend/internal/application/process/service.go:2218-2230`
- `backend/internal/application/process/doc_flow_graph.go:217-220`
- `backend/internal/application/process/workflow.go:93-99`
- `backend/internal/domain/query/write_policy_legacy.go:5-16`
- `frontend/src/config/schemas/icMasterSchemas.ts:758-784`
- `frontend/account/tabs/transMenuMap.ts:1798-1827`
