---
title: "กำหนดข้อเลือกพิเศษต่างๆ (OptionsForm)"
tags: [screens, config]
aliases: ["OptionsForm", "1002", "menu_option", "ข้อเลือกพิเศษ", "ตั้งค่าระบบ", "erp_option", "ประเภทธุรกิจ"]
sources: ["frontend/account/tabs/screenRegistry.tsx:267", "frontend/account/config/OptionsForm.tsx:34", "frontend/account/config/OptionsForm.tsx:72", "frontend/account/config/OptionsForm.tsx:149", "frontend/account/config/OptionsForm.tsx:206", "frontend/account/config/OptionsForm.tsx:286", "frontend/account/config/OptionsForm.tsx:457", "frontend/src/config/schemas/erpOption/index.ts:22", "frontend/src/config/schemas/erpOption/index.ts:35", "frontend/src/config/editionConfig.ts:47", "frontend/src/config/editionConfig.ts:301", "frontend/src/config/bcMenu.ts:277"]
---
# กำหนดข้อเลือกพิเศษต่างๆ (OptionsForm)

จอตั้งค่ากลางของทั้งระบบ รวม "สวิตช์เปิด/ปิดความสามารถ" ของ BC Ai Account ไว้หน้าเดียว (ทศนิยม ภาษี VAT การคุมสต็อกติดลบ เงื่อนไขการขาย การเชื่อมต่อ QR/e-Tax/ขนส่ง ฯลฯ) ค่าที่ตั้งจะถูกอ่านโดยจอเอกสารและจอสินค้าอื่น ๆ เช่น [[scr-universal-trans]] และ [[scr-item-master]]
ฟอร์มสร้างจาก schema ผ่าน `SchemaForm` / `FieldControl` ตัวเดียวกับ [[scr-company-profile]]

## วิธีเปิด
- เมนู **ตั้งค่า > ตั้งค่า ERP > กำหนดข้อเลือกพิเศษต่างๆ** รหัสเมนู `1002` (`menu_option`) ผูกกับ `OptionsForm` ที่ `screenRegistry.tsx:267-270`
- `menu_option` อยู่ใน `ADMIN_ONLY_MENU_SET` (`bcMenu.ts:277-280`) จึงเห็นเฉพาะผู้ดูแลระบบ
- กลไกเมนู/รหัสดู [[fe-screen-registry-menu]]

## โครงหน้าจอ
หน้าเดียวเลื่อนลง (ไม่ใช่แท็บสลับ) มี 3 ส่วน (`OptionsForm.tsx:364-668`)
1. **แถบหัว `ScreenHeader`** มีปุ่มบันทึก / ปิด / ตัวนับช่องที่แก้ / เวลาบันทึกล่าสุด บันทึกได้เมื่อมีช่องที่แก้และมีสิทธิ์แก้ไข `canSave={anyDirty && rights.canEdit}` (`:373`) คีย์ลัดมีแค่ Ctrl+S และ Esc (รายละเอียด `ScreenHeader` ดู [[scr-company-profile]])
2. **แถบ "ข้ามไปยังส่วน"** ปุ่มลัดเลื่อนไปแต่ละส่วนด้วย `scrollIntoView` (`jumpToSection`, `:356-362`) พร้อมป้าย "แก้ไขแล้ว N ช่อง" แยกตามส่วน (`dirtyByTab`, `:198`)
3. **ส่วนที่ 0 เลือกประเภทธุรกิจ** แล้วตามด้วยส่วนที่ 1..N ของค่ากำหนดแต่ละหมวด (`visibleOptionTabs.map`, `:605`)

