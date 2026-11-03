---
title: "เครื่องฟอร์มแบบ schema (SchemaForm, FieldDef, useRecordForm) และจอตั้งค่าระบบ"
tags: [frontend, form, schema, config, company-profile, erp-option]
aliases: ["SchemaForm", "FieldDef", "ScreenSchema", "useRecordForm", "FieldControl", "CompanyProfileForm", "OptionsForm", "ข้อมูลบริษัท", "ข้อเลือกพิเศษ", "กำหนดข้อเลือกพิเศษต่างๆ", "erp_option", "erp_company_profile", "fromDbRecord", "toDbRecord", "ฟิลด์สีส้ม"]
sources: ["frontend/src/lib/schema.ts:42", "frontend/src/lib/schema.ts:105", "frontend/src/hooks/useRecordForm.ts:16", "frontend/account/form/SchemaForm.tsx:40", "frontend/account/form/FieldControl.tsx:24", "frontend/account/config/CompanyProfileForm.tsx:28", "frontend/account/config/OptionsForm.tsx:57", "frontend/src/config/schemas/erpOption/index.ts:46", "frontend/src/lib/bc-query-builder.ts:263"]
---

# เครื่องฟอร์มแบบ schema และจอตั้งค่าระบบ

จอกรอกข้อมูลแบบฟอร์ม (ข้อมูลบริษัท, ข้อเลือกพิเศษ, ลูกค้า, เจ้าหนี้, สินค้า, หน่วยนับ, คลัง, พนักงาน) ประกาศฟิลด์เป็น `ScreenSchema` ไว้ใน `src/config/schemas/*` แล้วให้ `<SchemaForm />` วาด (หัวไฟล์ `schema.ts:1-9`)
`name` ของฟิลด์ต้องเป็นชื่อคอลัมน์จริงใน PostgreSQL เพื่อให้สร้าง SQL ได้ตรงๆ

## ทำงานอย่างไร

**นิยาม schema** (`src/lib/schema.ts`)
- `FieldType` (`schema.ts:15-35`): `code, text, textarea, number, password, checkbox, radio, select, lookup, date, image, label, blank, heading`; `blank` (33) ใช้เว้นช่องใน grid ให้ผังตรงตามที่ schema กำหนด, `heading` (35) คือหัวกลุ่ม.
- `FieldDef` (42-73): `name` (ชื่อคอลัมน์จริง), `label` (ไทย), `type`, `span, rows, maxLength, required, placeholder, choices` (`ChoiceItem` 37-40 = `value, label`), `inline, lookup, help, hidden(values), disabled(values), min/max/step, resourceOnly` (`resourceOnly` = ไม่มีคอลัมน์ใน DB).
- `LookupKind` (75-103) บอกประเภทหน้าต่างค้นหา (branch, department, warehouse, shelf, currency, position, user_group, gl_account, account, province/amper/tambon, ar/ap type/group, ar_area, ic_unit/category/group/brand/pattern/size/color/grade, `font`; ปิดท้ายด้วย `(string & {})` รับค่าอื่น) - ผ่านแผนที่ใน [[fe-grid-component]].
- `SectionDef` (105-112: `id, title, description, columns` 1-4 ค่าเริ่ม 2, `fields`), `TabDef` (114-118: `id,label,sections`), `ScreenSchema` (120-127: `table,title` + `tabs` หรือ `sections`).
- ตัวช่วย: `collectFields` (130-135), `emptyValue` (138-150; checkbox=false, number=0, select/radio=choice แรก, อื่นๆ=""), `blankRecord` (153-166; ข้าม `label/blank/heading`), `toDbRecord` (172-191; checkbox -> 0/1, ข้าม `label/image/blank/heading`), `fromDbRecord` (194-226; 0/1 -> checkbox, `code` -> ตัวพิมพ์ใหญ่, select/radio คงชนิดของ choice), `findEmptyRequired` (229-241; ข้ามฟิลด์ที่ `hidden`).

