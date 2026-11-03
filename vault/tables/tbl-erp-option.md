---
title: "erp_option — ตัวเลือกระบบ (สวิตช์ + ทศนิยมของบริษัท)"
tags: [tables, erp, erp-option, settings, company-db]
aliases: ["erp_option", "ตัวเลือกระบบ", "ตั้งค่าระบบ", "option", "สวิตช์ระบบ"]
sources: ["backend/internal/application/process/grid_calc.go:39", "backend/internal/application/process/grid_calc.go:66", "backend/internal/application/process/service.go:969", "backend/internal/application/process/trans_save_rules.go:30", "backend/internal/application/process/trans_validate.go:30", "backend/internal/application/process/lookup_trans.go:74", "backend/internal/application/process/pay_check.go:156", "backend/internal/application/process/gl_template.go:354", "backend/internal/application/process/gl_template_defaults.go:68", "backend/internal/application/process/report_menu_ic_opts.go:70", "backend/internal/adapter/inbound/http/admin/workspace_google.go:505", "backend/internal/domain/query/query.go:63"]
---

# erp_option — ตัวเลือกระบบ

ตารางตั้งค่าของ **บริษัท (Company DB)** แถวเดียว ทุกที่อ่านด้วย `FROM erp_option LIMIT 1` ใช้เป็นสวิตช์เปิด/ปิดกฎ (เช็คสต๊อก เช็คเครดิต ฯลฯ) และกำหนดทศนิยม/ปีพ.ศ./วิธีคิด VAT ของทั้งระบบ

> ตารางนี้เป็นของเดิม (legacy) ไม่มี DDL ในโค้ด Go — คอลัมน์ด้านล่างมาจากที่โค้ดอ่าน/เขียนจริงเท่านั้น ความหมายที่โค้ดไม่ได้บอกใส่ "(ไม่ชัดจากโค้ด)"

## กฎสำคัญ: ไม่มีแถว = ทุกสวิตช์ปิด

- ถ้าไม่พบแถว (หรือคอลัมน์ว่าง) โค้ดถือว่า **สวิตช์ทุกตัว = 0 (ปิด)** และทศนิยมใช้ค่าเริ่มต้น 2 หลัก — เป็นแพตเทิร์นเดียวกันทั้ง `trans_save_rules.go`, `trans_validate.go`, `lookup_trans.go`
- คอลัมน์ที่บางฐานเก่าอาจยังไม่มี อ่านผ่าน `scanOption` (grid_calc.go:39) ซึ่งใช้ savepoint กันไม่ให้ transaction พังเมื่อคอลัมน์ไม่มี
- ตอนสร้างฐานบริษัทใหม่ (workspace Google) ถ้ายังไม่มีแถว จะ INSERT แถวเริ่มต้นด้วยคอลัมน์ `year_type, item_qty_decimal, item_price_decimal, item_amount_decimal, currency_exchange_decimal, gl_no_decimal` (admin/workspace_google.go:505)
- หน้าแอดมินนับจำนวนแถวของตารางนี้ด้วย (admin/handler.go:632)

## คอลัมน์ที่โค้ดอ่าน (จัดกลุ่ม)

### ทศนิยม / การปัดเศษ / รูปแบบ
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `item_qty_decimal` | ทศนิยมจำนวนสินค้า (ค่าเริ่มต้น 2) | report_menu_ic_opts.go:70-73 |
| `item_price_decimal` | ทศนิยมราคา (ค่าถูกต้อง 0-6 มิฉะนั้นใช้ 2) | service.go:969 `stockScales`, grid_calc.go:66 |
| `item_amount_decimal` | ทศนิยมจำนวนเงิน (0-6 มิฉะนั้น 2) | service.go:969, fa_depreciation.go:785 |
| `currency_exchange_decimal` | ทศนิยมอัตราแลกเปลี่ยน | seed ที่ workspace_google.go:505 |
| `gl_no_decimal` | ทศนิยมตัวเลขในรายการ GL | gl_template.go:733 |
| `round_type` | 1 = ปัดแบบพิเศษ, อื่นๆ = 0 | grid_calc.go:66, stock_rebuild.go:228 |
| `year_type` | 0 = ค.ศ., 1 = พ.ศ. (ใช้กับเลขเอกสาร/รายงาน/GL) | gl_post.go:61, doc_picture.go:245, report.go:190 |
| `vat_rate` | อัตรา VAT (ค่าเริ่มต้น 7) | fa_sale.go:323, mcp/gateway.go:1636 |

### VAT / ส่วนลดท้ายบิล
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `discout_type` (สะกดตามฐานจริง) | 0 = VAT คิดก่อนส่วนลด, 1 = หลังส่วนลด | grid_calc.go:92, transcalc.go:56-60, gl_template.go:733/780 |
| `discount_vat_type` | 0 = หักจากสินค้ามีภาษีก่อน, 1 = เฉลี่ย, 2 (สรรพากร) อ่านเป็น 0 | transcalc.go |
| `discount_step_round_off`, `calc_item_price_discount` | ปัดเศษส่วนลดทีละขั้น / คิดราคาหลังส่วนลดรายการ (ละเอียดดู [[acc-transcalc-totals]]) | grid_calc.go |

