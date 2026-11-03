---
title: "อภิธานศัพท์ BC Ai Account (glossary overview)"
tags: [glossary, hub]
aliases: ["อภิธานศัพท์", "glossary", "คำศัพท์", "พจนานุกรมคำไทย-โค้ด", "glossary-overview"]
sources: ["frontend/account/tabs/transMenuMap.ts:3", "frontend/src/config/bcMenu.json:42", "frontend/account/transaction/TransTopForm.tsx:564", "frontend/account/transaction/TransBottomPanel.tsx:330", "frontend/account/transaction/TransItemGrid.tsx:332", "frontend/account/transaction/JournalTaxTabs.tsx:225", "frontend/account/transaction/transLayouts.ts:35", "frontend/account/master/ItemScreen.tsx:2237", "frontend/src/config/schemas/masterDetailSchemas.ts:250", "frontend/src/config/schemas/erpOption/index.ts:46", "backend/internal/application/process/trans.go:18", "backend/internal/application/process/transcalc.go:9", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:1066", "backend/internal/application/process/cheque.go:8", "backend/internal/application/process/doc_cancel.go:17", "backend/internal/application/process/period.go:13", "backend/internal/application/process/fx.go:16"]
---

# อภิธานศัพท์ BC Ai Account

## ใช้อย่างไร
- ตารางนี้จับคู่คำไทยที่นักบัญชีและผู้ใช้พูด กับ identifier ในโค้ด ตาราง คอลัมน์ และหน้าจอของ BC Ai Account (`backend/`, `frontend/account/`)
- เรียงตามลำดับอักษรไทยด้วย `Intl.Collator('th')` มีทั้งหมด 298 แถว
- ตัวเลขหลัง `trans_flag` คือรหัสชนิดเอกสาร ส่วนตัวเลขของ enum (เช่น `vat_type`, `item_type`, `cost_type`) คือค่าที่เก็บใน DB ไม่ใช่เลขที่แสดงใน dropdown เพราะ dropdown บางจอแสดงเลขเริ่มที่ 1
- ความหมายเต็มและ `path:line` ของแต่ละแถวอยู่ในโน้ตที่ลิงก์ไว้ในคอลัมน์สุดท้าย
- ตัวย่อระบบ (ic, po, ap, so, ar, ap_ar, cb, as, gl, erp, bc) ใส่คำไทยไว้คอลัมน์แรกและใส่ตัวย่อไว้คอลัมน์ที่สอง ดู [[term-module-prefix]]

## ตาราง ก–ฮ
| คำไทย | คำอังกฤษ/ตัวย่อ | identifier ในโค้ด | หน้าจอ | note link |
|---|---|---|---|---|
| กลุ่มบัญชี | account group | `account_group` → `gl_account_group` | ผังบัญชี | [[term-chart-of-account]] |
| กลุ่มระบบของเอกสาร | trans type | `trans_type` 1 ซื้อ · 2 ขาย · 3 สินค้า | `transMenuMap.ts:54` | [[term-trans-flag]] |
| การคำนวณภาษีกรณีมีส่วนลดท้ายรายการ | discount VAT type | `erp_option.discount_vat_type` 0 / 1 | ข้อเลือกพิเศษ แท็บตั้งค่าระบบ | [[term-price-discount]] |
| การจัดสรร | allocate | `allocate_code` · `erp_allocate_list` | หัวเอกสาร "การจัดสรร:" / กำหนดการจัดสรร | [[term-dimension-project-side-job]] |
| การปัดเศษ | rounding | `erp_option.round_type` 0 / 1 | ข้อเลือกพิเศษ แท็บบัญชีแยกประเภท | [[term-erp-option]] |
| กำไรขาดทุนจากอัตราแลกเปลี่ยน | FX gain/loss | `lost_profit_exchange_amount` | จอชำระหนี้ | [[term-currency-fx]] |
| เกี่ยวข้องกับภาษี (ผังบัญชี) | GL tax type | `gl_chart_of_account.tax_type` 0-4 | ผังบัญชี | [[term-chart-of-account]] |
| ของแถม | premium | `is_permium` (สะกดตามจริง) | กริดสินค้า | [[term-price-discount]] |
| ข้อมูลรายวัน | JV | `gl_journal` · `menu_gl_journal` | ข้อมูลรายวัน (`transMenuMap.ts:2368`) | [[term-gl-journal]] |
| ข้อมูลสินค้า | item master | `ic_inventory` | จอสินค้า (`ItemScreen.tsx`) | [[term-module-prefix]] |
| ข้อเลือกพิเศษ | system options | `erp_option` · `erpOptionSchema` | กำหนดข้อเลือกพิเศษต่างๆ `menu_option` | [[term-erp-option]] |
| ขอโอน | — | `trans_flag` 124 | ค่าคงที่ `trans.go:18-27` | [[term-wh-shelf]] |
| ขายเชื่อ / ขายสด | credit / cash sale | `inquiry_type` 0 / 1 (ขาย) | หัวเอกสารขาย | [[term-inquiry-type]] |
| ขายสินค้า | SI | `trans_flag` 44 | จอ SI (`transMenuMap.ts:827`) | [[term-trans-flag]] |
| ขึ้นเงินบัตรเครดิต | credit card | `trans_flag` 461 · `chq_type` 3 | จอบัตรเครดิต (`transMenuMap.ts:2338`) | [[term-cheque-status]] |
| ขึ้นเงิน wallet | e-Wallet | `trans_flag` 463 · `chq_type` 21 | `transMenuMap.ts:1960` | [[term-cheque-status]] |
| เข้าคลัง / เข้าที่เก็บ | to warehouse | `wh_to` · `location_to` · `wh_code_2` · `shelf_code_2` | เอกสารโอน | [[term-wh-shelf]] |
| ครบกำหนด / วันครบกำหนด | due date | `due_date` | หัวเอกสาร (`TransTopForm.tsx:501`) | [[term-credit-due]] |
| คริสต์ศักราช (ค.ศ.) | Gregorian | `year_type` 0 (DB เก็บ ค.ศ. เสมอ) | การแสดงวันที่ทุกจอ | [[term-buddhist-year]] |
| คลังที่เก็บสินค้า (เมนู) | warehouse location menu | `menu_ic_warehouse_locaton` (สะกดตามจริง) | bcMenu.json:2200 | [[term-wh-shelf]] |
| คลังสินค้า | warehouse | `ic_warehouse` · `wh_code` · `wh_from` | หัวเอกสาร "คลังสินค้า:" / กริด | [[term-wh-shelf]] |
| ค่าใช้จ่าย | expense | `account_type` 4 | ผังบัญชี | [[term-chart-of-account]] |
| ค่าใช้จ่ายต้องห้าม | non-deductible expense | `balance_sheet_status` 5 | ผังบัญชี | [[term-chart-of-account]] |
| ค่าใช้จ่ายอื่น / รายได้อื่น (ช่องทางชำระ) | other expense/income | `doc_type` 11 / 12 (`gl_pay_other.go:10`) | แท็บการชำระเงิน | [[term-pay-tenders]] |
| ค่าตั้งส่วนกลางบริษัท | erp | `erp_*` | เมนูตั้งค่า | [[term-module-prefix]] |
| คำนวณยอดสต๊อกใหม่ | stock rebuild | `menu_ic_recalc` · `POST /process/stock/rebuild` | bcMenu.json:2581 | [[term-stock-balance]] |
| คืนเงินมัดจำ | SRT | `trans_flag` 112 | จอ SRT (`transMenuMap.ts:781`) | [[term-deposit-advance]] |
| คืนเงินรับล่วงหน้า | SDR | `trans_flag` 42 | จอ SDR (`transMenuMap.ts:765`) | [[term-deposit-advance]] |
| คืนเช็ค/ตั้งหนี้ใหม่ | — | `trans_flag` 418 → `status` 8 | เมนูเช็ครับ | [[term-cheque-status]] |
| คืน/ลด วงเงินสดย่อย | petty cash | `trans_flag` 300 | `transMenuMap.ts:1796` | [[term-trans-flag]] |
| เครดิต (วัน) | credit days | `credit_day` · `creditDay` | หัวเอกสาร (`TransTopForm.tsx:486`) | [[term-credit-due]] |
| โครงการ | project | `project_code` · `erp_project_list` | หัวเอกสาร "โครงการ:" / กำหนดโครงการ | [[term-dimension-project-side-job]] |
| งบทดลอง | trial balance (TB) | แยกยอดตาม `journal_type` (`report_menu_gl_fa_tb.go:10-16`) | รายงานงบทดลอง | [[term-gl-journal]] |
| งวดที่ | period number | `period_number` | กำหนดงวดบัญชี | [[term-account-period]] |
| งวดบัญชี | account period | `erp_account_period` | กำหนดงวดบัญชี `menu_account_period` | [[term-account-period]] |
| งาน | job | `job_code` · `erp_job_list` | หัวเอกสาร "งาน:" / กำหนดงาน | [[term-dimension-project-side-job]] |
| เงินมัดจำยกมา (ขาย) | SRVB | `trans_flag` 9110 | จอ SRVB (`transMenuMap.ts:707`) | [[term-deposit-advance]] |
| เงินมัดจำยกมา (ซื้อ) | PCB | `trans_flag` 9011 | จอ PCB (`transMenuMap.ts:175`) | [[term-deposit-advance]] |
| เงินล่วงหน้ายกมา (ขาย) | SDB | `trans_flag` 9040 | จอ SDB (`transMenuMap.ts:677`) | [[term-deposit-advance]] |
| เงินล่วงหน้ายกมา (ซื้อ) | PDB | `trans_flag` 9010 | จอ PDB (`transMenuMap.ts:145`) | [[term-deposit-advance]] |
| เงินโอน (ช่องทางชำระ) | transfer | `cb_trans_detail.doc_type` 1 · `tranfer_amount` | แท็บการชำระเงิน | [[term-pay-tenders]] |
| เงื่อนไขการคำนวณ VAT กรณีมีส่วนลด | discout type | `erp_option.discout_type` (สะกดตามจริง) | ข้อเลือกพิเศษ แท็บบัญชีแยกประเภท | [[term-price-discount]] |
| จากคลัง / จากที่เก็บ | from warehouse | `wh_from` · `location_from` | เอกสารโอน 70/72/73 | [[term-wh-shelf]] |
| จ่ายเงินมัดจำ | PC | `trans_flag` 11 | จ่ายเงินมัดจำ (bcMenu.json:3941) | [[term-deposit-advance]] |
| จ่ายเงินล่วงหน้า | PD | `trans_flag` 10 | จ่ายเงินล่วงหน้า (bcMenu.json:3902) | [[term-deposit-advance]] |
| จ่ายชำระหนี้ | DE | `trans_flag` 19 · `ap_ar_trans` | จอ DE (`transMenuMap.ts:1374`) | [[term-ap-ar-balance]] |
| จำนวนขาย (หน่วยช่วยขาย) | qty 2 | `qty_2` · `qty2` | คอลัมน์กริด (`TransItemGrid.tsx:366`) | [[term-unit-ratio]] |
| จุดทศนิยม (จำนวน/ราคา/มูลค่า) | decimal places | `item_qty_decimal` · `item_price_decimal` · `item_amount_decimal` | ข้อเลือกพิเศษ แท็บสินค้าคงคลัง | [[term-erp-option]] |
| เจ้าหนี้ / ผู้จำหน่าย | AP / supplier | `ap_supplier` · `ap_supplier_detail` | กำหนดเจ้าหนี้ `menu_ap_detail` | [[term-party-ap-ar]] |
| ชนิดเอกสาร | document type | `trans_flag` | ทุกเอกสาร | [[term-trans-flag]] |
| ชำระหนี้ | payment | กลุ่ม 4 (19 / 239) · `total_net_value` | จ่ายชำระหนี้ / รับชำระหนี้ | [[term-ap-ar-balance]] |
| ชื่อบัญชี | account name | `name_1` · `name_2` | ผังบัญชี | [[term-chart-of-account]] |
| เช็คขาดสิทธิ์ (เช็ครับ) | expired | `trans_flag` 413 → `status` 4 | เมนูเช็ครับ | [[term-cheque-status]] |
| เช็คคืน (เช็ครับ) | returned | `trans_flag` 412 → `status` 3 | เมนูเช็ครับ | [[term-cheque-status]] |
| เช็คจ่าย | cheque paid | `cb_chq_list` `chq_type` 2 | ทะเบียนเช็คจ่ายและจัดการเช็คจ่าย (bcMenu.json:7863) | [[term-cheque-status]] |
| เช็คจ่ายขาดสิทธิ์ | expired | `trans_flag` 452 → `status` 4 | เมนูเช็คจ่าย | [[term-cheque-status]] |
| เช็คจ่ายคืน | returned | `trans_flag` 453 → `status` 3 | เมนูเช็คจ่าย | [[term-cheque-status]] |
| เช็คจ่ายผ่าน | cleared | `trans_flag` 451 → `status` 2 | เมนูเช็คจ่าย | [[term-cheque-status]] |
| เช็คจ่ายยกมา | — | `trans_flag` 406 → `status` 0 | เมนูเช็คจ่าย | [[term-cheque-status]] |
| เช็ค (ช่องทางชำระ) | cheque | `doc_type` 2 คู่กับ `cb_chq_list` | แท็บการชำระเงิน | [[term-pay-tenders]] |
| เช็คผ่าน (เช็ครับ) | cleared | `trans_flag` 411 → `status` 2 | เมนูเช็ครับ | [[term-cheque-status]] |
| เช็ครับ | cheque received | `cb_chq_list` `chq_type` 1 | ทะเบียนเช็ครับและจัดการเช็ครับ (bcMenu.json:7752) | [[term-cheque-status]] |
| เช็ครับยกมา | — | `trans_flag` 405 → `status` 0 | เมนูเช็ครับ | [[term-cheque-status]] |
| ใช้คลังที่เก็บตามสิทธิ์พนักงาน | WH/shelf permission | `erp_option.perm_wh_shelf` | ข้อเลือกพิเศษ แท็บสินค้าคงคลัง | [[term-wh-shelf]] |
| ใช้เงินมัดจำ | use deposit | `doc_type` 6 · `DEPOSIT_TAB_FLAGS` | แท็บใช้เงินมัดจำ | [[term-deposit-advance]] |
| ใช้เงินล่วงหน้า | use advance | `doc_type` 5 | แท็บใช้เงินล่วงหน้า | [[term-deposit-advance]] |
| ใช้ระบบสาขา | branch status | `erp_company_profile.branch_status` | ข้อมูลบริษัท | [[term-tax-id-branch]] |
| ใช้ระบบหมดอายุ | use expire | `ic_inventory.use_expire` | จอสินค้า | [[term-lot-serial-expire]] |
| ใช้ระบบหลายสกุลเงิน | multi currency | `erp_option.multi_currency` | ข้อเลือกพิเศษ แท็บตั้งค่าระบบ | [[term-currency-fx]] |
| ซื้อเชื่อ / ซื้อสด | credit / cash purchase | `inquiry_type` 0 / 1 (ซื้อ) | หัวเอกสารซื้อ | [[term-inquiry-type]] |
| ซื้อสินค้า / ตั้งหนี้ | PU | `trans_flag` 12 | จอ PU (`transMenuMap.ts:295`) | [[term-trans-flag]] |
| ฐานภาษี | tax base | `vat_base_amount` · `base_caltax_amount` | แท็บภาษี | [[term-vat-type]] |
| ด้านบัญชี | balance mode | `balance_mode` 0 เดบิต · 1 เครดิต | ผังบัญชี | [[term-chart-of-account]] |
| ดึงเอกสาร | import ref | `refImportSpecs` | ปุ่ม "ดึงเอกสาร" (`TransTopForm.tsx:417`) | [[term-doc-ref]] |
| เดบิต / เครดิต (บรรทัดรายการบัญชี) | Dr / Cr | `gl_journal_detail.debit_or_credit` 0 / 1 | ข้อมูลรายวัน | [[term-gl-journal]] |
| เดือนภาษี / ปีภาษี | tax period | `vat_effective_period` · `vat_effective_year` (ค.ศ.) | แท็บภาษี | [[term-vat-type]] |
| ต้นทุนเฉลี่ย | moving average | `cost_type` 0 · `average_cost` · `CalculateMovingAverage` | จอสินค้า "1.ต้นทุนเฉลี่ย" | [[term-cost-type]] |
| ต้นทุนแบบพิเศษ 1 | special cost 1 | `cost_type` 5 | จอสินค้า "6.ต้นทุนแบบพิเศษ 1" | [[term-cost-type]] |
| ต้นทุนมาตรฐาน | standard cost | `cost_type` 4 | จอสินค้า "5.ต้นทุนมาตรฐาน" | [[term-cost-type]] |
| ต้นทุนรวมของบรรทัด | sum of cost | `ic_trans_detail.sum_of_cost` | — | [[term-stock-balance]] |
| ต้นทุน/หน่วย (หัวคอลัมน์เอกสารสต็อก) | unit cost | `price` ของบรรทัด | เอกสารสต็อก (`transLayouts.ts:365`) | [[term-cost-type]] |
| ต้นทุน FEFO (วันหมดอายุ) | FEFO | `cost_type` 3 | จอสินค้า "4.ต้นทุน FEFO (วันหมดอายุ)" | [[term-cost-type]] |
| ต้นทุน LOT กำหนดเอง | specific lot | `cost_type` 2 | จอสินค้า "3.ต้นทุน LOT กำหนดเอง" | [[term-cost-type]] |
| ต้นทุน LOT FIFO | FIFO | `cost_type` 1 | จอสินค้า "2.ต้นทุน LOT FIFO" | [[term-cost-type]] |
| ตรวจงวดบัญชี | period check | `checkOpenPeriod` · `checkCancelPeriod` | ข้อความเตือนตอนบันทึก/ยกเลิก | [[term-account-period]] |
| ตรวจสอบวงเงินรวมรายการสั่งขาย/สั่งจอง | SR/SS credit check | `erp_option.sr_ss_credit_check` | ข้อเลือกพิเศษ แท็บระบบขาย | [[term-credit-due]] |
| ตั้งหนี้ | debt setup | กลุ่ม 1 (เช่น 12, 44, 87, 99) | รายงานสถานะเจ้าหนี้/ลูกหนี้ | [[term-ap-ar-balance]] |
| ตัวตั้ง | stand value | `stand_value` · `standValue` | กริดหน่วยนับสินค้า | [[term-unit-ratio]] |
| ตัวย่อเอกสาร / รหัสจอ | screen code | `screenCode` เช่น SI, PU, IM | `transMenuMap.ts` | [[term-trans-flag]] |
| ตัวหาร | divide value | `divide_value` · `divideValue` | กริดหน่วยนับสินค้า | [[term-unit-ratio]] |
| ตารางที่เอกสารลง | TransKind | `kind` | `transMenuMap.ts:3` | [[term-trans-flag]] |
| ตารางระดับแพลตฟอร์ม | bc | `bc_*` | — | [[term-module-prefix]] |
| ถอนเงิน | WM | `trans_flag` 402 · `cb_trans` | จอ WM (`transMenuMap.ts:1902`) | [[term-pay-tenders]] |
| ทะเบียน Serial Number | serial register | `ic_serial` | ทะเบียน Serial Number `menu_ic_item_serial` | [[term-lot-serial-expire]] |
| ทิศทางสต็อก (เข้า/ออก) | calc flag | `calc_flag` +1 / −1 / 0 · `calcFlagByTransFlag` | คำนวณที่ backend | [[term-trans-flag]] |
| ที่เก็บ / พื้นที่เก็บ | shelf / location | `ic_shelf` · `shelf_code` · `location_from` | หัวเอกสาร "พื้นที่เก็บ:" / กริด | [[term-wh-shelf]] |
| ที่มาของราคา | price type (line) | `ic_trans_detail.price_type` -1 / 1-7 / 99 | — | [[term-price-discount]] |
| ทุน | equity | `account_type` 2 | ผังบัญชี | [[term-chart-of-account]] |
| นำฝากเช็ค | deposit cheque | `trans_flag` 410 → `status` 1 | เมนูเช็ครับ | [[term-cheque-status]] |
| บรรทัดสินค้าในเอกสาร | ic trans detail | `ic_trans_detail` | กริดสินค้า | [[term-module-prefix]] |
| บัญชีหลัก / ผังบัญชีหลัก | main account | `status` 1 · `main_code` | ผังบัญชี | [[term-chart-of-account]] |
| บัตรเครดิต (ช่องทางชำระ) | credit card | `doc_type` 3 คู่กับ `cb_chq_list` | แท็บการชำระเงิน | [[term-pay-tenders]] |
| บันทึกบัญชีเอง | manual journal | `trans_direct` 1 | ข้อมูลรายวัน | [[term-gl-journal]] |
| บาร์โค้ด | barcode | `ic_inventory_barcode` · `barcode` | จอบาร์โค้ดสินค้า | [[term-barcode]] |
| เบิกสินค้า | IO | `trans_flag` 56 | จอ IO (`transMenuMap.ts:996`) | [[term-trans-flag]] |
| ใบรับวางบิล (เจ้าหนี้) | DD | `trans_flag` 213 | จอ DD (`transMenuMap.ts:1345`) | [[term-ap-ar-balance]] |
| ใบวางบิล (ลูกหนี้) | ED | `trans_flag` 235 | จอ ED (`transMenuMap.ts:1544`) | [[term-ap-ar-balance]] |
| ใบสั่งขาย | SS | `trans_flag` 36 | จอ SS (`transMenuMap.ts:631`) | [[term-trans-flag]] |
| ใบสั่งจอง | SR | `trans_flag` 34 | จอ SR (`transMenuMap.ts:586`) | [[term-trans-flag]] |
| ใบสั่งซื้อ | PO | `trans_flag` 6 | จอ PO (`transMenuMap.ts:99`) | [[term-trans-flag]] |
| ใบเสนอซื้อ | PR | `trans_flag` 2 | จอ PR (`transMenuMap.ts:56`) | [[term-trans-flag]] |
| ใบเสนอราคา | SO | `trans_flag` 30 | จอ SO (`transMenuMap.ts:543`) | [[term-trans-flag]] |
| ประเภทคู่ค้าในเอกสารเงิน | AP/AR type | `ap_ar_type` 1 ลูกหนี้ · 2 เจ้าหนี้ | — | [[term-pay-tenders]] |
| ประเภทเงินได้ | income type | `gl_wht_list_detail.income_type` | แท็บ WHT | [[term-wht]] |
| ประเภทต้นทุน | cost type | `ic_inventory.cost_type` 0-5 | จอสินค้า (`ItemScreen.tsx:2446`) | [[term-cost-type]] |
| ประเภทบัญชี | account type | `account_type` 0-4 | ผังบัญชี | [[term-chart-of-account]] |
| ประเภทปี | year type | `erp_option.year_type` | ข้อเลือกพิเศษ แท็บตั้งค่าระบบ | [[term-buddhist-year]] |
| ประเภทภาษี (เอกสาร) | VAT type | `ic_trans.vat_type` 0-3 | หัวเอกสาร | [[term-vat-type]] |
| ประเภทรายการ (เงินสด/เงินเชื่อ) | inquiry type | `inquiry_type` · `InquiryType` | หัวเอกสาร (`transLayouts.ts:35-51`) | [[term-inquiry-type]] |
| ประเภทรายการบัญชี | journal type | `journal_type` 0 รายวัน · 1 ยกมางวด · 2 ปิดงวด · 3 ปรับปรุง · 4 ยอดยกมา | — | [[term-gl-journal]] |
| ประเภทลูกหนี้ | AR type | `ar_type` | กำหนดลูกหนี้ | [[term-party-ap-ar]] |
| ประเภทสินค้า | item type | `ic_inventory.item_type` 0-6 | จอสินค้า (`ItemScreen.tsx:2237`) | [[term-item-type]] |
| ประเภทหน่วยนับ | unit type | `unit_type` 0-3 | จอสินค้า (`ItemScreen.tsx:2376`) | [[term-unit-ratio]] |
| ประมวลผลสิ้นงวด | end of period | `menu_gl_end_of_period` | bcMenu.json:9638 | [[term-account-period]] |
| ประมวลผลสิ้นปี | end of year | `menu_gl_end_of_year` | bcMenu.json:9652 | [[term-account-period]] |
| ปรับปรุงสินค้าเพิ่ม | IA | `trans_flag` 66 | จอ IA (`transMenuMap.ts:1149`) | [[term-trans-flag]] |
| ปรับปรุงสินค้าลด | IS | `trans_flag` 68 | จอ IS (`transMenuMap.ts:1163`) | [[term-trans-flag]] |
| ปลายทาง (เข้าสาขา/ฝ่าย/แผนก/โครงการ) | ...To | `branch_code_to` · `side_code_to` · `department_code_to` … | แท็บรายละเอียดเพิ่มเติม (`TransExtraTabs.tsx:414`) | [[term-dimension-project-side-job]] |
| ปิดเข้าบัญชี | close to account | `account_close` | ผังบัญชี | [[term-chart-of-account]] |
| ปิดงวดบัญชี | closed period | `erp_account_period.status` 1 | กำหนดงวดบัญชี | [[term-account-period]] |
| ปีบัญชี | period year | `period_year` | กำหนดงวดบัญชี | [[term-account-period]] |
| เปลี่ยนเช็คจ่าย | replace cheque | `trans_flag` 456 → `status` 7 | จอเช็คจ่าย (`transMenuMap.ts:2193-2253`) | [[term-cheque-status]] |
| เปลี่ยนเช็ค (เช็ครับ) | replace cheque | `trans_flag` 416 → `status` 7 | เมนูเช็ครับ | [[term-cheque-status]] |
| ผลกระทบต่องบการเงิน | balance sheet status | `balance_sheet_status` 0-5 | ผังบัญชี | [[term-chart-of-account]] |
| ผสมสี / สีผสม | mixed color | `item_type` 6 | จอสินค้า "7.ผสมสี" | [[term-item-type]] |
| ผังบัญชี | chart of account | `gl_chart_of_account` | รายละเอียดผังบัญชี `menu_chart_of_account` | [[term-chart-of-account]] |
| ผ่านรายการ | post | `is_pass` 1 | ผ่านรายการ `menu_gl_journal_pass` (bcMenu.json:9493) | [[term-gl-journal]] |
| ผู้จัดการคลัง | warehouse manager | `wh_manager` | จอคลังสินค้า (`icWarehouse.ts:75`) | [[term-wh-shelf]] |
| ผู้ติดต่อ | contact | `contactor` (ข้อความอิสระ) | หัวเอกสาร (`TransTopForm.tsx:261`) | [[term-party-ap-ar]] |
| ผู้ผลิต (ในเอกสาร) | manufacturer | `mfn_name` | คอลัมน์กริดสินค้า | [[term-lot-serial-expire]] |
| ผู้อนุมัติขายเกินวงเงิน | credit approver | `ic_trans.user_approve` · `password_ar_credit` | จอขาย | [[term-credit-due]] |
| แผนก | department | `department_code` · `erp_department_list` | หัวเอกสาร "แผนก:" / กำหนดรายละเอียดแผนก | [[term-dimension-project-side-job]] |
| ฝากเงิน | DM | `trans_flag` 401 · `cb_trans` | จอ DM (`transMenuMap.ts:1887`) | [[term-pay-tenders]] |
| ฝ่าย / หน่วยงาน | side | `side_code` · `erp_side_list` | หัวเอกสาร "ฝ่าย:" / กำหนดหน่วยงาน | [[term-dimension-project-side-job]] |
| พนักงานขาย | salesman | `sale_code` → `erp_user` | หัวเอกสาร "พนักงานขาย:" | [[term-dimension-project-side-job]] |
| พร้อมเพย์ / QR / e-Wallet | PromptPay | `doc_type` 21 | แท็บการชำระเงิน | [[term-pay-tenders]] |
| พักเอกสาร (รอตรวจวงเงิน) | hold | `is_hold` · `erp_credit_request` | สั่งจอง / สั่งขาย | [[term-credit-due]] |
| พุทธศักราช (พ.ศ.) | Buddhist era | `year_type` 1 · `formatBcDate` | การแสดงวันที่ทุกจอ | [[term-buddhist-year]] |
| เพิ่มหนี้ | debit note | กลุ่ม 2 (เช่น 14, 46, 89, 101) | รายงานสถานะเจ้าหนี้/ลูกหนี้ | [[term-ap-ar-balance]] |
| เพิ่มหนี้ (ขาย) | SA | `trans_flag` 46 | จอ SA (`transMenuMap.ts:890`) | [[term-trans-flag]] |
| เพิ่มหนี้ (ซื้อ) | PA | `trans_flag` 14 | จอ PA (`transMenuMap.ts:479`) | [[term-trans-flag]] |
| ภ.ง.ด.3 | PND3 | `cust_tax_type` 0 | รายงาน ภ.ง.ด.3 (bcMenu.json:9917) | [[term-wht]] |
| ภ.ง.ด.53 | PND53 | `cust_tax_type` 1 | รายงาน ภ.ง.ด.53 (bcMenu.json:9905) | [[term-wht]] |
| ภาษีขอคืนไม่ได้ | non-refundable VAT | `VAT_TYPES.buy` ค่า 1 | แท็บภาษีซื้อ (`JournalTaxTabs.tsx:225`) | [[term-vat-type]] |
| ภาษีขาย | output VAT | `gl_journal_vat_sale` | แท็บภาษี (`JournalTaxTabs.tsx`) | [[term-vat-type]] |
| ภาษีซื้อ | input VAT | `gl_journal_vat_buy` | แท็บภาษี (`JournalTaxTabs.tsx`) | [[term-vat-type]] |
| ภาษีถูกหัก ณ ที่จ่าย | WHT (ถูกหัก) | `gl_wht_list` ของ flag ฝั่ง ar | ภาษีถูกหัก ณ. ที่จ่าย (bcMenu.json:9929) | [[term-wht]] |
| ภาษีไม่ถึงกำหนดชำระ | VAT not due | `VAT_TYPES` ซื้อ 2 / ขาย 1 | ปุ่ม "ค้นหาใบกำกับภาษีไม่ถึงกำหนดชำระ" (`JournalTaxTabs.tsx:743`) | [[term-vat-type]] |
| ภาษีหัก ณ ที่จ่าย | WHT | `gl_wht_list` · `gl_wht_list_detail` | แท็บ WHT / รายงาน (bcMenu.json:9892) | [[term-wht]] |
| มูลค่ายกเว้นภาษี | except VAT | `total_except_vat` | ท้ายเอกสาร (`TransBottomPanel.tsx:382`) | [[term-doc-totals]] |
| มูลค่าส่วนลด | total discount | `total_discount` | ท้ายเอกสาร (`TransBottomPanel.tsx:347`) | [[term-doc-totals]] |
| มูลค่าสุทธิ (สกุลเงิน) | amount in currency | `total_amount_2` | ท้ายเอกสาร (`TransBottomPanel.tsx:123`) | [[term-currency-fx]] |
| มูลค่าหลังคิดภาษี | after VAT | `total_after_vat` | ท้ายเอกสาร (`TransBottomPanel.tsx:376`) | [[term-doc-totals]] |
| ไม่กระทบภาษี | no VAT | `vat_type` 3 (ไม่สร้างแถวภาษี) | หัวเอกสาร | [[term-vat-type]] |
| ไม่อนุมัติ | not approved | `approve_status` 2 · `not_approve_1` | เอกสารที่มีขั้นอนุมัติ | [[term-last-status-cancel-approve]] |
| ยกเลิกขาย | cancel | `trans_flag` 45 ← 44 · `origFlag` | จอยกเลิกขาย (`transMenuMap.ts:844`) | [[term-last-status-cancel-approve]] |
| ยกเลิกจ่ายชำระหนี้ | cancel | `trans_flag` 23 ← 19 | เมนูยกเลิกฝั่งหนี้ | [[term-last-status-cancel-approve]] |
| ยกเลิกซื้อ | cancel | `trans_flag` 13 ← 12 | เมนูยกเลิกฝั่งซื้อ | [[term-last-status-cancel-approve]] |
| ยกเลิกทั้งหมด / ยกเลิกรายสินค้า | cancel type | `cancel_type` 1 / 2 | จอยกเลิกเอกสาร | [[term-last-status-cancel-approve]] |
| ยกเลิกบัตรเครดิต | — | `trans_flag` 462 | จอบัตรเครดิต (`transMenuMap.ts:2353`) | [[term-cheque-status]] |
| ยกเลิกใบสั่งซื้อ | cancel | `trans_flag` 7 ← 6 | เมนูยกเลิกฝั่งซื้อ | [[term-last-status-cancel-approve]] |
| ยกเลิกรับชำระหนี้ | cancel | `trans_flag` 240 ← 239 | เมนูยกเลิกฝั่งหนี้ | [[term-last-status-cancel-approve]] |
| ยกเลิกโอนออก | cancel | `trans_flag` 73 ← 72 | เมนูยกเลิกฝั่งสต็อก | [[term-last-status-cancel-approve]] |
| ยกเว้นภาษี | zero / exempt VAT | `vat_type` 2 | หัวเอกสาร | [[term-vat-type]] |
| ยอดคงเหลือสินค้า | stock balance | `ic_inventory.balance_qty` · `balance_qty_2` | ยอดคงเหลือสินค้า (bcMenu.json:2621) | [[term-stock-balance]] |
| ยอดคงเหลือสินค้าตามคลัง | balance by warehouse | คำนวณในรายงาน ไม่ได้เก็บใน `ic_inventory` | bcMenu.json:2634 | [[term-stock-balance]] |
| ยอดคงเหลือสินค้าตาม LOT | balance by lot | `ic_trans_detail_lot` | bcMenu.json:2660 | [[term-lot-serial-expire]] |
| ยอดเงินก่อนภาษี | before VAT | `total_before_vat` | ท้ายเอกสาร (`TransBottomPanel.tsx:364`) | [[term-doc-totals]] |
| ยอดชำระ (ต่อบิล) | pay money | `sum_pay_money` | จอชำระหนี้ | [[term-ap-ar-balance]] |
| ยอดภาษีมูลค่าเพิ่ม | VAT amount | `total_vat_value` | ท้ายเอกสาร (`TransBottomPanel.tsx:370`) | [[term-doc-totals]] |
| ยอดยกมา (บัญชี) | opening balance | `journal_type` 4 | รายงานงบทดลอง | [[term-gl-journal]] |
| ยอดสกุลเงินเอกสาร | FX amount | คอลัมน์ `*_2` เช่น `price_2`, `total_value_2` | ท้ายเอกสาร "(สกุลเงิน)" | [[term-currency-fx]] |
| ยื่นเพิ่มเติม | additional filing | `is_add` | แท็บภาษี | [[term-vat-type]] |
| แยกนอก | exclude VAT | `vat_type` 0 | หัวเอกสาร | [[term-vat-type]] |
| รวมใน | include VAT | `vat_type` 1 | หัวเอกสาร | [[term-vat-type]] |
| รวมมูลค่าทั้งสิ้น | total amount | `total_amount` | ท้ายเอกสาร (`TransBottomPanel.tsx:387`) | [[term-doc-totals]] |
| รวมมูลค่าสินค้า | total value | `total_value` · `totalValue` | ท้ายเอกสาร (`TransBottomPanel.tsx:330`) | [[term-doc-totals]] |
| รหัสคู่ค้า (หัวเอกสาร) | customer/supplier code | `ic_trans.cust_code` · `custCode` | "เจ้าหนี้/ผู้จำหน่าย:" / "ลูกหนี้/ลูกค้า:" | [[term-party-ap-ar]] |
| รหัสบัญชี | account code | `code` (ตัวพิมพ์ใหญ่ ไม่เกิน 25 ตัว) | ผังบัญชี | [[term-chart-of-account]] |
| รหัสบัญชีกระแสเงินสด | cash flow group | `cash_flow_group` → `gl_cash_flow_group` | ผังบัญชี | [[term-chart-of-account]] |
| รหัสเอกสาร | doc format code | `doc_format_code` → `erp_doc_format.code` | กำหนดรูปแบบเลขที่เอกสาร (bcMenu.json:180) | [[term-doc-no-doc-date]] |
| ระงับชั่วคราว | on hold | `on_hold` | หัวเอกสาร (`TransTopForm.tsx:349`) | [[term-credit-due]] |
| ระดับบัญชี | account level | `account_level` 0-7 | ผังบัญชี | [[term-chart-of-account]] |
| ระดับราคาสินค้า (ลูกหนี้) | price level | `ar_customer.price_level` 0-9 | กำหนดลูกหนี้ | [[term-party-ap-ar]] |
| ระบบขาย (เมนู) | so | `menu_so_*` | เมนูขาย (bcMenu.json:4935) | [[term-module-prefix]] |
| ระบบเงินสดและธนาคาร | cb | `cb_*` · `menu_cash_and_bank` | เมนูเงินสด/ธนาคาร (bcMenu.json:7524) | [[term-module-prefix]] |
| ระบบเจ้าหนี้ | ap | `ap_*` · `menu_ap` | เมนูเจ้าหนี้ (bcMenu.json:6040) | [[term-module-prefix]] |
| ระบบซื้อ (เมนู) | po | `menu_po_*` | เมนูซื้อ (bcMenu.json:3825) | [[term-module-prefix]] |
| ระบบทรัพย์สิน (ค่าเสื่อม) | as | `as_*` · `menu_asset` | เมนูทรัพย์สิน (bcMenu.json:9158) | [[term-module-prefix]] |
| ระบบบัญชีแยกประเภท | gl | `gl_*` · `menu_general_ledger_main` | เมนูบัญชี (bcMenu.json:9353) | [[term-module-prefix]] |
| ระบบลูกหนี้ | ar | `ar_*` · `menu_ar` | เมนูลูกหนี้ (bcMenu.json:6776) | [[term-module-prefix]] |
| ระบบสินค้า | ic | `ic_*` · `menu_ic` | เมนูสินค้า (bcMenu.json:1915) | [[term-module-prefix]] |
| ระยะเวลาส่งของ (วัน) | lead time | `ap_supplier_detail.lead_time` | รายละเอียดเจ้าหนี้ | [[term-credit-due]] |
| รับคืนจากการเบิก | IR | `trans_flag` 58 | จอ IR (`transMenuMap.ts:1027`) | [[term-trans-flag]] |
| รับคืนจ่ายเงินมัดจำ | PCR | `trans_flag` 25 | จอ PCR (`transMenuMap.ts:249`) | [[term-deposit-advance]] |
| รับคืนจ่ายเงินล่วงหน้า | PDR | `trans_flag` 20 | จอ PDR (`transMenuMap.ts:233`) | [[term-deposit-advance]] |
| รับคืนสินค้า / ลดหนี้ (ขาย) | ST | `trans_flag` 48 | จอ ST (`transMenuMap.ts:859`) | [[term-trans-flag]] |
| รับเงิน / จ่ายเงิน | pay type | `cb_trans.pay_type` 1 รับ · 2 จ่าย · `payReceiveFlags` | แท็บการชำระเงิน | [[term-pay-tenders]] |
| รับเงินมัดจำ | SRV | `trans_flag` 110 | จอ SRV (`transMenuMap.ts:721`) | [[term-deposit-advance]] |
| รับเงินล่วงหน้า | SD | `trans_flag` 40 | รับเงินล่วงหน้า (bcMenu.json:5038) | [[term-deposit-advance]] |
| รับชำระหนี้ | EE | `trans_flag` 239 · `ap_ar_trans` | จอ EE (`transMenuMap.ts:1573`) | [[term-ap-ar-balance]] |
| รับ/เพิ่ม วงเงินสดย่อย | petty cash | `trans_flag` 301 | `transMenuMap.ts:1813` | [[term-trans-flag]] |
| ราคาขายทั่วไป | general sale price | `price_mode` 1 · `menu_ic_item_saleprice_2` | กำหนดราคาขายทั่วไป (bcMenu.json:2293) | [[term-price-discount]] |
| ราคาขายมาตรฐาน | standard sale price | `ic_inventory_price` (`price_mode` 0) · `menu_ic_item_saleprice` | กำหนดราคาขายมาตรฐาน (bcMenu.json:2280) | [[term-price-discount]] |
| ราคาขายล่าสุด / ราคาขายเฉลี่ย | last price | `erp_option.get_last_price_type` · line `price_type` 7 | ข้อเลือกพิเศษ แท็บระบบขาย | [[term-price-discount]] |
| ราคาจากส่วนกลาง | price center | `use_price_center` · line `price_type` 99 | ข้อเลือกพิเศษ แท็บแลกเปลี่ยนข้อมูล | [[term-price-discount]] |
| ราคาซื้อ | purchase price | `menu_ic_purchase_price` | กำหนดราคาซื้อ (bcMenu.json:2254) | [[term-price-discount]] |
| ราคาต่อหน่วย | price | `price` · `price_2` | คอลัมน์กริดสินค้า | [[term-price-discount]] |
| ราคาตามกลุ่มลูกค้า | customer group price | `ic_inventory_price.price_type` 2 | — | [[term-price-discount]] |
| ราคาตามลูกค้า | customer price | `ic_inventory_price.price_type` 3 | — | [[term-price-discount]] |
| ราคาผิด (ไม่มีผลกับสต๊อกสินค้า) | value-only adjust | `inquiry_type` 1/3 ของ 14/16/311 · `stockValueOnlySQL` | หัวเอกสารลดหนี้/เพิ่มหนี้ | [[term-inquiry-type]] |
| ราคาสมาชิก (บาร์โค้ด) | member price | `priceMember` … `priceMember4` | จอบาร์โค้ดสินค้า | [[term-barcode]] |
| รายการบิลในใบชำระหนี้ | billing lines | `ap_ar_trans_detail` · `billing_no` · `billing_date` | จอชำระหนี้ | [[term-ap-ar-balance]] |
| รายการปรับปรุง | adjustment | `journal_type` 3 | รายงานงบทดลอง | [[term-gl-journal]] |
| รายได้ | revenue | `account_type` 3 | ผังบัญชี | [[term-chart-of-account]] |
| รูปแบบเลขที่เอกสาร | doc format | `erp_doc_format.format` เช่น `@YYMM-####` · `nextDocNo` | `menu_setup_doc_format` | [[term-doc-no-doc-date]] |
| ลดหนี้ | credit note | กลุ่ม 3 (เช่น 16, 48, 91, 103) | รายงานสถานะเจ้าหนี้/ลูกหนี้ | [[term-ap-ar-balance]] |
| ล็อกต้นทุน | lock cost | `sum_of_cost_fix` (Ctrl+F9) | กริดสินค้า | [[term-cost-type]] |
| ลูกหนี้ / ลูกค้า | AR / customer | `ar_customer` · `ar_customer_detail` | กำหนดลูกหนี้ `menu_ar_detail` | [[term-party-ap-ar]] |
| เลขที่บัตรประชาชน | ID card | `card_id` · `card_number` | master คู่ค้า / แถว WHT | [[term-tax-id-branch]] |
| เลขที่ใบกำกับภาษี | tax invoice no | `vat_doc_no` · `vat_number` · `tax_doc_no` | แท็บภาษี | [[term-vat-type]] |
| เลขที่สาขา | branch code | `branch_code` | master คู่ค้า / แท็บภาษี | [[term-tax-id-branch]] |
| เลขที่เอกสาร | doc no | `doc_no` · `docNo` | หัวเอกสาร | [[term-doc-no-doc-date]] |
| เลขที่เอกสารอ้างอิง (บรรทัด) | ref doc no | `ref_doc_no` | คอลัมน์กริด (`TransItemGrid.tsx:356`) | [[term-doc-ref]] |
| เลขประจำตัวผู้เสียภาษี | tax ID | `tax_id` · `tax_no` · `tax_number` | master คู่ค้า / แท็บภาษี | [[term-tax-id-branch]] |
| เลข LOT | lot number | `ic_trans_detail.lot_number_1` | คอลัมน์ "เลข LOT" (`TransItemGrid.tsx:332`) | [[term-lot-serial-expire]] |
| วงเงินสินเชื่อ | credit limit | `credit_money` | รายละเอียดลูกหนี้ (`arCustomerDetail.ts:309`) | [[term-credit-due]] |
| วันที่ผลิต | MFD | `mfd_date` | คอลัมน์กริดสินค้า | [[term-lot-serial-expire]] |
| วันที่หัก ณ ที่จ่าย | WHT date | `gl_wht_list_detail.due_date` | แท็บ WHT (`JournalTaxTabs.tsx:964-968`) | [[term-wht]] |
| วันที่เอกสาร | doc date | `doc_date` · `docDate` | หัวเอกสาร | [[term-doc-no-doc-date]] |
| วันหมดอายุ | expire date | `date_expire` | คอลัมน์กริดสินค้า | [[term-lot-serial-expire]] |
| เวลา (เอกสาร) | doc time | `doc_time` (ว่าง = 08:00) | หัวเอกสาร | [[term-doc-no-doc-date]] |
| สกุลเงิน | currency | `currency_code` · `erp_currency` | กำหนดสกุลเงิน `menu_setup_currency` | [[term-currency-fx]] |
| สกุลเงินหลัก | home currency | `erp_option.home_currency` | ข้อเลือกพิเศษ แท็บตั้งค่าระบบ | [[term-currency-fx]] |
| ส่งคืนสินค้า / ลดหนี้ (ซื้อ) | PT | `trans_flag` 16 | จอ PT (`transMenuMap.ts:388`) | [[term-trans-flag]] |
| สถานประกอบการ (สำนักงานใหญ่/สาขา) | branch type | `branch_type` 0 / 1 · `BRANCH_TYPES` | master คู่ค้า / แท็บภาษี | [[term-tax-id-branch]] |
| สถานะการใช้เอกสาร / ใช้ครบ | doc flow status | `used_status` · `used_status_2` · `doc_success` | คำนวณจาก doc_flow (`doc_flow.go:14-17`) | [[term-doc-ref]] |
| สถานะเช็ค | cheque status | `cb_chq_list.status` | รายงานเช็ค (`report_menu_cb.go:152`) | [[term-cheque-status]] |
| สถานะผู้จำหน่าย | AP status | `ap_status` | กำหนดเจ้าหนี้ | [[term-party-ap-ar]] |
| สถานะยกเลิก | cancel status | `last_status` 0 ปกติ · 1 ยกเลิก | ทุกเอกสาร | [[term-last-status-cancel-approve]] |
| สถานะลูกหนี้ | AR status | `ar_status` 0 บุคคลธรรมดา · 1 นิติบุคคล | กำหนดลูกหนี้ | [[term-party-ap-ar]] |
| สถานะอนุมัติ | approve status | `approve_status` 0 / 1 / 2 | เอกสารที่มีขั้นอนุมัติ | [[term-last-status-cancel-approve]] |
| สมาชิก | dealer / member | `ar_dealer` | รายละเอียดสมาชิก `menu_ar_dealer` | [[term-party-ap-ar]] |
| สมุดบัญชี | journal book | `gl_journal_book` · `book_code` | กำหนดสมุดบัญชี (bcMenu.json:1205) | [[term-gl-journal]] |
| สมุดรายวัน / รายการบัญชี | GL journal | `gl_journal` · `gl_journal_detail` | ข้อมูลรายวัน (bcMenu.json:9416) | [[term-gl-journal]] |
| ส่วนลดก่อนภาษี | discount word | `discount_word` (ข้อความสูตร) | ท้ายเอกสาร (`TransBottomPanel.tsx:336`) | [[term-doc-totals]] |
| ส่วนลด (บรรทัด) | discount word | `discount` (ข้อความ) · `discount_amount` | คอลัมน์กริดสินค้า | [[term-price-discount]] |
| ส่วนลดสินค้า | item discount | `ic_inventory_discount` · `discount_type` 0/1/2 | กำหนดส่วนลดสินค้า (bcMenu.json:2306) | [[term-price-discount]] |
| สินค้าค้างรับ | accrued in qty | `menu_report_accrued_in_qty` | รายงานสรุปยอดสินค้าค้างรับ (bcMenu.json:3406) | [[term-stock-balance]] |
| สินค้าค้างส่ง | sale remain | `menu_ic_report_sale_remain` | รายงานสรุปยอดสินค้าค้างส่ง (bcMenu.json:3393) | [[term-stock-balance]] |
| สินค้าชุด | item set (BOM) | `item_type` 3 · `isSetItem` | สินค้าชุด `menu_ic_item_set` | [[term-item-type]] |
| สินค้าทั่วไป | normal item | `item_type` 0 | จอสินค้า "1.สินค้าทั่วไป" | [[term-item-type]] |
| สินค้าบริการ | service | `item_type` 1 | จอสินค้า "2.บริการ" | [[term-item-type]] |
| สินค้าฝากขาย | consignment | `item_type` 4 | จอสินค้า "5.สินค้าฝากขาย" | [[term-item-type]] |
| สินค้ามี Serial | serial item | `ic_inventory.ic_serial_no` | จอสินค้า | [[term-lot-serial-expire]] |
| สินค้ายกมา | IB | `trans_flag` 54 | จอ IB (`transMenuMap.ts:924`) | [[term-trans-flag]] |
| สินค้าให้เช่า | rental | `item_type` 2 | จอสินค้า "3.สินค้าให้เช่า" | [[term-item-type]] |
| สินทรัพย์ | asset | `account_type` 0 | ผังบัญชี | [[term-chart-of-account]] |
| สูตรราคาขาย | price formula | `ic_inventory_price_formula` · `price_0..price_9` | กำหนดสูตรราคาขาย (bcMenu.json:2332) | [[term-price-discount]] |
| สูตรส่วนลด | discount formula | `calcDiscountOnly` | ปุ่ม "สูตร" (`TransItemGrid.tsx:202`) | [[term-price-discount]] |
| สูตรสี / สูตรการผลิต | formula item | `item_type` 5 | จอสินค้า "6.สูตรสี" | [[term-item-type]] |
| แสดงเอกสารเฉพาะสาขา | branch doc only | `erp_option.show_branch_doc_only` | ข้อเลือกพิเศษ แท็บตั้งค่าระบบ | [[term-erp-option]] |
| หน่วยช่วยขาย | second unit | `ic_trans_detail.unit_code_2` · `unitCode2` | คอลัมน์กริด (`TransItemGrid.tsx:365`) | [[term-unit-ratio]] |
| หน่วยต้นทุน | cost unit | `ic_inventory.unit_cost` | จอสินค้า | [[term-unit-ratio]] |
| หน่วยนับ | unit | `ic_unit` · `ic_unit_use` | กำหนดหน่วยนับสินค้า (bcMenu.json:399) | [[term-unit-ratio]] |
| หน่วยนับขนาน | parallel unit | `ic_opposite_unit` | จอสินค้า "3.หน่วยนับขนาน" | [[term-unit-ratio]] |
| หน่วยยอดคงเหลือ | stock unit | `ic_inventory.unit_standard` | จอสินค้า | [[term-unit-ratio]] |
| หนี้ค้าง / ยอดหนี้คงเหลือ | debt balance | คำนวณสดจากเอกสาร (`ap_supplier.debt_balance` ไม่มีโค้ดอัปเดต) | รายงานหนี้ค้าง | [[term-ap-ar-balance]] |
| หนี้สิน | liability | `account_type` 1 | ผังบัญชี | [[term-chart-of-account]] |
| หักเงินมัดจำ | advance | `advance_amount` · `cb_trans_detail.doc_type` 5/6 | ท้ายเอกสาร (`TransBottomPanel.tsx:353`) | [[term-deposit-advance]] |
| หัวเอกสารซื้อขาย/สต็อก | ic trans | `ic_trans` | ทุกจอเอกสารสินค้า | [[term-module-prefix]] |
| ห้ามใส่จำนวนเกินเอกสารอ้างอิง | qty over ref | `erp_option.check_qty_over_doc_ref` | ข้อเลือกพิเศษ แท็บระบบขาย | [[term-doc-ref]] |
| อนุมัติใบสั่งขาย | approve | `trans_flag` 52 ← 36 | `transMenuMap.ts:647` | [[term-last-status-cancel-approve]] |
| อนุมัติใบสั่งจอง | approve | `trans_flag` 38 ← 34 | `transMenuMap.ts:602` | [[term-last-status-cancel-approve]] |
| อนุมัติใบสั่งซื้อ | approve | `trans_flag` 8 ← 6 | `transMenuMap.ts:115` | [[term-last-status-cancel-approve]] |
| อนุมัติใบเสนอซื้อ | approve | `trans_flag` 4 ← 2 | `transMenuMap.ts:70` | [[term-last-status-cancel-approve]] |
| อนุมัติใบเสนอราคา | approve | `trans_flag` 32 ← 30 | `transMenuMap.ts:557` | [[term-last-status-cancel-approve]] |
| อัตราภาษี | tax rate | `vat_rate` · `tax_rate` | แท็บภาษี | [[term-vat-type]] |
| อัตราภาษีมูลค่าเพิ่ม (ค่าตั้ง) | VAT rate option | `erp_option.vat_rate` | ข้อเลือกพิเศษ แท็บบัญชีแยกประเภท | [[term-erp-option]] |
| อัตราแลกเปลี่ยน | exchange rate | `exchange_rate` · `exchange_rate_present` | ท้ายเอกสาร "อัตราแลกเปลี่ยน:" (`TransBottomPanel.tsx:162`) | [[term-currency-fx]] |
| เอกสารต้นทาง (ของจอยกเลิก/อนุมัติ) | original flag | `origFlag` | `TransMenuConfig` | [[term-last-status-cancel-approve]] |
| เอกสารหนี้ร่วม (เจ้าหนี้และลูกหนี้) | ap_ar | `ap_ar_trans` · `ap_ar_trans_detail` | จอชำระหนี้ / วางบิล | [[term-module-prefix]] |
| เอกสารอ้างอิง | doc ref | `doc_ref` · `doc_ref_date` | หัวเอกสาร "เอกสารอ้างอิงวันที่:" (`TransTopForm.tsx:422`) | [[term-doc-ref]] |
| โอนเข้า | — | `trans_flag` 70 | ค่าคงที่ `trans.go:18-27` | [[term-wh-shelf]] |
| โอนเงิน (เอกสาร) | TM | `trans_flag` 422 | จอ TM (`transMenuMap.ts:1917`) | [[term-pay-tenders]] |
| โอนออก | IM | `trans_flag` 72 | จอ IM (`transMenuMap.ts:1073`) | [[term-wh-shelf]] |
| โอน GL | GL transfer type | `erp_option.gl_trans_type` 0 / 1 | ข้อเลือกพิเศษ แท็บบัญชีแยกประเภท | [[term-gl-journal]] |
| Serial Number ในเอกสาร | serial in doc | `ic_trans_serial_number` · `serials[]` | กริดสินค้า | [[term-lot-serial-expire]] |

## โน้ตกลุ่มคำ (31)
[[term-account-period]] · [[term-ap-ar-balance]] · [[term-barcode]] · [[term-buddhist-year]] · [[term-chart-of-account]] · [[term-cheque-status]] · [[term-cost-type]] · [[term-credit-due]] · [[term-currency-fx]] · [[term-deposit-advance]] · [[term-dimension-project-side-job]] · [[term-doc-no-doc-date]] · [[term-doc-ref]] · [[term-doc-totals]] · [[term-erp-option]] · [[term-gl-journal]] · [[term-inquiry-type]] · [[term-item-type]] · [[term-last-status-cancel-approve]] · [[term-lot-serial-expire]] · [[term-module-prefix]] · [[term-party-ap-ar]] · [[term-pay-tenders]] · [[term-price-discount]] · [[term-stock-balance]] · [[term-tax-id-branch]] · [[term-trans-flag]] · [[term-unit-ratio]] · [[term-vat-type]] · [[term-wh-shelf]] · [[term-wht]]

## ดูต่อ
[[acc-trans-flag-map]] · [[acc-vat-register-wht]] · [[acc-gl-posting-standard]] · [[acc-rounding-decimal]] · [[proc-wh-shelf-permission]] · [[tbl-ic-trans]] · [[tbl-ic-trans-detail]] · [[tbl-ic-inventory]] · [[tbl-erp-option]]

## ที่มาในโค้ด
- ชื่อเอกสาร ตัวย่อจอ และ `trans_flag`: `frontend/account/tabs/transMenuMap.ts:3`, `:54-2380`; ค่าคงที่ `backend/internal/application/process/trans.go:18-27`
- ทิศทางสต็อกและแถวที่นับเป็นสต็อก: `backend/internal/application/process/transcalc.go:9-27`; `stock_rebuild.go:15-29`; `service.go:1066-1072`
- ป้ายหัวเอกสาร ท้ายเอกสาร และกริด: `frontend/account/transaction/TransTopForm.tsx`, `TransBottomPanel.tsx:104-387`, `TransItemGrid.tsx`, `TransExtraTabs.tsx:414-456`, `transLayouts.ts:35-59`
- แท็บภาษีและ WHT: `frontend/account/transaction/JournalTaxTabs.tsx:225`, `:236-275`, `:743`, `:964-968`; `backend/internal/application/process/journaltax.go:38-68`
- master และ enum: `frontend/account/master/ItemScreen.tsx:2237-2243`, `:2376-2379`, `:2446-2451`; `frontend/src/config/schemas/masterDetailSchemas.ts:249-265`, `:1563-1592`; `icMasterSchemas.ts:491-495`, `:807-830`
- ข้อเลือกพิเศษ: `frontend/src/config/schemas/erpOption/index.ts:30`, `:46-59` และไฟล์ `tab*.ts`
- เมนู: `frontend/src/config/bcMenu.json` (บรรทัดตามที่ระบุในแต่ละแถว)
- ยกเลิก/อนุมัติ เช็ค งวดบัญชี และสกุลเงิน: `backend/internal/application/process/doc_cancel.go:17-292`; `cheque.go:8-24`; `period.go:13-62`; `fx.go:16-188`
