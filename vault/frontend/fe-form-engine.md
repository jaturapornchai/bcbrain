---
title: "เครื่องฟอร์มแบบ schema (SchemaForm, FieldDef, useRecordForm) และจอตั้งค่าระบบ"
tags: [frontend, form, schema, config, company-profile, erp-option]
aliases: ["SchemaForm", "FieldDef", "ScreenSchema", "useRecordForm", "FieldControl", "CompanyProfileForm", "OptionsForm", "ข้อมูลบริษัท", "ข้อเลือกพิเศษ", "กำหนดข้อเลือกพิเศษต่างๆ", "erp_option", "erp_company_profile", "fromDbRecord", "toDbRecord", "ฟิลด์สีส้ม"]
sources: ["frontend/src/lib/schema.ts:42", "frontend/src/lib/schema.ts:105", "frontend/src/hooks/useRecordForm.ts:16", "frontend/account/form/SchemaForm.tsx:40", "frontend/account/form/FieldControl.tsx:24", "frontend/account/config/CompanyProfileForm.tsx:28", "frontend/account/config/OptionsForm.tsx:57", "frontend/src/config/schemas/erpOption/index.ts:46"]
---

# เครื่องฟอร์มแบบ schema และจอตั้งค่าระบบ

จอกรอกข้อมูลแบบฟอร์ม (ข้อมูลบริษัท, ข้อเลือกพิเศษ, ลูกค้า, เจ้าหนี้, สินค้า, หน่วยนับ, คลัง, พนักงาน) ประกาศฟิลด์เป็น `ScreenSchema` ไว้ใน `src/config/schemas/*` แล้วให้ `<SchemaForm />` วาด (หัวไฟล์ `schema.ts:1-9`)
`name` ของฟิลด์ต้องเป็นชื่อคอลัมน์จริงใน PostgreSQL เพื่อให้สร้าง SQL ได้ตรงๆ

## ทำงานอย่างไร

**นิยาม schema** (`src/lib/schema.ts`)
- `FieldType` (14-34): `code, text, textarea, number, password, checkbox, radio, select, lookup, date, image, label, blank, heading`; `blank` ใช้เว้นช่องใน grid ให้ผังตรงจอ BC เดิม, `heading` คือหัวกลุ่ม.
- `FieldDef` (42): `name, label (ไทย), type, span, rows, maxLength, required, placeholder, choices, inline, lookup, help, hidden(values), disabled(values), min/max/step, resourceOnly` (`resourceOnly` = ไม่มีคอลัมน์ใน DB).
- `LookupKind` (~68-97) บอกประเภทหน้าต่างค้นหา (branch, department, warehouse, shelf, currency, user_group, gl_account, province/amper/tambon, ar/ap type/group, ic_unit/category/group/brand/..., `font`) - ผ่านแผนที่ใน [[fe-grid-component]].
- `SectionDef` (105; `columns` 1-4, ค่าเริ่ม 2), `TabDef` (`id,label,sections`), `ScreenSchema` (`table,title` + `tabs` หรือ `sections`).
- ตัวช่วย: `collectFields` (130), `emptyValue` (138; checkbox=false, number=0, select/radio=ตัวเลือกแรก, อื่นๆ=""), `blankRecord` (153), `toDbRecord` (172; checkbox -> 0/1), `fromDbRecord` (194; 0/1 -> checkbox, `code` -> ตัวพิมพ์ใหญ่, select/radio คงชนิดของ choice), `findEmptyRequired` (229; ข้ามฟิลด์ที่ `hidden`).

**สถานะฟอร์ม** `useRecordForm(schema, initial?)` (`useRecordForm.ts:16`)
- เก็บ `baseline` (ค่าที่โหลดล่าสุด) กับ `values` (ค่าปัจจุบัน); คืน `values, setField, setMany, load, dirtyFields, isDirty, emptyRequired, canSave`.
- `dirtyFields` = ชื่อฟิลด์ที่ `values[k] !== baseline[k]`; `load(next)` ตั้งทั้ง baseline และ values เป็นค่าใหม่ (ใช้หลังโหลด/บันทึก).

