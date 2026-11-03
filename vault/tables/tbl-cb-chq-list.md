---
title: "ทะเบียนเช็ค/บัตรเครดิต/กระเป๋าเงิน (cb_chq_list)"
tags: [tables, cb]
aliases: ["cb_chq_list", "ทะเบียนเช็ครับ", "ทะเบียนเช็คจ่าย", "ทะเบียนบัตรเครดิต", "cheque register"]
sources: ["backend/internal/application/process/trans.go:1543", "backend/internal/application/process/cheque.go:32", "backend/internal/application/process/cheque_forward.go:5", "backend/internal/application/process/report_menu_cb.go:152", "backend/internal/application/process/docs.go:432", "backend/internal/application/process/trans_save_rules.go:609"]
---

# ทะเบียนเช็ค / บัตรเครดิต `cb_chq_list`

ทะเบียนกลางของ **เครื่องมือชำระเงินที่ต้องติดตามสถานะต่อ** — หนึ่งแถวต่อหนึ่งเช็ค/บัตร/รายการกระเป๋าเงิน. **แถวไม่ได้ถูกกรอกโดยตรงจากหน้าจอทะเบียน** (หน้าจอทะเบียนเช็คเป็น view-only: `errChequeRegisterReadOnly` `docs.go:432`, `docKindCheque` `docs.go:21`) แต่ถูก *สร้างจาก* [[tbl-cb-trans-detail]] ด้วย SQL `chqListFromPaySQL` (`trans.go:1543-1555`) แล้ว `status` ถูก *คำนวณ* ใหม่จากเอกสารเช็คทุกครั้งที่มีการเปลี่ยนแปลง (`cheque.go:32-66`).

แนวคิดเช็คโอน/ฝาก/ผ่าน/คืนในเชิงบัญชี: [[acc-cheque-transfer]]; แท็บชำระเงินที่เป็นต้นทาง: [[acc-payment-tab]].

## ชนิด (`chq_type`)

| chq_type | ความหมาย | ที่มา |
|---|---|---|
| 1 | เช็ครับ | `trans.go:1544-1546` (`trans_number_type = 1`) |
| 2 | เช็คจ่าย | ค่า default ของ CASE (`trans_number_type` อื่น) |
| 3 | บัตรเครดิต | `doc_type = 3` ของ detail |
| 21 | กระเป๋าเงิน/e-wallet | มีในตรรกะคำนวณสถานะ (`cheque.go:23-30`) แต่ไม่เห็น INSERT ที่สร้างแถวชนิดนี้ในโค้ดที่อ่าน (`chqListFromPaySQL` สร้างได้เฉพาะ 1, 2, 3) — ที่มา "ไม่ชัดจากโค้ด" |

## สถานะ (`status`) — ไม่ได้กรอกเอง แต่คำนวณ

`chequeStatusSQL` (`cheque.go:32-65`) หาเอกสารเช็ค **ล่าสุดที่ยังใช้งาน** (`ic_trans_detail.last_status = 0`, จับคู่ด้วย `doc_ref` + `ref_row = doc_line_number` + เลขเช็ค) แล้วแปลง `trans_flag` เป็นสถานะ:

| chq_type | flag เอกสารที่กระทบ → status |
|---|---|
| 1 เช็ครับ | 405 (ยกมา) → 0; 410 → 1 นำฝาก; 411 → 2 ผ่าน; 412 → 3 รับคืน; 413 → 4 ยกเลิก; 414 → 6 คืนนำเข้าใหม่; 416 → 7 เปลี่ยนเช็ค; 418 → 8 ตั้งหนี้ใหม่ |
| 2 เช็คจ่าย | 406 (ยกมา) → 0; 451 → 2; 452 → 4; 453 → 3; 456 → 7 |
| 3 บัตรเครดิต | 461 → 1; 462 → 2 |
| 21 กระเป๋าเงิน | 463 → 1 |