**สถานะฟอร์ม** `useRecordForm(schema, initial?)` (`useRecordForm.ts:16-64`)
- เก็บ `baseline` (ค่าที่โหลดล่าสุด, 17-20) กับ `values` (ค่าปัจจุบัน, 21); คืน `values, setField, setMany, load, dirtyFields, isDirty, emptyRequired, canSave` (54-63; `canSave` = ไม่มีช่องบังคับที่ว่าง).
- `dirtyFields` (41-47) = ชื่อฟิลด์ที่ `values[k] !== baseline[k]`; `load(next)` (32-39) ตั้งทั้ง baseline และ values เป็นค่าใหม่ทับ `blankRecord` (ใช้หลังโหลด/บันทึก).

**ตัววาด** (`account/form/`)
- `SchemaForm({sections, form, onLookup, lookupNames, onLookupNameChange, readOnlyFields, readOnly, className})` (`SchemaForm.tsx:281-307`) วน `SchemaSection` (220-268) = การ์ดมีหัวข้อ + grid ตามจำนวน `columns` (`COLUMN_CLASS` 60-65); `SchemaSection` กรองช่องที่ถูกซ่อนตามรุ่น (231) และไม่วาดการ์ดถ้าไม่เหลือช่อง (232). แต่ละช่อง `FieldRow` (78-208) คืน null ถ้า `field.hidden?.(values)` (88); ป้ายชื่ออยู่ซ้ายของช่อง ช่อง `required` ขึ้นดอกจัน (186) และ `help` แสดงใต้ช่อง (200-204).
- ช่องที่แก้แล้วยังไม่บันทึก (`dirty`) ถูกไฮไลต์สี `accent` (เหลืองอำพัน/ส้ม, `globals.css:44-47`): class `fld-dirty` (`FieldControl.tsx:36`; นิยาม `globals.css:1434`), ป้ายชื่อช่องตัวหนาสี `accent-700` (`SchemaForm.tsx:182`), และกรอบ `fieldset` ของ radio (`SchemaForm.tsx:112`). `radio` วาดเป็น `fieldset` เต็มแถว (`gridColumn: 1 / -1`, 114) มี `legend` เป็นป้ายชื่อ (107-149).
- `FieldControl` (`FieldControl.tsx:24-305`, switch ที่ 38) วาดตาม `type`: `code` บังคับตัวพิมพ์ใหญ่ + monospace (39-52), `textarea` (54), `checkbox` (68), `radio` (85), `select` (115): ถ้ามีตัวเลือก 1-9 รายการวาดเป็นกลุ่มปุ่มวิทยุเรียงแถว (117-159) ถ้า 10 รายการขึ้นไปหรือไม่มีตัวเลือกเป็น `<select>` (160-178); `lookup` (181) ผ่าน `BcLookupInput` (210) ส่วน `font` เลือกจากรายการ `STANDARD_REPORT_FONTS` (182-200); `number` (228) ผ่าน `NumberBox` ([[fe-numeric-money]]; ส่งค่าออกเป็นสตริง หรือ `null` เมื่อว่าง, 242-244); `password` (249); `date` ผ่าน `DateBox` (262); `image` เป็นกล่องเปล่าข้อความ "ยังไม่ได้เลือกรูป" ไม่มีปุ่มอัปโหลด (273-282); `label` แสดงข้อความล้วน (284); ชนิดอื่นรวม `text` เป็น `textarea` บรรทัดเดียวที่ตัดคำเอง กด Enter ไม่ได้และแปลงการขึ้นบรรทัดใหม่เป็นเว้นวรรค (287-303).
- **ซ่อนฟิลด์ตามรุ่นผลิตภัณฑ์**: `isSchemaFieldHiddenByEdition` (`SchemaForm.tsx:40-58`) ซ่อนฟิลด์ GL (`STARTER_HIDDEN_GL_FIELDS` 10 และฟิลด์ขึ้นต้น `account_code_`/`gl_account`) เมื่อรุ่นไม่มี GL (`hasGl`), สาขา/แผนก (`STARTER_HIDDEN_BRANCH_DEPT_FIELDS` 21) เมื่อรุ่นไม่มีสาขา/แผนก (`hasDepartmentAndBranch`), และฟิลด์เฉพาะรุ่น Pro (`PRO_ONLY_SCHEMA_FIELDS` 30-38 เช่น `multi_currency`, `home_currency`, `use_compare_unit`) เมื่อไม่มีความสามารถขั้นสูง (`hasAdvancedProFeatures`) - อ่านจาก `useEdition()` (229) ดู [[fe-screen-registry-menu]].

