---
title: "หัวเอกสารใบวางบิล/ใบเสร็จ-จ่ายชำระหนี้ (ap_ar_trans)"
tags: [tables, ap-ar]
aliases: ["ap_ar_trans", "หัวเอกสารเจ้าหนี้ลูกหนี้", "ใบวางบิล", "ใบเสร็จรับเงินลูกหนี้", "ใบจ่ายชำระเจ้าหนี้"]
sources: ["backend/internal/application/process/docs.go:33", "backend/internal/application/process/docs.go:354", "backend/internal/application/process/docs.go:483", "backend/internal/application/process/docs.go:528", "backend/internal/domain/query/write_policy.go:24", "backend/internal/application/process/doc_cancel.go:59"]
---

# หัวเอกสารใบวางบิล / รับชำระหนี้ / จ่ายชำระหนี้ (`ap_ar_trans`)

เก็บ **หัว (header)** ของเอกสารฝั่งเจ้าหนี้-ลูกหนี้ที่ไม่ใช่เอกสารซื้อขาย (เอกสารซื้อขายอยู่ใน [[tbl-ic-trans]]) คือ ใบวางบิล และ ใบรับชำระหนี้/จ่ายชำระหนี้ รายการบรรทัดที่ชำระอยู่ใน [[tbl-ap-ar-trans-detail]] และช่องทางรับ/จ่ายเงิน (เงินสด โอน เช็ค บัตร) อยู่ใน [[tbl-cb-trans]] / [[tbl-cb-trans-detail]] โดย key เดียวกัน (`doc_no` + `trans_flag`).

ตารางนี้เป็น "ตารางเงิน" ตาม `moneyTablePattern` — แก้ได้เฉพาะผ่านงาน `/api/process` (ไม่ผ่าน generic query write) ดู `domain/query/write_policy.go:24`.

## เอกสารที่ใช้ตารางนี้ (trans_flag)

| trans_flag | เอกสาร | ฝั่ง (`trans_type`) |
|---|---|---|
| 213 | ใบวางบิลเจ้าหนี้ (AP billing) | 1 (เจ้าหนี้) |
| 235 | ใบวางบิลลูกหนี้ (AR billing) | 2 (ลูกหนี้) |
| 19 | จ่ายชำระหนี้เจ้าหนี้ | 1 |
| 239 | รับชำระหนี้ลูกหนี้ | 2 |
| 214 / 23 / 236 / 240 | เอกสารยกเลิกของ 213 / 19 / 235 / 239 ตามลำดับ | ตามต้นฉบับ |

ที่มา: `billSides` ใน `docs.go:528` (`235,239 → ลูกหนี้ trans_type 2`, `213,19 → เจ้าหนี้ trans_type 1`), คู่ยกเลิกใน `doc_cancel.go:59-62` (`214→213, 23→19, 236→235, 240→239`). ดูตารางรวมรหัสใน [[acc-trans-flag-map]].

