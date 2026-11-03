---
title: "คำศัพท์บัญชีภาษาไทย (เช่น เครดิต ครบกำหนด ยกเลิก ส่วนลด) คือตารางและคอลัมน์ไหนในฐานข้อมูล"
tags: [faq, glossary, database, terms]
aliases: ["คำไทยตรงกับคอลัมน์อะไร", "ช่องนี้เก็บที่ไหน", "ชื่อคอลัมน์ ic_trans", "cust_code คืออะไร", "trans_flag คืออะไร", "ตารางหัวเอกสาร", "ตารางรายการสินค้าในเอกสาร", "ic_trans_detail", "last_status", "inquiry_type", "เลขที่เอกสารเก็บที่ไหน", "ยอดรวมเก็บที่ไหน"]
sources: ["scripts/sql/02_data_schema.sql:6571", "scripts/sql/02_data_schema.sql:6754", "scripts/sql/02_data_schema.sql:5199", "scripts/sql/02_data_schema.sql:4355", "scripts/sql/02_data_schema.sql:2473", "scripts/sql/02_data_schema.sql:2157", "backend/internal/application/process/trans.go:33", "backend/internal/application/process/trans.go:101", "backend/internal/application/process/stock_rebuild.go:18"]
---
# คำศัพท์บัญชีภาษาไทยคือตารางและคอลัมน์ไหน

**ตอบสั้น:** เอกสารซื้อ-ขาย-สต็อกทั้งหมดเก็บที่ตารางหัว `ic_trans` กับตารางรายการ `ic_trans_detail` (แยกชนิดด้วย `trans_flag`) ส่วนเงินสด/เช็คอยู่ `cb_trans*` และรายการบัญชีอยู่ `gl_journal*` ตารางด้านล่างจับคู่คำที่คนพูดกับคอลัมน์จริง (ตรวจจาก DDL และฟิลด์ใน `trans.go`)

## รายละเอียด
| คำที่ใช้ | ตาราง.คอลัมน์ | อ่านต่อ |
|---|---|---|
| เลขที่เอกสาร / วันที่เอกสาร | `ic_trans.doc_no` / `doc_date` (`cb_trans`, `gl_journal` มีชื่อเดียวกัน) | [[term-doc-no-doc-date]] |
| ชนิดเอกสาร (ขาย ซื้อ รับคืน) | `ic_trans.trans_flag` คู่กับ `trans_type` | [[term-trans-flag]] |
| รูปแบบ/รหัสเลขที่เอกสาร | `ic_trans.doc_format_code` → `erp_doc_format.code`, `format` | [[faq-doc-number-format]] |
| ลูกค้า / เจ้าหนี้ในเอกสาร | `ic_trans.cust_code` คอลัมน์เดียวใช้ทั้งสองฝั่ง ชี้ `ar_customer.code` หรือ `ap_supplier.code` | [[term-party-ap-ar]] |
| เงินสด / เงินเชื่อ | `ic_trans.inquiry_type` | [[term-inquiry-type]] |
| เครดิต (วัน) / ครบกำหนด | `ic_trans.credit_day` / `due_date` | [[term-credit-due]] |
| เอกสารอ้างอิง / เลขที่ที่ดึงมา | หัว `ic_trans.doc_ref`; บรรทัด `ic_trans_detail.ref_doc_no` | [[term-doc-ref]] |
| ยกเลิก / อนุมัติ | `ic_trans.last_status` / `approve_status` | [[term-last-status-cancel-approve]] |
| ประเภทภาษี / อัตรา | `ic_trans.vat_type`, `vat_rate`; แถวภาษีซื้อ-ขายใน `gl_journal_vat_buy` / `gl_journal_vat_sale` | [[term-vat-type]] |
| ยอดรวมท้ายเอกสาร | `ic_trans.total_value`, `total_discount`, `total_before_vat`, `total_vat_value`, `total_amount` | [[term-doc-totals]] |
| สินค้า / ประเภท / วิธีต้นทุน | `ic_inventory.code`; `item_type`; `cost_type` (บรรทัดเอกสารใช้ `ic_trans_detail.item_code`) | [[term-item-type]], [[term-cost-type]] |
| จำนวน ราคา ส่วนลด ยอดบรรทัด | `ic_trans_detail.qty`, `price`, `discount`, `sum_amount`; หน่วย `unit_code` | [[term-price-discount]], [[term-unit-ratio]] |
| คลัง / ที่เก็บ | `ic_trans_detail.wh_code`, `shelf_code`; master `ic_warehouse`, `ic_wh_shelf` | [[term-wh-shelf]] |
| ยอดคงเหลือ / ต้นทุนเฉลี่ย | `ic_inventory.balance_qty`, `average_cost` (คำนวณซ้ำจากแถวเอกสาร) | [[term-stock-balance]] |
| ผังบัญชี / รายการบัญชี | `gl_chart_of_account.code`; `gl_journal` (หัว), `gl_journal_detail.account_code`, `debit`, `credit` | [[term-chart-of-account]], [[term-gl-journal]] |
| งวดบัญชี | `erp_account_period` (`period_year`, `period_number`, `date_start`, `date_end`, `status`) | [[term-account-period]] |
| รับ/จ่ายเงิน โอน เช็ค | `cb_trans`, `cb_trans_detail`, `cb_chq_list.status` | [[term-pay-tenders]], [[term-cheque-status]] |
| ภาษีหัก ณ ที่จ่าย | `gl_wht_list` | [[term-wht]] |
| ปี พ.ศ./ค.ศ. | `erp_option.year_type` | [[term-buddhist-year]] |