### ราคา / ตะกร้า (grid)
`check_qty`, `warning_low_cost`, `lock_low_cost`, `warning_input_customer`, `warning_price_1`, `warning_price_2`, `get_purchase_price`, `get_last_price_type`, `ic_price_formula_control`, `sale_real_price`, `multi_currency`, `home_currency` (fx.go:36), `purchase_zero_vat_use_price1`, `count_stock_display_saleprice`, `enable_all_ic_wh_shelf` (item_master.go:631), `hide_pr_amount`, `pr_disable_price`, `sale_auto_input_qty`, `use_price_center`, `price_list_server` (price_center.go:75), `fix_item_set_price` (trans_set_item.go:66), `use_compare_unit`, `use_quality_control_system` (trans_line_extra.go:25), `find_lot_auto` (trans_lot_auto.go:50), `default_sale_type`, `use_credit_pay_bill_calc` (trans_new_defaults.go:38, trans_party.go:241), `withdraw_enable_amount`, `stock_reserved_control_location` (trans_ref_import_lines.go) — ความหมายรายตัวส่วนใหญ่ตามชื่อ ถ้าต้องการรายละเอียดให้ดูไฟล์ที่ระบุ

### กฎตอนบันทึก (trans_save_rules.go:30-45)
`check_input_vat`, `issue_stock_control`, `stock_balance_control`, `ic_stock_control`, `transfer_stock_control`, `stock_accrued_control`, `stock_reserved_control`, `balance_control_type`, `stock_accured_level` (สะกดตามฐานจริง), `warning_credit_money`, `lock_credit_money`, `request_ar_credit`, `credit_sale_include_deposit`, `ar_credit_chq_outstanding`, `password_ar_credit`, `sr_ss_credit_check`, `check_credit_sale_reserve_sale_order` — คุมการเตือน/ล็อกเมื่อสต๊อกติดลบ, เกินวงเงินเครดิต ฯลฯ (ดู [[acc-transaction-save-flow]], [[tbl-erp-credit-approved-logs]])

### ตรวจหน้าจอ (trans_validate.go:30-34)
`warning_branch_input` (ต้องมี `erp_company_profile.branch_status = 1` ด้วย — ดู [[tbl-erp-company-profile]]), `use_department`, `warning_department`, `check_delivery_date`, `quotation_expire`, `doc_sale_order_edit`, `allow_sale_over_reserve`, `receive_more_po`, `check_qty_over_doc_ref`

### Lookup / สาขา / สิทธิ์คลัง
`show_branch_doc_only`, `doc_ref_reservation_approve`, `doc_ref_salesorder_approve`, `ref_po_approve`, `perm_wh_shelf` (lookup_trans.go:74-80, perm_wh_shelf.go:83 — ดู [[proc-wh-shelf-permission]]), `customer_by_branch` (lookup_party.go:75)

### บิล / รับ-จ่ายชำระ
`pay_bill_over`, `ap_pay_from_bill_note`, `ar_pay_from_bill_note`, `ap_bill_inform`, `ar_bill_inform` (pay_check.go:156-181), `filter_pay_bill` (docs.go:647)

### ผังเอกสาร / GL
- `purchase_request_approve_until_end` (doc_flow.go:395)
- `inventory_gl_post` — 0 = perpetual (gl_template_defaults.go:68)
- `gl_trans_type` — 1 = รวมบัญชี (compound lines), 0 = แสดงชื่อบัญชี/สินค้า (gl_template.go:354, 440) — ดู [[acc-gl-template-engine]]

### อื่นๆ
`disable_ar_autorun` (master_autorun.go:126), `disable_item_cost` (report_options.go:127; ใช้คู่กับ `erp_user.show_item_cost` — [[tbl-erp-user]]), `sum_point_all`, `calc_point_from_pay` (sysproc_tools.go:161)

## การเขียน / สิทธิ์
- ผ่านเกตเวย์ query: `erp_option` อยู่ในกลุ่มที่ต้อง `userLevel >= 9` จึงเขียนได้ (domain/query/query.go:63, 362) — user ทั่วไปแก้ไม่ได้
- ใช้ร่วมกับระบบอื่น: อ่านโดย report engine, lookup, MCP gateway (vat_rate)

## ลิงก์
[[acc-transaction-save-flow]] · [[acc-transcalc-totals]] · [[acc-rounding-decimal]] · [[proc-grid-calc]] · [[proc-lookup-filters]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/grid_calc.go:39`
- `backend/internal/application/process/grid_calc.go:66`
- `backend/internal/application/process/service.go:969`
- `backend/internal/application/process/trans_save_rules.go:30`
- `backend/internal/application/process/trans_validate.go:30`
- `backend/internal/application/process/lookup_trans.go:74`
- `backend/internal/application/process/pay_check.go:156`
- `backend/internal/application/process/gl_template.go:354`
- `backend/internal/application/process/gl_template_defaults.go:68`
- `backend/internal/application/process/report_menu_ic_opts.go:70`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:505`
- `backend/internal/domain/query/query.go:63`
