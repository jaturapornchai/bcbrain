---
title: "erp_credit_approved_logs / erp_credit_request — ขออนุมัติเครดิต"
tags: [tables, erp, credit, approval, company-db]
aliases: ["erp_credit_approved_logs", "erp_credit_request", "อนุมัติเครดิต", "เกินวงเงิน", "credit_status", "approve_status"]
sources: ["backend/internal/application/process/trans_credit.go:198", "backend/internal/application/process/trans_credit.go:100", "backend/internal/application/process/trans_save_rules.go:579", "backend/internal/application/process/doc_flow.go:70", "backend/internal/application/process/doc_flow.go:284", "backend/internal/application/process/sysproc_ic_checks_data.go:92", "scripts/sql/02_data_schema.sql:2701", "scripts/sql/16_fix_bcdemo_corrupt_and_populate_all.sql:425"]
---

# erp_credit_approved_logs และ erp_credit_request

คู่ตารางของขั้นตอน "ใบสั่งจอง/ใบสั่งขายเกินวงเงินเครดิต → ขออนุมัติ → อนุมัติ" (Company DB) นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql` (`erp_credit_approved_logs` บรรทัด 2701-2717, `erp_credit_request` บรรทัด 2719-2740) และซ้ำใน `02b_sync_existing_db.sql` (บรรทัด 2599, 2615) โค้ด Go ไม่ได้สร้างสองตารางนี้ DDL ไม่ประกาศ FK มีแต่ดัชนี (`doc_no`, `trans_flag`) ของทั้งสองตาราง และ (`doc_date`, `trans_flag`) ของ `erp_credit_approved_logs` (02_data_schema.sql:2716-2717, 2740)

## erp_credit_request — คำขออนุมัติเครดิต
เขียนที่ trans_credit.go:198-210 เมื่อบันทึกใบสั่งจอง (trans_flag 34) หรือใบสั่งขาย (36) แล้วต้องพักเอกสารเพื่อรออนุมัติ: ตั้ง `ic_trans.is_hold = 1` ลบคำขอและบันทึกการอนุมัติเก่าของเอกสารนั้น แล้ว INSERT คำขอใหม่ (trans_credit.go:201-209) ทำเฉพาะเมื่อเปิด `erp_option.sr_ss_credit_check` (trans_credit.go:34-39; trans_save_rules.go:39; [[tbl-erp-option]]) ตัวเลขเงินคำนวณด้วย `big.Rat` และส่งเข้าคอลัมน์ `numeric` เป็นข้อความทศนิยม 6 ตำแหน่ง (trans_credit.go:199, 206-209)

เอกสารจะถูกพักเมื่อ (planOrderCredit, trans_credit.go:147-176): สั่งแบบเครดิต (`inquiry_type` 0 หรือ 2) และเกินวงเงิน ระบบถามยืนยันก่อนพัก (ถ้าเปิด `check_credit_sale_reserve_sale_order` จะปฏิเสธการบันทึกแทน) ไม่เกินวงเงินจะอนุมัติอัตโนมัติ (`ic_trans.auto_approved = 1`) ส่วนสั่งแบบเงินสด (`inquiry_type` 1 หรือ 3) ใบสั่งจองพักเมื่อมีคำขอ ใบสั่งขายอนุมัติอัตโนมัติ

| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `doc_no`, `trans_flag` | เลขที่/ชนิดเอกสารที่ขอ (34 หรือ 36) — ลบแล้วเขียนใหม่ทุกครั้งที่บันทึกแล้วพัก | trans_credit.go:202, 204; 02_data_schema.sql:2723-2724 |
| `credit_money` | วงเงินเครดิตของลูกค้า (`ar_customer_detail.credit_money`) ถ้าเปิด `credit_sale_include_deposit` จะบวกมัดจำคงเหลือของลูกค้าเข้าไปแล้ว | trans_credit.go:121-124, 135, 236; 02_data_schema.sql:2725 |
| `credit_money_max` | `ar_customer_detail.credit_money_max` — เก็บประกอบคำขอ ไม่ถูกใช้คำนวณยอดเกินในโค้ดนี้ | trans_credit.go:106, 236; 02_data_schema.sql:2726 |
| `chq_amount` | ยอดเช็ครับคงค้างของลูกค้า นับเมื่อเปิด `ar_credit_chq_outstanding` มิฉะนั้นเป็น 0 | trans_credit.go:230-233; trans_save_rules.go:610; 02_data_schema.sql:2727 |
| `advance_amount` | เป็น 0 เสมอ — หน้าจอสั่งจอง/สั่งขายในเว็บไม่มีช่องเอกสารมัดจำอ้างอิง จึงไม่คำนวณ | trans_credit.go:19-22, 113, 135; 02_data_schema.sql:2728 |
| `ar_balance_amount` | ยอดลูกหนี้คงค้าง (ไม่รวมเอกสารนี้) | trans_credit.go:238; trans_save_rules.go:599; 02_data_schema.sql:2729 |
| `sr_amount`, `ss_amount` | ยอดคงเหลือของใบสั่งจอง (34) และใบสั่งขาย (36) ที่ยังเปิดของลูกค้า หักส่วนที่ถูกดึงไปออกเอกสารถัดไปแล้ว ตัดเป็นบาทเต็ม | trans_credit.go:216-221, 238; 02_data_schema.sql:2730-2731 |
| `bill_amount` | ยอดรวมของเอกสารนี้ | trans_credit.go:106; 02_data_schema.sql:2732 |
| `over_amount`, `over_percent` | วงเงินปกติ: ยอดเกิน = (ยอดบิล + ลูกหนี้ + สั่งจอง + สั่งขาย + เช็ค) − วงเงิน และเปอร์เซ็นต์ = ยอดเกิน ÷ วงเงิน × 100 ปัด 2 ตำแหน่ง; ลูกค้าไม่มีวงเงิน (วงเงิน ≤ 1) หรือสั่งเงินสด: ยอดเกิน = ยอดบิล − advance และเปอร์เซ็นต์ = advance ÷ ยอดบิล × 100 (advance เป็น 0 จึงได้ 0) | trans_credit.go:107-119, 128, 135-136; 02_data_schema.sql:2733-2734 |
| `credit_status` | สถานะเครดิตของลูกค้า (`ar_customer_detail.credit_status`) ณ ตอนขอ: 0 = เกินวงเงิน ลูกค้าเปิดอยู่, 2 = ลูกค้าปิดชั่วคราว (คำถามยืนยันต่างกันตามค่านี้) ส่วนสถานะ 1 "ปิดสถานะเครดิต" ถูกปฏิเสธก่อนสร้างคำขอในเส้นทางสั่งแบบเครดิต | trans_credit.go:106, 108-110, 125-127, 160-164; 02_data_schema.sql:2735 |
| `user_approve_status`, `user_approve_status_date` | อยู่ใน DDL — ไม่พบโค้ด Go อ่านหรือเขียน | 02_data_schema.sql:2736-2737 |

อ่านกลับที่ trans_save_rules.go:579-595 (`refOrdersApproved`): ลูกค้าสถานะ 2 ที่ขายเครดิตโดยดึงจากเอกสารสั่งจอง/สั่งขาย (เปิด `sr_ss_credit_check` และไม่เปิด `request_ar_credit`) บันทึกได้ก็ต่อเมื่อคำขอของเอกสารอ้างอิงทุกใบมีอยู่และ `credit_status` เป็น 0 (NULL นับเป็น 0) มิฉะนั้นได้ข้อความ "ยังไม่อนุมัติเปิดสถานะเครดิต" (trans_save_rules.go:539-545) ไม่พบโค้ด Go ที่ UPDATE ตารางนี้ การเปลี่ยน `credit_status` เป็น 0 เมื่ออนุมัติจึงเกิดนอกโค้ด Go นี้

## erp_credit_approved_logs — บันทึกการอนุมัติ
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `trans_flag`, `doc_no` | เอกสารที่อนุมัติ — จับคู่กับ `ic_trans.doc_no` / `trans_flag` | doc_flow.go:70, 290; trans_credit.go:203; 02_data_schema.sql:2705, 2707 |
| `approve_status` | smallint — ถูกอ่านไปเป็น `ic_trans.approve_status` ของเอกสารที่ไม่มีเอกสารอนุมัติอ้างอิง (ไม่มีแถวนับเป็น 0) | doc_flow.go:290, 364-368; 02_data_schema.sql:2713 |
| `trans_type`, `doc_date`, `ref_no`, `creator_code`, `approve_user`, `create_datetime` | อยู่ใน DDL — ไม่พบโค้ด Go อ่านหรือเขียน | 02_data_schema.sql:2706-2712 |

- คำนวณ `ic_trans.approve_status`: `approveSQL` (doc_flow.go:282-296) ใช้กับกฎที่ตั้ง `approveLogs` คือ trans_flag 2, 6, 34, 36 (doc_flow.go:93, 97, 102, 105) — ถ้า `ic_trans.auto_approved = 1` ได้ 1; ถ้ามีเอกสารอนุมัติที่ `doc_ref` ชี้มา ใช้ `not_approve_1` ของเอกสารนั้น (0 → 1, 1 → 2); ถ้าไม่มีเอกสารอนุมัติ ใช้ `approve_status` ของตารางนี้ (ไม่มีแถว = 0); ค่าอื่นใช้ค่าตั้งต้นของกฎ (0 สำหรับ 2 และ 6, 1 สำหรับ 34 และ 36) ผลเขียนลง `ic_trans.approve_status` ที่ doc_flow.go:362-368
- มีแถวของ `doc_no` นั้นในตารางนี้ → เอกสาร 6, 34, 36 ถือว่าถูกใช้แล้วและตั้ง `ic_trans.used_status` (doc_flow.go:70, 95, 101, 104; เขียนที่ 362-368) เงื่อนไขนี้เทียบแค่ `doc_no` ไม่ดู `trans_flag`
- งานตรวจระบบ "ปรับปรุงสถานะเอกสารใบสั่งซื้อที่อ้างอิงไปค่าใช้จ่ายอื่น ๆ" (ไม่รันอัตโนมัติ) นับแถวของตารางนี้เป็นการอ้างอิงใบสั่งซื้อ (6) แล้วตั้ง `used_status = 1` เงื่อนไขชนิดเอกสารในคิวรีนั้นเทียบคอลัมน์ `trans_flag` กับตัวเอง จึงจับคู่ด้วย `doc_no` อย่างเดียว (sysproc_ic_checks_data.go:92-93)
- Go **อ่าน** (doc_flow.go:70, 290; sysproc_ic_checks_data.go:92-93) และ **ลบ** (trans_credit.go:203 ตอนพักเอกสาร 34/36) เท่านั้น — ไม่พบ INSERT/UPDATE ทั้งใน backend และ `frontend/src` แถวจึงมาจากที่อื่น สคริปต์ข้อมูลตัวอย่าง `16_fix_bcdemo_corrupt_and_populate_all.sql:425-429` ใส่แถวทดสอบสองแถวที่ `approve_status = 1`

## ผู้อนุมัติ
- ขายเครดิตที่เกินวงเงิน (ไม่ใช่เส้นทางพักเอกสาร 34/36): เมื่อเปิด `lock_credit_money` และ `password_ar_credit` (และไม่เปิด `request_ar_credit`) ระบบตอบ 409 `CREDIT_PASSWORD:` ขอรหัสผู้อนุมัติ ผู้อนุมัติต้องเป็น `erp_user` ที่ `approve_ar_credit = 1` และรหัสผ่านถูกต้อง แล้วบันทึกรหัสผู้อนุมัติลง `ic_trans.user_approve` — ขั้นตอนนี้ไม่แตะสองตารางนี้ (trans_save_rules.go:564-565; trans_credit.go:40-47, 50-82; [[tbl-erp-user]], [[tbl-erp-option]])
- ผู้อนุมัติคำขอ 34/36 ไม่พบในโค้ด Go: `ic_trans.is_hold` ถูกตั้งเป็น 1 อย่างเดียว (trans_credit.go:201) ไม่พบโค้ด Go หรือหน้าจอที่อ่านหรือปลดค่านี้ และไม่พบโค้ดที่เขียน `erp_credit_request.user_approve_status` จึงยังไม่ทราบว่าอนุมัติและปลดพักเกิดที่ใด

## ลิงก์
[[acc-transaction-save-flow]] · [[proc-doc-cancel-approve]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans_credit.go:198` พักเอกสาร ลบและเขียนคำขอ
- `backend/internal/application/process/trans_credit.go:100` `orderCreditCheck` คำนวณคำขอ
- `backend/internal/application/process/trans_save_rules.go:579` `refOrdersApproved` อ่านคำขอกลับ
- `backend/internal/application/process/doc_flow.go:70` เงื่อนไข "ถูกใช้แล้ว" จากบันทึกการอนุมัติ
- `backend/internal/application/process/doc_flow.go:284` `approveSQL` อ่าน `approve_status` จากบันทึกการอนุมัติ
- `backend/internal/application/process/sysproc_ic_checks_data.go:92` งานตรวจระบบใบสั่งซื้อ
- `scripts/sql/02_data_schema.sql:2701` นิยามตารางทั้งสอง
- `scripts/sql/16_fix_bcdemo_corrupt_and_populate_all.sql:425` แถวทดสอบ