- ชื่อฟิลด์ที่หน้าจอส่งเข้า backend ตรงกับคอลัมน์ในรูปแบบ camelCase เช่น `custCode`, `docRef`, `creditDay`, `discountWord` (`trans.go:101-130`) และบรรทัดสินค้า `itemCode`, `whCode`, `sumAmount`, `refDocNo` (`trans.go:33-65`)
- ยอดคงเหลือสต็อกและต้นทุนไม่ใช่ข้อมูลที่กรอกเอง ระบบคำนวณใหม่จากแถวเอกสารตามชนิด `trans_flag` (`stock_rebuild.go:18`)

## ข้อควรระวัง
- คอลัมน์โอนเงินใน `cb_trans` สะกดว่า `tranfer_amount` (ขาด s) เป็นชื่อจริงใน DB (`02_data_schema.sql:2181`) ค้นด้วย `transfer_amount` จะไม่เจอ
- `cust_code` ใช้ร่วมกันทั้งลูกหนี้และเจ้าหนี้ ต้องดู `trans_flag` ว่าเป็นฝั่งไหน ส่วน `cb_trans` ใช้ชื่อ `ap_ar_code`
- เลขประจำตัวผู้เสียภาษีมีชื่อคอลัมน์ต่างกันในแต่ละตาราง ดู [[term-tax-id-branch]]

## ดูเพิ่ม
- [[glossary-overview]]
- [[term-module-prefix]]
- [[acc-trans-flag-map]]
- [[faq-where-trans-flag-handled]]
- [[faq-menu-code-to-screen]]

## ที่มาในโค้ด
- `scripts/sql/02_data_schema.sql:6571` (`ic_trans`), `:6754` (`ic_trans_detail`), `:5199` (`ic_inventory`), `:4355` (`gl_journal_detail`), `:2473` (`erp_account_period`), `:2157` (`cb_trans`), `:2181` (`tranfer_amount`), `:2058` (`cb_chq_list`), `:4728` (`gl_wht_list`), `:2993` (`erp_option`)
- `backend/internal/application/process/trans.go:33-65` (`TransLine`), `:101-130` (`SaveTransInput`)
- `backend/internal/application/process/stock_rebuild.go:18`