**จอ "ข้อมูลบริษัท"** `CompanyProfileForm` (`account/config/CompanyProfileForm.tsx:28-244`, menu `menu_company_profile` รหัส `1001` ตามที่ `getMenuCodeByName` บรรทัด 179 อ่านจากผังเมนู)
- โหลด `SELECT * FROM erp_company_profile LIMIT 1` -> `load(fromDbRecord(companyProfileSchema, row))` (47-67; ไม่มีแถวใช้ `load({})`). schema ที่ `src/config/schemas/companyProfile.ts` มี 2 section (`identity` :15, `address` :112); ใต้ฟอร์มมีกล่องเลือกพิกัด `BcLocationFieldBox` (`shared/ui/BcMapPickerModal.tsx:1164`; ใช้ที่ `CompanyProfileForm.tsx:213-226`, category `COMPANY`) เขียนค่า `latitude`/`longitude` กลับเข้า `form`.
- บันทึก (`save`, 69-145): ต้องมี `rights.canEdit` (70-79; ไม่งั้นเปิดกล่อง "ไม่มีสิทธิ์บันทึกข้อมูล") -> ตรวจ `company_name_1` ไม่ว่าง (81-91; "ข้อมูลไม่สมบูรณ์ : ชื่อบริษัท") -> ตรวจ `emptyRequired` (93-102) -> `queryExecBatch(["DELETE FROM erp_company_profile", buildInsertSql(...)])` ใน transaction เดียว (108-116; ลบแล้วใส่ใหม่ ตาราง 1 แถว) -> `load(...)` ตั้งค่าที่บันทึกเป็น baseline ใหม่ (131) -> กล่อง success "บันทึกข้อมูลเสร็จเรียบร้อย โปรแกรมจะปิดหน้าจอนี้ให้" เมื่อกดตกลงเรียก `onClose` (135-144).
- ปุ่มปิด `handleClose` (147-173): ถ้า `isDirty` เปิดกล่องยืนยัน "มีการแก้ไขปรับปรุง ต้องการออกจากหน้าจอนี้หรือไม่" (ตกลง/ยกเลิก) ถ้าตกลงเรียก `tabsCtx.discardAndCloseScreen(screenKey)` เมื่อมี ไม่เช่นนั้น `onClose`; ถ้าไม่มีการแก้ไขเรียก `onClose` ทันที.