**ตัววาด** (`account/form/`)
- `SchemaForm({sections, form, onLookup, lookupNames, onLookupNameChange, readOnlyFields, readOnly})` (`SchemaForm.tsx:281`) วน `SchemaSection` (220) = การ์ดมีหัวข้อ + grid; แต่ละช่อง `FieldRow` (78) ข้ามถ้า `field.hidden?.(values)`.
- ช่องที่แก้แล้วยังไม่บันทึก (`dirty`) ถูกไฮไลต์สีส้ม (class `fld-dirty` ใน `FieldControl.tsx:36`; กรอบ `accent` ของ radio ใน `SchemaForm.tsx`). `radio` วาดเป็น `fieldset` เต็มแถวเหมือน GroupBox ของ WinForms.
- `FieldControl` (`FieldControl.tsx:24`) วาดตาม `type`: `code` บังคับตัวพิมพ์ใหญ่ + monospace, `textarea`, `number` ผ่าน `NumberBox` ([[fe-numeric-money]]), `date` ผ่าน `DateBox`, `lookup` ผ่าน `BcLookupInput`, `image` (เป็นกล่องเปล่าข้อความ "ยังไม่ได้เลือกรูป" ไม่มีปุ่มอัปโหลด, 273-283), `lookup` ที่เป็น `font` เลือกจากรายการ `STANDARD_REPORT_FONTS`.
- **ซ่อนฟิลด์ตามรุ่นผลิตภัณฑ์**: `isSchemaFieldHiddenByEdition` (`SchemaForm.tsx:40`) ซ่อนฟิลด์ GL (`STARTER_HIDDEN_GL_FIELDS`), สาขา/แผนก (`STARTER_HIDDEN_BRANCH_DEPT_FIELDS`) เมื่อรุ่นไม่มี GL / สาขา, และฟิลด์เฉพาะรุ่น Pro (`PRO_ONLY_SCHEMA_FIELDS` เช่น `multi_currency`, `home_currency`, `use_compare_unit`) เมื่อไม่มีความสามารถขั้นสูง - อ่านจาก `useEdition()` ดู [[fe-screen-registry-menu]].

**จอ "ข้อมูลบริษัท"** `CompanyProfileForm` (`account/config/CompanyProfileForm.tsx:28`, menu `menu_company_profile`)
- โหลด `SELECT * FROM erp_company_profile LIMIT 1` -> `load(fromDbRecord(companyProfileSchema, row))` (49-55). schema ที่ `src/config/schemas/companyProfile.ts` มี 2 section (`identity`, `address`).
- บันทึก (`save`, ~68): ต้องมี `rights.canEdit` (ไม่งั้นเปิดกล่อง "ไม่มีสิทธิ์บันทึกข้อมูล") -> ตรวจ `company_name_1` ไม่ว่าง -> ตรวจ `emptyRequired` -> `queryExecBatch(["DELETE FROM erp_company_profile", buildInsertSql(...)])` ใน transaction เดียว (107-116) ตามที่ BC เดิมทำ (ลบแล้วใส่ใหม่ ตาราง 1 แถว).

**จอ "กำหนดข้อเลือกพิเศษต่างๆ"** `OptionsForm` (`account/config/OptionsForm.tsx:57`, menu `menu_option`; 688 บรรทัด)
- schema `erpOptionSchema` (`erpOption/index.ts:46`) มี 9 แท็บ ตามลำดับ: `system, gl, item, sale, sync, mis, wallet, etax, mobillyst` (ไฟล์ `tab1System.ts` ... `tab9Mobillyst.ts`). ฟิลด์กระจาย 4 ตาราง แยกด้วยคำนำหน้าชื่อ: (ไม่มี) = `erp_option`, `thaiqr.` = `erp_thai_qr_config`, `etax.` = `erp_option_etax_inet`, `mobillyst.` = `erp_option_mobillyst` (`TABLE_PREFIX`, `index.ts:22-26`); `mergeOptionTables` (33) รวม 4 ตารางกลับเป็น record แบนตอนโหลด.
- เปิดจอแล้วอยู่แท็บ `business_types` (ชนิดธุรกิจ, `OptionsForm.tsx:92`) ซึ่งตั้งผ่าน `useEdition` (`businessTypes`, `toggleBusinessType`) และปุ่ม `applyRecommendedOptions` ใส่ค่าแนะนำตามชนิดธุรกิจ (`getRecommendedOptionsForBusinessTypes`, `editionConfig`). ชนิดธุรกิจเก็บทั้งในเครื่องและคอลัมน์ `erp_option.business_types` (166-168).
- แท็บที่ซ่อนตามรุ่น: `gl` เมื่อไม่มี GL; `sync`, `mis`, `mobillyst` เมื่อไม่มีความสามารถ Pro (`visibleOptionTabs`, 72-86). มีตัวนับจำนวนช่องที่แก้ต่อแท็บ (`dirtyByTab`, 196-205).
- บันทึก (`save`, 207-): ต้อง `rights.canEdit` -> ตัดค่าข้อความที่มี `~` ให้เหลือส่วนหน้าก่อน `~` (`sanitizedValues`, 218-224; เหตุผลของรูปแบบนี้ยังไม่ยืนยัน) -> แยกฟิลด์ตามคำนำหน้า 4 กลุ่ม -> `buildInsertFieldsSql` ต่อกลุ่ม (ตัดคำนำหน้าออกด้วย `columnNameTransform`) -> `queryExecBatch` ชุดเดียว: `DELETE FROM erp_option`, `DELETE FROM erp_thai_qr_config WHERE config_type = 0`, `DELETE FROM erp_option_etax_inet`, `DELETE FROM erp_option_mobillyst` แล้ว insert ใหม่ (286-295).
- หลังบันทึกสำเร็จ: `setBcYearType(year_type===1?1:0)` + `refreshBcDecimalSettings()` (297-298) ให้ทศนิยม/ปี พ.ศ. ทั้งระบบเปลี่ยนทันที ([[fe-numeric-money]]), แสดงกล่อง "บันทึกข้อมูลเสร็จเรียบร้อย" แล้วเรียก `onClose`.
- ช่อง lookup ใช้ `BcLookupModal` ผ่าน `handleLookup` (127-138); ฟิลด์ `font` ไม่เปิดหน้าต่างค้นหา.