ถ้าไม่มีเอกสารที่ตรง → 0 (เช็คในมือ / บัตรปกติ). ป้ายสถานะที่รายงานแสดง: 0 เช็คในมือ, 1 เช็คนำฝาก, 2 เช็คผ่าน, 3 เช็ครับคืน, 4 เช็คยกเลิก, 5 เช็คขายลด, 6 เช็คคืนนำเข้าใหม่, 7 เช็คเปลี่ยน, 8 เช็คตั้งหนี้ใหม่ (`report_menu_cb.go:152`) — ค่า 5 ไม่มี flag ที่ map มาในฟังก์ชันคำนวณนี้ ("ไม่ชัดจากโค้ดว่าใครตั้ง").

## คอลัมน์สำคัญ

จาก INSERT `trans.go:1543-1555`:

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `chq_number` | เลขที่เช็ค/บัตร/อ้างอิงกระเป๋าเงิน (key ธุรกิจร่วมกับ `doc_ref`) | match สถานะ `cheque.go:32-65`; ตัวเลือกเช็ค `cheque.go:291-300` |
| `doc_ref` | เลขที่เอกสารที่ทำให้เกิดแถว (= `cb_trans_detail.doc_no`) | `trans.go:1543`; ลบด้วย `doc_ref + trans_flag` ที่ `docs.go:493`, `cheque_forward.go:21` |
| `doc_line_number` | ลำดับบรรทัดใน detail (= `line_number`) — ใช้จับคู่ `ic_trans_detail.ref_row` | `trans.go:1543`; `cheque.go:32-65` |
| `trans_type`, `trans_flag` | ฝั่งและชนิดเอกสารต้นทาง | `trans.go:1543` |
| `chq_get_date` | วันที่รับ/จ่ายเช็ค (= `doc_date`) | `trans.go:1543`; รายงานทะเบียน |
| `chq_due_date` | วันครบกำหนด (ถ้าไม่ระบุใช้ `doc_date`) | `trans.go:1543`; ตัวเลือกเช็ค `cheque.go:291` |
| `ap_ar_code`, `ap_ar_type` | ลูกหนี้/เจ้าหนี้เจ้าของเช็ค ([[tbl-ar-customer]] / [[tbl-ap-supplier]]) | `trans.go:1543`; ตัดเครดิต `trans_save_rules.go:609-611` |
| `pass_book_code` | สมุดบัญชีบริษัท ([[tbl-erp-pass-book]]) | `trans.go:1543`; `cheque.go:293` |
| `bank_code`, `bank_branch` | ธนาคาร/สาขา ([[tbl-erp-bank]]) | `trans.go:1543`; GL template `gl_template.go:852` |
| `amount`, `sum_amount` | จำนวนเงิน (ถ้า detail ไม่ใช่บัตรและ `sum_amount <> 0` ใช้ `sum_amount`) | `trans.go:1544-1550` |
| `charge` | ค่าธรรมเนียม (บัตร) | `trans.go:1543` |
| `no_approved`, `credit_card_type` | เลขอนุมัติ / ประเภทบัตร | `trans.go:1543`; GL template `gl_template.go:854` |
| `external_chq` | เช็คภายนอก (ไม่ผ่านระบบเรา) | `trans.go:1543` |
| `remark` | หมายเหตุ | `trans.go:1543` |
| `status` | สถานะ (ตารางด้านบน) — INSERT ด้วย 0 แล้วคำนวณซ้ำ | `trans.go:1550`; `cheque.go:33` |

## ความสัมพันธ์

- ← [[tbl-cb-trans-detail]] (`doc_type IN (2,3)`, `trans_number <> ''`, `chq_on_hand = 0`, `last_status = 0` ตามเงื่อนไข `chqListFromPaySQL`); ← [[tbl-ap-ar-trans]] ผ่าน `doc_ref`
- ↔ [[tbl-ic-trans-detail]]: เอกสารเช็ค (410–418, 451–456, 461–463) อ้างกลับด้วย `doc_ref` + `ref_row` + `chq_number` เพื่อกำหนด `status`
- → [[tbl-erp-pass-book]], [[tbl-erp-bank]]