**จอ "กำหนดข้อเลือกพิเศษต่างๆ"** `OptionsForm` (`account/config/OptionsForm.tsx:57-688`, menu `menu_option` รหัส `1002`, `getMenuCodeByName` บรรทัด 369; 688 บรรทัด)
- schema `erpOptionSchema` (`erpOption/index.ts:46-60`) มี 9 แท็บ ตามลำดับ: `system, gl, item, sale, sync, mis, wallet, etax, mobillyst` (ไฟล์ `tab1System.ts` ... `tab9Mobillyst.ts`). ฟิลด์กระจาย 4 ตาราง แยกด้วยคำนำหน้าชื่อ: (ไม่มี) = `erp_option` (`OPTION_MAIN_TABLE` :30), `thaiqr.` = `erp_thai_qr_config`, `etax.` = `erp_option_etax_inet`, `mobillyst.` = `erp_option_mobillyst` (`TABLE_PREFIX`, `index.ts:24-28`); โหลดด้วย `queryBatch` 4 คำสั่ง `SELECT * ... LIMIT 1` (`OptionsForm.tsx:149-154`; ตาราง QR กรอง `config_type = 0`) แล้ว `mergeOptionTables` (`index.ts:35-44`, ใช้ที่ `OptionsForm.tsx:175-180`) รวมกลับเป็น record แบน -> `load(fromDbRecord(...))` (182).
- หน้าจอเป็นหน้าเลื่อนเดียว ไม่ใช่แท็บสลับ: แถบ "ข้ามไปยังส่วน:" (395-) กดแล้ว `jumpToSection` (356-362) เลื่อนไปยังการ์ด `opt-sec-<id>`. ส่วนที่ 0 (`opt-sec-business_types`, 456-603; `activeTab` เริ่มที่ `business_types`, 92) คือชนิดธุรกิจ ตั้งผ่าน `useEdition` (`businessTypes`, `toggleBusinessType`) พร้อมปุ่ม `applyRecommendedOptions` (140-145, ปุ่มที่ 480) ใส่ค่าแนะนำตามชนิดธุรกิจ (`getRecommendedOptionsForBusinessTypes`, `editionConfig`); ชนิดธุรกิจเก็บทั้งในเครื่องและคอลัมน์ `erp_option.business_types` (166-173). ส่วนถัดไปแต่ละส่วนวาดจากแท็บของ schema ที่มองเห็นด้วย `SchemaForm` (605-652) พร้อมคำอธิบายจาก `TAB_DESCRIPTIONS` (34).
- แท็บที่ซ่อนตามรุ่น: `gl` เมื่อไม่มี GL; `sync`, `mis`, `mobillyst` เมื่อไม่มีความสามารถ Pro (`visibleOptionTabs`, 72-84). แต่ละส่วนมีป้าย "แก้ไขแล้ว N ช่อง" จากตัวนับ `dirtyByTab` (198-206; ป้าย 630-634) และหัวจอนับรวมกับชนิดธุรกิจที่เปลี่ยน (`totalDirtyCount`, 88-89).
- บันทึก (`save`, 208-328): ต้อง `rights.canEdit` (209-219) -> ตัดค่าข้อความที่มี `~` ให้เหลือส่วนหน้าก่อน `~` (`sanitizedValues`, 226-232; เหตุผลของรูปแบบนี้ยังไม่ยืนยัน) -> แยกฟิลด์ตามคำนำหน้า 4 กลุ่ม (235-283) -> `buildInsertFieldsSql` ต่อกลุ่ม (ตัดคำนำหน้าออกด้วย `columnNameTransform`; กลุ่ม QR ใส่ `config_type = 0`, กลุ่ม mobillyst ตั้ง `fallbackZeroForNumber`) -> `queryExecBatch` ชุดเดียว: `DELETE FROM erp_option`, `DELETE FROM erp_thai_qr_config WHERE config_type = 0`, `DELETE FROM erp_option_etax_inet`, `DELETE FROM erp_option_mobillyst` แล้ว insert ใหม่ (286-296).
- หลังบันทึกสำเร็จ: `setBcYearType(year_type===1?1:0)` + `refreshBcDecimalSettings()` (297-298) ให้ทศนิยมและประเภทปีทั้งระบบเปลี่ยนทันที ([[fe-numeric-money]]), `load(...)` ตั้งค่าที่บันทึกเป็น baseline (302), แสดงกล่อง "บันทึกข้อมูลเสร็จเรียบร้อย โปรแกรมจะปิดหน้าจอนี้ให้" แล้วเมื่อกดตกลงเรียก `onClose` (305-315).
- ปุ่มปิด `handleClose` (330-353): ถ้า `anyDirty` เปิดกล่องยืนยัน "มีการแก้ไขปรับปรุง ต้องการออกจากหน้าจอนี้หรือไม่" ถ้าตกลงเรียก `tabsCtx.discardAndCloseScreen(screenKey)` เมื่อมี ไม่เช่นนั้น `onClose`; ถ้าไม่มีการแก้ไขเรียก `onClose` ทันที.
- ช่อง lookup ใช้ `BcLookupModal` ผ่าน `handleLookup` (127-138; เลือกแล้วเติม `code` ลงฟิลด์ และเก็บ `name_1`/`name` ไว้แสดง, 672-685); ฟิลด์ `font` ไม่เปิดหน้าต่างค้นหา (128).