## ส่วนที่ 0 เลือกประเภทธุรกิจ (`id="opt-sec-business_types"`, `:457`)
- เลือกได้หลายประเภทพร้อมกัน **ธุรกิจทั่วไป (`general`) ล็อกเป็นฐานเสมอ** (ข้อความหัวส่วน `:466-472`)
- การ์ดประเภทธุรกิจมาจาก `BC_BUSINESS_TYPES` (`editionConfig.ts:301`) รวม 17 ประเภท ได้แก่ general, retail, wholesale, construction, pharmacy, animal_feed, fertilizer, it_mobile, auto_parts, gold_jewelry, optical_shop, food_beverage, cosmetics_clinic, fashion_apparel, agri_buying_mill, water_gas_packaging, furniture_appliance_leasing
- การ์ดแต่ละใบแสดงป้าย "เปิดใช้" หรือ "+N ช่อง" (จำนวนช่องเพิ่มเติมของสินค้า + ลูกหนี้ `:540-547`) และบรรทัด `authorityBadge` (มาตรฐานอ้างอิงของธุรกิจนั้น)
- แถบสรุป (`:561-600`) บอกว่าเปิดช่องเพิ่มของ "สินค้า" และ "ลูกหนี้" กี่ช่อง และมีปุ่มลัดเปิดจอเฉพาะธุรกิจ (`featuredMenus` -> `tabsCtx.openScreen(menuKey)`)
- ปุ่มส่วนหัวที่โผล่เมื่อเลือกธุรกิจเฉพาะทาง (`specializedCount > 0`, `:476`)
  - **ตั้งค่าข้อเลือกแนะนำอัตโนมัติ** เรียก `applyRecommendedOptions` (`:140-145`) เขียนค่าแนะนำของธุรกิจที่เลือกลงช่องในฟอร์ม (ยังไม่บันทึกจนกว่ากดบันทึก)
  - **ซ่อนช่องเฉพาะทางทั้งหมด** ตั้ง `businessTypes` กลับเป็น `["general"]`
- ค่าประเภทธุรกิจอ่านจากคอลัมน์ `business_types` ของ `erp_option` ถ้ามี: ตอนโหลดถ้าค่าใน DB มีมากกว่า 1 ประเภทและค่าในหน่วยความจำมีไม่เกิน 1 จะใช้ค่าจาก DB (`:166-173`)

## ส่วนค่ากำหนด 9 หมวด (schema `erpOptionSchema`)
`erpOptionSchema` ประกอบด้วย 9 tab ตามลำดับ `tab1System ... tab9Mobillyst` (`erpOption/index.ts:47-62`) คำอธิบายใต้หัวแต่ละส่วนมาจาก `TAB_DESCRIPTIONS` (`OptionsForm.tsx:34-44`)

| id | หัวข้อ | ตัวอย่างช่อง (ชื่อคอลัมน์ : ความหมาย) |
|---|---|---|
| system | ระบบ | `year_type` ประเภทปี (radio), `multi_currency` ใช้หลายสกุลเงิน + `home_currency` สกุลเงินหลัก (lookup currency), `use_expire` ระบบวันหมดอายุ, `running_doc_no_only`, `pay_bill_over`, `printer_top_margin` |
| gl | บัญชี/ภาษี | `vat_type` ภาษีขาย, `vat_type_1` ภาษีซื้อ, `vat_rate`, `wht_rate`, `round_type` การปัดเศษ, `gl_no_decimal`, `gl_process_realtime`, `use_doc_group`, `use_department`, `use_project`, `voucher_form_code` |
| item | สินค้า | `item_qty_decimal` / `item_price_decimal` / `item_amount_decimal` ทศนิยม, `stock_balance_control` เตือนติดลบ, `issue_stock_control`, `transfer_stock_control`, `balance_control_type`, `cost_warehouse`, `use_barcode`, `check_expiration_date`, `display_lot_column`, `warning_reorder_point` |
| sale | ขาย | `warning_price_1/2`, `warning_low_cost`, `ic_stock_control` ห้ามขายติดลบ, `auto_run_docno_sale`, `ic_price_formula_control`, `use_sale_shift` (ไฟล์ schema มี 76 รายการ) |
| sync | ซิงค์ข้อมูล | `sync_webservice_url`, `active_sync_*`, `mis_center_pw` และ `active_sync_access_code` (password), `sync_start_date` |
| mis | MIS | `mis_shop_code`, `mis_shop_password`, `mis_shop_confirm` (3 ช่อง) |
| wallet | e-Wallet / QR | หัวข้อ Lugent, BCEL, Thai QR (ช่อง `thaiqr.*` เช่น `thaiqr.company_biller_id`), `wallet_lugent_access_code` (password) |
| etax | e-Tax | `etax.authorization_code`, `etax.api_key` (password), `etax.pdf_attach`, `etax.uat_mode`, `etax.uat_email_to` |
| mobillyst | ขนส่ง Mobillyst TMS | `mobillyst.enable_service`, `mobillyst.is_poc`, `mobillyst.api_key` (password), `mobillyst.latitude/longitude`, `mobillyst.take_photo_*`, `mobillyst.cod_type_list` |