## ใครเขียน / ใครอ่าน

- **สร้างแถว**: `chqListFromPaySQL` ถูกเรียกหลังบันทึก pay tab (`trans.go:1535`), เช็คยกมา 405/406 (`cheque_forward.go:5-50`, `:50`)
- **ลบแถว**: ทุก save ของเอกสาร (idempotent) `docs.go:493`; `cheque_forward.go:21`
- **คำนวณ status**: `RebuildChequeStatus` / `RebuildCheque` (`cheque.go:66,328-344`); ใช้ `SyncTransferPair` (`cheque.go:97-101`) สร้างแถวคู่ 420 จากเอกสารโอน 422 ก่อน
- **อ่าน**: ตัวเลือกเช็คสำหรับเอกสารเช็ค (`cheque.go:286-300`), ทะเบียนเช็ค/บัตร (`report_menu_cb.go:472-600`), flow graph (`doc_flow_graph.go:301-320,522-598,760,1191`), ตรวจ/ซ่อมระบบ (`sysproc_ic_checks_data.go:71-74` เติม `doc_ref` ให้บรรทัด 451–456/430–436 ที่ว่าง), AI copilot กระทบยอดธนาคาร (`ai_copilot.go:227-235,508-513`), dashboard (`dashboard/handler.go:131` รวม `amount` ทั้งตาราง), GL template (`gl_template.go:852-854`)
- **เครดิตลูกหนี้**: `creditChqSQL` (`trans_save_rules.go:609-611`) รวม `amount` ของ `chq_type = 1` ของลูกค้าที่สถานะไม่ใช่ 2/7/8 (ผ่าน/เปลี่ยน/ตั้งหนี้ใหม่) เป็นเช็คในมือที่นับกับวงเงินเครดิต ([[tbl-ar-customer-detail]])

## ข้อควรระวัง

- **ห้ามแก้ `status` ตรง** — ค่าถูกคำนวณจาก `ic_trans_detail` ล่าสุด หากแก้มือจะถูกทับเมื่อ rebuild (`cheque.go:66`); ถ้าเอกสารเช็คถูกยกเลิก สถานะย้อนกลับเอง.
- ตารางเงิน: แก้ผ่าน `/api/process` เท่านั้น (`write_policy.go:24` มี `cb_chq_list`).
- คู่ `(chq_number, doc_ref)` ไม่ใช่ unique constraint ที่เห็นในโค้ด — เช็คเลขเดียวกันอาจมีหลายแถวถ้ารับหลายครั้ง; การจับคู่สถานะใช้ `doc_ref` + `ref_row` ประกอบ.
- ถ้าเลือกเช็คเปลี่ยน/ตั้งหนี้ใหม่ (416/418/456) ต้องส่งรหัสลูกค้า `CustCode` ไปด้วย เพราะ `ap_ar_code` ของแถวเดิมใช้เป็นเงื่อนไข (`cheque.go:197`).
- `cb_trans_detail.chq_on_hand <> 0` ทำให้ไม่สร้างแถวทะเบียน (`trans.go:1555`); ความหมายของ `chq_on_hand` เองไม่ชัดจากโค้ดที่อ่าน.

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:1535,1543-1555`
- `backend/internal/application/process/cheque.go:16-66,97-101,197,286-300,328-344`
- `backend/internal/application/process/cheque_forward.go:5-50`
- `backend/internal/application/process/docs.go:21,33,432,493`
- `backend/internal/application/process/report_menu_cb.go:152,472-600`
- `backend/internal/application/process/trans_save_rules.go:609-611`
- `backend/internal/application/process/doc_flow_graph.go:301-320,522-598,760,1191`
- `backend/internal/application/process/sysproc_ic_checks_data.go:71-74`
- `backend/internal/application/process/gl_template.go:852-854`
- `backend/internal/application/process/ai_copilot.go:227-235,508-513`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:131`
- `backend/internal/domain/query/write_policy.go:24`
