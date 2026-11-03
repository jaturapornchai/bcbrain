---
title: "ตัวย่อระบบ/คำนำหน้าตาราง (module prefix / ic ap ar gl cb as erp)"
tags: [glossary, naming, module]
aliases: ["ic", "ap", "ar", "gl", "cb", "as", "erp", "pp", "ic_", "ap_", "ar_", "gl_", "cb_", "as_", "erp_", "ap_ar", "คำนำหน้าตาราง", "ตัวย่อตาราง", "ระบบสินค้า", "ระบบเจ้าหนี้", "ระบบลูกหนี้", "ระบบบัญชี", "ระบบเงินสดธนาคาร", "ระบบทรัพย์สิน", "prefix"]
sources: ["frontend/src/config/bcMenu.json:1914", "frontend/src/config/bcMenu.json:3824", "frontend/src/config/bcMenu.json:4934", "frontend/src/config/bcMenu.json:6039", "frontend/src/config/bcMenu.json:6775", "frontend/src/config/bcMenu.json:7523", "frontend/src/config/bcMenu.json:9157", "frontend/src/config/bcMenu.json:9352", "frontend/account/tabs/transMenuMap.ts:3"]
---

# ตัวย่อระบบในชื่อตารางและเมนู

## ในระบบนี้คืออะไร
ชื่อตาราง ชื่อเมนู และชื่อไฟล์ backend ขึ้นต้นด้วยตัวย่อของระบบย่อย เมื่อผู้ใช้พูดถึงระบบใด ให้ค้นด้วยตัวย่อนั้น

## ตารางแปลตัวย่อ
| ตัวย่อ | ระบบ (ชื่อเมนูในโค้ด) | ตารางตัวอย่าง |
|---|---|---|
| `ic` | สินค้า (`menu_ic`, bcMenu.json:1914) | `ic_inventory`, `ic_trans`, `ic_trans_detail`, `ic_unit`, `ic_warehouse`, `ic_shelf`, `ic_inventory_barcode`, `ic_unit_use`, `ic_serial` |
| `po` (เมนู) / `ap` | ซื้อ (`menu_po`, :3824) และเจ้าหนี้ (`menu_ap`, :6039) | `ap_supplier`, `ap_supplier_detail`, `ap_type`, `ap_group` |
| `so` (เมนู) / `ar` | ขาย (`menu_so`, :4934) และลูกหนี้ (`menu_ar`, :6775) | `ar_customer`, `ar_customer_detail`, `ar_dealer`, `ar_sale_area` |
| `ap_ar` | เอกสารหนี้ที่ใช้ร่วมกันทั้งเจ้าหนี้และลูกหนี้ | `ap_ar_trans`, `ap_ar_trans_detail` |
| `cb` | เงินสด/ธนาคาร (`menu_cash_and_bank`, :7523) | `cb_trans`, `cb_trans_detail`, `cb_chq_list`, `cb_petty_cash` |
| `as` | ค่าเสื่อม/ทรัพย์สิน (`menu_asset`, :9157) | `as_asset`, `as_trans`, `as_trans_detail` |
| `gl` | บัญชี (`menu_general_ledger_main`, :9352) | `gl_journal`, `gl_journal_detail`, `gl_chart_of_account`, `gl_journal_vat_buy`, `gl_journal_vat_sale`, `gl_wht_list` |
| `erp` | ตั้งค่าส่วนกลางของบริษัท | `erp_option`, `erp_user`, `erp_doc_format`, `erp_branch_list`, `erp_account_period`, `erp_pass_book`, `erp_currency` |
| `pp` | TransKind `pp_trans` (`transMenuMap.ts:3-9`) | — |

## ข้อควรระวัง
- เมนูซื้อขึ้นต้นด้วย `menu_po_*` และเมนูขายด้วย `menu_so_*` แต่ตารางคู่ค้าเป็น `ap_*` และ `ar_*` อย่าค้นหาตาราง `po_*` หรือ `so_*`
- เอกสารซื้อขายเก็บใน `ic_trans` ไม่ใช่ `ap_*` หรือ `ar_*` ส่วนเอกสารหนี้ล้วน (ตั้งหนี้ยกมา ชำระหนี้ วางบิล) อยู่ใน `ap_ar_trans` ดู [[term-trans-flag]]
- `bc_*` เป็นตารางระดับแพลตฟอร์ม (รายชื่อฐานข้อมูลและผู้ใช้) ไม่ใช่ข้อมูลบัญชีของบริษัท ดู [[tbl-bc-database-list]]

## ลิงก์
[[term-trans-flag]] · [[tbl-ic-trans]] · [[tbl-ap-ar-trans]] · [[tbl-cb-trans]] · [[tbl-gl-journal]] · [[tbl-erp-option]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:1914`, `:3824`, `:4934`, `:6039`, `:6775`, `:7523`, `:9157`, `:9352`
- `frontend/account/tabs/transMenuMap.ts:3-9`