**ผู้ใช้อื่นของเครื่องฟอร์ม**: จอหลักข้อมูลที่ใช้ `SchemaForm`/`useRecordForm` ด้วย ได้แก่ `CustomerScreen`/`CustomerDetailScreen`, `SupplierScreen`/`SupplierDetailScreen`, `ItemScreen`, `UnitScreen`, `WarehouseScreen`, `EmployeeScreen` (schema ใน `arCustomer.ts, arCustomerDetail.ts, apSupplier.ts, apSupplierDetail.ts, icInventory.ts, icUnit.ts, icWarehouse.ts, erpUser.ts`) - ดู [[fe-master-screens]].

**ข้อควรระวัง**
- ชื่อฟิลด์ใน schema = ชื่อคอลัมน์จริง; ถ้าเพิ่มฟิลด์ที่ไม่มีคอลัมน์ต้องใส่ `resourceOnly: true` มิฉะนั้น `buildInsertSql` จะใส่คอลัมน์นั้นใน SQL (`bc-query-builder.ts:268-285`).
- จอตั้งค่าใช้ DELETE แล้ว INSERT ทั้งแถว (ตาราง 1 แถว) ใน transaction เดียว - ฟิลด์ที่ไม่อยู่ใน schema จะหายไปจากแถวหลังบันทึก.
- ค่า `number` จาก DB ที่เป็นข้อความถูกเก็บเป็น string เพื่อไม่ให้เสียความละเอียด (`fromDbRecord`, 203-209) ดู [[fe-numeric-money]].

## ที่มาในโค้ด
- `frontend/src/lib/schema.ts:14-34,42-62,105-136,138-250` - ชนิดฟิลด์, FieldDef, SectionDef, แปลง DB
- `frontend/src/hooks/useRecordForm.ts:16-68` - สถานะฟอร์ม, dirty
- `frontend/account/form/SchemaForm.tsx:11-76,78-205,220-280,281-310` - ซ่อนตามรุ่น, FieldRow, Section
- `frontend/account/form/FieldControl.tsx:24-60` - ตัววาดตามชนิด
- `frontend/account/config/CompanyProfileForm.tsx:28-135` - โหลด/บันทึกข้อมูลบริษัท
- `frontend/account/config/OptionsForm.tsx:57-137,196-300` - ชนิดธุรกิจ, แท็บ, บันทึก 4 ตาราง
- `frontend/src/config/schemas/erpOption/index.ts:22-60` - 9 แท็บ, คำนำหน้าตาราง
- `frontend/src/lib/bc-query-builder.ts:263-285` - `buildInsertSql`

## ดูเพิ่ม
[[frontend-overview]] · [[fe-master-screens]] · [[fe-standard-master-screen]] · [[fe-grid-component]] · [[fe-query-client-sql-builder]] · [[fe-numeric-money]] · [[fe-tabs-workspace]]