**ผู้ใช้อื่นของเครื่องฟอร์ม**: จอหลักข้อมูลที่ใช้ `SchemaForm`/`useRecordForm` ด้วย ได้แก่ `CustomerScreen`/`CustomerDetailScreen`, `SupplierScreen`/`SupplierDetailScreen`, `ItemScreen`, `UnitScreen`, `WarehouseScreen`, `EmployeeScreen` (schema ใน `arCustomer.ts, arCustomerDetail.ts, apSupplier.ts, apSupplierDetail.ts, icInventory.ts, icUnit.ts, icWarehouse.ts, erpUser.ts`) - ดู [[fe-master-screens]].

**ข้อควรระวัง**
- ชื่อฟิลด์ใน schema = ชื่อคอลัมน์จริง; ถ้าเพิ่มฟิลด์ที่ไม่มีคอลัมน์ต้องใส่ `resourceOnly: true` มิฉะนั้น `buildInsertSql` จะใส่คอลัมน์นั้นใน SQL (`bc-query-builder.ts:268-286`; ข้ามเฉพาะ `resourceOnly` และชนิด `label/image/blank/heading`).
- จอตั้งค่าใช้ DELETE แล้ว INSERT ทั้งแถว (ตาราง 1 แถว) ใน transaction เดียว - ฟิลด์ที่ไม่อยู่ใน schema จะหายไปจากแถวหลังบันทึก.
- ค่า `number` จาก DB ที่เป็นข้อความถูกเก็บเป็น string เพื่อไม่ให้เสียความละเอียด (`fromDbRecord`, 208-214) ดู [[fe-numeric-money]].

## ที่มาในโค้ด
- `frontend/src/lib/schema.ts:15-35,37-73,75-127,130-241` - ชนิดฟิลด์, FieldDef, SectionDef, แปลง DB
- `frontend/src/hooks/useRecordForm.ts:16-64` - สถานะฟอร์ม, dirty
- `frontend/account/form/SchemaForm.tsx:10-65,78-208,220-268,281-307` - ซ่อนตามรุ่น, FieldRow, Section
- `frontend/account/form/FieldControl.tsx:24-305` - ตัววาดตามชนิด
- `frontend/src/app/globals.css:1434` - class `fld-dirty`
- `frontend/account/config/CompanyProfileForm.tsx:28-244` - โหลด/บันทึก/ปิดข้อมูลบริษัท, กล่องพิกัด (213-226)
- `frontend/shared/ui/BcMapPickerModal.tsx:1147-1175` - `BcLocationFieldBox`
- `frontend/account/config/OptionsForm.tsx:57-182,198-353,356-362,456-654` - ชนิดธุรกิจ, ส่วน/ปุ่มข้าม, บันทึก 4 ตาราง, ปิดจอ
- `frontend/src/config/schemas/erpOption/index.ts:24-60` - 9 แท็บ, คำนำหน้าตาราง
- `frontend/src/lib/bc-query-builder.ts:263-287` - `buildInsertSql`

## ดูเพิ่ม
[[frontend-overview]] · [[fe-master-screens]] · [[fe-standard-master-screen]] · [[fe-grid-component]] · [[fe-query-client-sql-builder]] · [[fe-numeric-money]] · [[fe-tabs-workspace]]