จำนวนรายการที่ระบุ (เช่น sale 76) มาจากการนับ field ในไฟล์ schema รวมช่องเว้นว่างเชิงเค้าโครง (`blank`) และหัวข้อย่อย (`heading`) จึงมากกว่าจำนวนสวิตช์จริง

### หมวดที่ซ่อนตามรุ่น (edition)
`visibleOptionTabs` (`:72-83`) ตัดหมวดตาม `useEdition().capabilities`
- หมวด `gl` แสดงเมื่อ `hasGl` เป็นจริง (Starter ปิด, Account และ Pro เปิด: `editionConfig.ts:58,76,94`)
- หมวด `sync`, `mis`, `mobillyst` แสดงเฉพาะเมื่อ `hasAdvancedProFeatures` (เฉพาะรุ่น BC Ai Account Pro: `editionConfig.ts:61,79,97`)
- หมวด `system`, `item`, `sale`, `wallet`, `etax` แสดงเสมอ
- นอกจากนี้ `SchemaForm` ซ่อนบางช่องตามรุ่นต่อ ([[scr-company-profile]])

## ชนิดช่องและการตรวจข้อมูล
- ชนิดที่ใช้: `checkbox` (ส่วนใหญ่), `radio`, `number`, `text`, `password`, `date`, `lookup`, `heading`, `blank` (วาดโดย `FieldControl`)
- ช่อง `lookup` (เช่น `home_currency`, `report_font`) เปิด popup ค้นหา `BcLookupModal` ผ่าน `handleLookup` (`:127`) เมื่อเลือกจะ `form.setField(targetField, item.code)` และเก็บชื่อแสดงแยก (`:670-680`)
- การตรวจมีแค่ความยาวสูงสุด (`max=` ใน schema) และสถานะถูกแก้หรือยัง ไม่มีกฎ required ข้ามช่องในจอนี้
- ก่อนบันทึก ค่าสตริงที่มีเครื่องหมาย `~` จะถูกตัดเหลือส่วนหน้า `~` (`:226-232`) ใช้กับค่าที่แสดงเป็น "รหัส~ชื่อ" ของช่อง lookup

## การโหลดและการบันทึก (4 ตาราง)
ข้อมูลกระจายอยู่ 4 ตาราง ช่องนอก `erp_option` ตั้งชื่อนำหน้าด้วยตารางเพื่อกันชื่อชน (`erpOption/index.ts:11-28`)

| คำนำหน้า | ตาราง |
|---|---|
| (ไม่มี) | [[tbl-erp-option]] |
| `thaiqr.` | `erp_thai_qr_config` (เฉพาะ `config_type = 0`) |
| `etax.` | `erp_option_etax_inet` |
| `mobillyst.` | `erp_option_mobillyst` |