## คอลัมน์สำคัญ (จาก INSERT ใน `docs.go:354-363`)

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no` | เลขที่เอกสาร (key ร่วมกับ `trans_flag`) | ทุกที่ที่ join หัว-ราย-การจ่ายเงิน |
| `trans_flag` | ชนิดเอกสาร (ตารางด้านบน) | `docs.go:354`, ทุก report |
| `trans_type` | 1 = เจ้าหนี้, 2 = ลูกหนี้ | `billSides` `docs.go:528`; dashboard ใช้ `trans_type = 2` เป็นยอดลูกหนี้ (`adapter/inbound/http/dashboard/handler.go:126`) |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร | ทุก report |
| `cust_code` | รหัสลูกหนี้ ([[tbl-ar-customer]]) หรือเจ้าหนี้ ([[tbl-ap-supplier]]) ตาม `trans_type` | `docs.go:354`; รายงาน `report_menu_ap_ar.go:406,475` |
| `branch_code`, `department_code` | สาขา / แผนก | `docs.go:354` ([[tbl-erp-branch-list]]) |
| `vat_type`, `vat_rate` | ชนิด/อัตราภาษี | `docs.go:354` |
| `total_value`, `total_before_vat`, `total_vat_value`, `total_after_vat` | ยอดรวมก่อน/หลังภาษี | `docs.go:354` — ค่าที่ INSERT มาจาก `t.Value, t.BeforeVat, t.VatValue, t.Amount` |
| `total_net_value` | ยอดสุทธิ (INSERT ด้วยค่าเดียวกับ `total_after_vat`) | `docs.go:357` (`$14` ซ้ำสองคอลัมน์); report ลูกหนี้ใช้ `-total_net_value` เป็นยอดรับชำระ (`report_menu_ap_ar.go:406`) |
| `total_pay_money` | ยอดชำระรวม (Σ `sum_pay_money` ของบรรทัด) | `docs.go:354,566` |
| `remark`, `doc_ref`, `doc_ref_date` | หมายเหตุ / เอกสารอ้างอิง | `docs.go:354` |
| `doc_format_code` | รูปแบบเลขที่เอกสาร ([[tbl-erp-doc-format]]) | `docs.go:354`; `doc_picture.go:164` |
| `credit_day`, `due_date` | วันเครดิต / วันครบกำหนด | `docs.go:354` |
| `sale_code`, `project_code`, `allocate_code`, `side_code`, `job_code`, `doc_group` | มิติวิเคราะห์ต่อเอกสาร | `docs.go:354` |
| `currency_code`, `exchange_rate`, `discount_word` | สกุลเงิน / อัตรา / ข้อความส่วนลด | `docs.go:354`; หลายสกุลดู [[acc-fx-multi-currency]] |
| `last_status` | 0 = ใช้งาน, 1 = ยกเลิก (INSERT ด้วย 0 เสมอ; ค่าจริงถูกคำนวณตาม doc flow) | `docs.go:354`; `report_menu_ap_ar.go:406` กรอง `last_status = 0` |
| `sum_pay_money_cash`, `sum_pay_money_chq`, `sum_pay_money_transfer`, `sum_pay_money_diff` | แยกยอดชำระตามช่องทาง และส่วนต่าง — รายงานใช้อ่านค่า แต่โค้ดระบุว่าเป็น "assumed source mapping" | `report_menu_ap_ar.go:866-880` (ไม่เห็น INSERT ที่เขียนคอลัมน์เหล่านี้ใน `docs.go` → ที่มาของค่า "ไม่ชัดจากโค้ด") |

คอลัมน์อื่นที่ทั้งตารางมีจริงแต่ไม่ถูกใช้ในโค้ด backend ที่อ่าน: "(ไม่ชัดจากโค้ด)".

## ความสัมพันธ์

- `doc_no + trans_flag` → [[tbl-ap-ar-trans-detail]] (บรรทัดบิลที่ชำระ; ลบ-สร้างใหม่พร้อมหัว)
- `doc_no + trans_flag` → [[tbl-cb-trans]] / [[tbl-cb-trans-detail]] (แท็บรับ/จ่ายชำระของ 19/239) และ [[tbl-cb-chq-list]] ผ่าน `doc_ref = doc_no` (เช็คที่รับ/จ่าย)
- `cust_code` → [[tbl-ar-customer]] หรือ [[tbl-ap-supplier]]
- ผลบัญชี: เอกสารเหล่านี้ลง GL ผ่าน template ([[acc-gl-template-engine]], [[acc-gl-posting-standard]], [[tbl-gl-journal]]); ภาษีหัก ณ ที่จ่ายที่เกิดจากการชำระดู [[acc-vat-register-wht]] / [[tbl-gl-wht-list]]
- ตัวหนี้ที่ถูกชำระคือเอกสาร [[tbl-ic-trans]] (ขาย/ซื้อ/ลด-เพิ่มหนี้) และ [[tbl-as-trans]] (ขายสินทรัพย์ flag 1802) — ดู `billDebtSource` `docs.go:610-617`

## ใครเขียน / ใครอ่าน

- **เขียน**: `SaveDoc` (`docs.go:33-95` struct `SaveDocInput`, แผน `apArPlan` `docs.go:483-495`). วิธี save เป็นแบบ idempotent — ใน transaction เดียว ลบ `ap_ar_trans_detail`, `ap_ar_trans`, `cb_trans_detail`, `cb_trans`, `cb_chq_list` (ที่ `doc_ref = doc_no`) ของ (doc_no, trans_flag) นั้นก่อน แล้ว INSERT ใหม่ (`docs.go:488-494`) แล้ว rebuild สถานะเช็ค/GL ตามต่อท้าย. ดูภาพรวมใน [[acc-transaction-save-flow]]
- **อัปเดตสถานะยกเลิก**: `doc_flow.go:262-263` และ `doc_cancel.go:317,354` ส่งต่อ `last_status` ระหว่างต้นฉบับกับเอกสารยกเลิก. ดู [[proc-doc-cancel-approve]], [[acc-transaction-delete-edit]]
- **อ่าน**: รายงานเจ้าหนี้/ลูกหนี้ (`report_menu_ap_ar.go:309-360,406,475,780-905`), CRM dashboard (`crm/handler.go:166-223`), dashboard (`dashboard/handler.go:126`), GL template ชุดจ่ายหนี้ (`gl_template.go:820-842` อ่านเงินจาก `cb_trans` และหมายเหตุ/สาขาจาก `ap_ar_trans`), ค้นหาภาพเอกสาร (`doc_picture.go:128-219`), หาเลขเอกสารถัดไป (`doc_no_next.go:12` อยู่ใน `nextDocNoTables`).
- **ระบบอื่น**: dashboard / crm / ai / mcp gateway อ่านตารางนี้ (`adapter/inbound/http/...`) — ไม่เขียน.

## ข้อควรระวัง

- **ใช้ `trans_flag` ผิดชุดได้ง่าย**: โค้ด CRM อ่าน `ap_ar_trans` ด้วย `trans_flag = 41` (วางบิล) และ `43` (ใบเสร็จ) (`crm/handler.go:177-178`) ซึ่ง **ไม่ตรง** กับ `billSides` ที่ใช้ 235/239 — อย่าเชื่อชุด 41/43 เมื่ออ้างข้อมูลจริง (ไม่ชัดจากโค้ดว่ามีเอกสาร 41/43 ในตารางนี้หรือไม่).
- Dashboard ลูกหนี้คงค้างรวม `total_net_value` ทุกแถวที่ `trans_type = 2` โดยไม่กรอง `last_status` (`dashboard/handler.go:126`) — เป็นการประมาณของ dashboard ไม่ใช่ยอดบัญชี.
- ห้ามแก้ตารางนี้ตรงด้วย SQL: ผ่านนโยบาย money-table ต้องใช้ `/api/process` เพื่อให้สถานะ/GL/เช็คสอดคล้อง ([[tbl-group-ap-ar]]).
- ยอดเงินเป็นทศนิยมเชิงบัญชี รับ-ส่งเป็น string (กฎ ACCOUNTING NUMBER); `ParseDecimalRat` ใน `docs.go:560-571`.
- เอกสารถูกลบ-สร้างใหม่ทุกครั้งที่แก้ → `roworder` (ถ้ามี) ไม่คงที่ ไม่ควรใช้เป็น key อ้างอิงถาวร.

## ที่มาในโค้ด

- `backend/internal/application/process/docs.go:21` (docKindCheque), `:33-95` (SaveDocInput), `:354-363` (INSERT ap_ar_trans), `:432` (cheque register read-only), `:483-495` (apArPlan), `:528` (billSides), `:600-626` (เงื่อนไขหนี้/paid)
- `backend/internal/application/process/doc_cancel.go:59-62,112,317,354`
- `backend/internal/application/process/doc_flow.go:262-263,487`
- `backend/internal/application/process/gl_template.go:820-842`
- `backend/internal/application/process/report_menu_ap_ar.go:309-360,406,475,780-905`
- `backend/internal/domain/query/write_policy.go:23-24`
- `backend/internal/adapter/inbound/http/crm/handler.go:177-178`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:126`