- **โหลด** (`:149-196`): `queryBatch` อ่านทั้ง 4 ตารางครั้งเดียว (`SELECT * ... LIMIT 1`) แล้ว `mergeOptionTables` (`erpOption/index.ts:35`) รวมเป็น record แบน (ใส่คำนำหน้าให้คอลัมน์ตารางลูก) -> `fromDbRecord` -> `load`
- **บันทึก** (`save`, `:206-330`): ตรวจ `rights.canEdit` ก่อน ถ้าไม่มีสิทธิ์ขึ้น alert "ไม่มีสิทธิ์บันทึกข้อมูล" (`:209-218`) จากนั้นสร้าง INSERT 4 ชุดด้วย `buildInsertFieldsSql` (ตาราง `thaiqr` เติม `config_type = 0`, ตาราง `mobillyst` ใช้ `fallbackZeroForNumber` กันคอลัมน์ตัวเลข not-null) แล้ว `queryExecBatch` รัน `DELETE` + `INSERT` ของทั้ง 4 ตารางใน batch เดียว (`:286-295`) ดูกลไกใน [[fe-query-client-sql-builder]]
- หลังบันทึกสำเร็จ: ปรับปีบัญชี `setBcYearType` (`year_type == 1` -> 1 ไม่งั้น 0) และรีเฟรชทศนิยมระบบ `refreshBcDecimalSettings()` (`:297-298`, import จาก `@/lib/numeric` ดู [[fe-numeric-money]]) แล้วขึ้นป๊อปอัป "สำเร็จ" และ **ปิดหน้าจอให้** (`:306-316`)
- ปิดจอขณะมีช่องที่แก้ ขึ้นยืนยัน "มีการแก้ไขปรับปรุง ต้องการออกจากหน้าจอนี้หรือไม่" (`handleClose`, `:332-354`)

## Popups ที่จอนี้เรียก
- `BcDialog` ชนิด alert / confirm / success / error (`:658-669`)
- `BcLookupModal` สำหรับช่อง lookup ([[scr-data-list-and-lookup]])

## ข้อควรระวัง
- บันทึกแบบ **ลบทั้งตารางแล้ว insert แถวเดียวใหม่** ของ `erp_option`, `erp_option_etax_inet`, `erp_option_mobillyst` (และแถว `config_type = 0` ของ `erp_thai_qr_config`) คอลัมน์ที่ไม่อยู่ใน schema จะไม่ถูกเขียนกลับ ค่าจะหายหลังบันทึก
- หมวดที่ถูกซ่อนตามรุ่นยังอยู่ใน `erpOptionSchema` จึงถูกรวมใน `collectFields(erpOptionSchema)` (`:224`) ค่าของหมวดที่ซ่อนจึงถูกเขียนกลับตามค่าที่โหลดมา
- บันทึกสำเร็จแล้วจอปิดเอง ถ้าจะตั้งหลายหมวดต่อกันต้องแก้ทั้งหมดก่อนกดบันทึกครั้งเดียว
- คอมเมนต์ในโค้ดเรียกจอนี้ว่า "จอ 1.1.2" (`erpOption/index.ts:2`) เป็นรหัสแบบจุดแบบเก่า รหัสเมนูที่ใช้จริงตอนนี้คือ `1002` ([[fe-screen-registry-menu]])

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:267-270` — ผูก `menu_option` กับ `OptionsForm`
- `frontend/src/config/bcMenu.ts:277-280` — `ADMIN_ONLY_MENU_SET`
- `frontend/account/config/OptionsForm.tsx:34-44` — `TAB_DESCRIPTIONS`; `:60-83` สิทธิ์/รุ่น/แท็บที่มองเห็น; `:127-145` lookup + ค่าแนะนำ; `:149-196` โหลด 4 ตาราง; `:206-330` บันทึก; `:332-354` ปิดจอ; `:364-668` โครงหน้าจอ
- `frontend/src/config/schemas/erpOption/index.ts:11-62` — คำนำหน้าตาราง, `mergeOptionTables`, `erpOptionSchema`
- `frontend/src/config/schemas/erpOption/tab1System.ts` ... `tab9Mobillyst.ts` — ช่องแต่ละหมวด
- `frontend/src/config/editionConfig.ts:47-100` (รุ่น), `:301` (ประเภทธุรกิจ)
- ดูเพิ่ม: [[scr-company-profile]] · [[fe-query-client-sql-builder]] · [[fe-numeric-money]] · [[screens-overview]]
