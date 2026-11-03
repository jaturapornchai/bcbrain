---
title: "พิมพ์รายงาน แบบฟอร์มเอกสาร และตัวออกแบบ (Report Print & Designers)"
tags: [frontend, report, print, designer, pdf]
aliases: ["พิมพ์รายงาน PDF", "GlobalReportPrintModal", "ออกแบบรายงาน", "FastReportDesigner", "สร้าง/แก้ไขแบบฟอร์ม", "FormDesigner", "พิมพ์ใบกำกับภาษี", "GlobalDocFormPrintModal", "ออกแบบงบการเงิน", "doc_form_layout", "ตั้งค่าหน้ากระดาษ"]
sources: ["frontend/account/report/GlobalReportPrintModal.tsx:53", "frontend/account/report/GlobalReportPrintModal.tsx:2271", "frontend/account/report/FastReportDesignerScreen.tsx:145", "frontend/account/report/FormDesignerScreen.tsx:1737", "frontend/account/report/formDesignerPresets.ts:201", "frontend/shared/components/GlobalDocFormPrintModal.tsx:1277", "frontend/account/tabs/screenRegistry.tsx:101"]
---

# พิมพ์รายงาน แบบฟอร์มเอกสาร และตัวออกแบบ

ระบบมีงานพิมพ์ 2 สาย คือ (1) พิมพ์รายงาน: backend เรนเดอร์เป็น PDF แล้วแสดงใน iframe (2) พิมพ์เอกสารซื้อ/ขาย/บัญชี: เบราว์เซอร์โหลดข้อมูลแล้วพิมพ์เองด้วย `window.print()`
ตัวออกแบบ 2 ตัว (`FastReportDesignerScreen`, `FormDesignerScreen`) สร้างโครงรายงาน/แบบฟอร์มเป็น JSON แล้วบันทึกเป็น template ผ่าน `report/run` ของ backend

## ทำงานอย่างไร

### 1) พิมพ์รายงาน: `GlobalReportPrintModal`

- เปิดจากปุ่ม "พิมพ์" ของ `UniversalReportScreen` (ดู [[fe-report-screens]]) ส่ง `basePayload` (เงื่อนไข + คอลัมน์ล่าสุด) เข้ามา
- เมื่อ `open` เป็นจริง จะเรียก `renderPdfFromBackend` (`GlobalReportPrintModal.tsx:2351-2359`) -> `fetchBackendReportPdf` -> `POST /api/process/report/pdf` -> ได้ `blob` เก็บด้วย `URL.createObjectURL` แสดงใน `<iframe>` และ revoke URL ตอนปิด/ถอด component (`renderPdfFromBackend` เริ่ม `:2292` เรียก `fetchBackendReportPdf` ที่ `:2331` และสร้าง URL ที่ `:2335-2340`; revoke ตอนปิดที่ `:2351-2359` และตอนถอด component ที่ `:2361-2367`)
- ปุ่ม "สั่งพิมพ์ออกเครื่องพิมพ์" สั่ง `iframe.contentWindow.print()` ถ้าไม่มี iframe ให้เปิดแท็บใหม่ (`handlePrintIframe`, `:2379-2387`); ปุ่มดาวน์โหลดใช้ชื่อไฟล์จาก header `Content-Disposition` ของ backend (`fetchBackendReportPdf`, `query-client.ts:1029-1056`; ถ้า header ไม่มีชื่อ ใช้ `<menuKey>.pdf`; ปุ่มดาวน์โหลดที่ `GlobalReportPrintModal.tsx:2371-2377`)
- `ReportPrintSettings` (`:53-80`) คือค่าตั้งหน้ากระดาษทั้งหมด: `paperSize` (A4/A3/Letter/Legal/A5/Continuous), `orientation`, `fontSizePt` (ค่าเริ่ม 8.5), `colorMode`, `printTheme` (6 ธีม เช่น `bc_emerald`, `corporate_navy`), `density`, `gridStyle`, `showZebra/showRowNumber/showCompanyHeader/showSignatureBlock`, `autoColumnWidth`, `signatureLabels`, `footerNote`, `groupByColumn/subGroupByColumn`, `reportLang`
- เก็บค่าตั้งใน `localStorage` คีย์ `bc_global_report_print_prefs_v2` (`:104`, `useGlobalReportPrintSettings` `:119-175`); ตอนโหลดจะล้าง `customTitle/customSubtitle/groupByColumn/subGroupByColumn` ทิ้งเสมอ (ไม่ข้ามเมนู, `:130-133`) และยอมรับ `fontSizePt` เฉพาะช่วง 6.5-13.0 (`:136-137`)
- รายงานภาษาอังกฤษ: ถ้า `reportLang === "en"` เบราว์เซอร์แปลชื่อคอลัมน์ ชื่อเรื่อง ป้ายลายเซ็น และ footer ด้วย `translateThaiToEnglish` ก่อนส่ง payload (`:2297-2327`) แล้วส่ง `reportLang` ไปกับ payload ด้วย
- แผง SQL ใน `GlobalReportStudioPanel` มีช่องพิมพ์คำสั่งภาษาคน -> `POST /api/process/workflow/ai-report-sql` (`:1228-1238`) ได้ `title, explanation, sql, suggestedGroupBy, previewRowCount, columns` กลับมา แล้วหน้าจอใส่ SQL ในช่องแก้ไขและสั่งทดสอบ query ทันที (`:1244-1247`)
- ส่วนอื่นใน `GlobalReportPrintModal.tsx` ที่หน้ารายงานใช้: `GlobalReportPageSetupBar` (`:723`, แถบตั้งหน้ากระดาษ), `GlobalReportStudioPanel` (`:1168`, แผงล่างมี 3 tab `sql | columns | templates` ตาม `StudioTabKey` `:699`), `computeAutoColumnWidthsFromData` (`:332`, คำนวณความกว้างคอลัมน์ % จากข้อมูลจริง), `normalizeColumnOverridesWidthPct` (`:264`), `buildInitialColumnOverrides` / `mergeColumnOverrides` (`:660`, `:683`)

### 2) พิมพ์เอกสาร: `GlobalDocFormPrintModal` (shared, ~9,800 บรรทัด)

- เป็น modal เดียวที่ `UniversalTransScreen` ใช้พิมพ์ทุกเอกสาร (`UniversalTransScreen.tsx:109` import, `:4315` ใช้งาน) โดยส่ง `menuKey`, `transFlag(s)`, `docKind`, `docNo`, ข้อมูลคู่ค้า และรายการสินค้าเข้าไป (ดู [[fe-transaction-screens]])
- พิมพ์ด้วย `window.print()` + CSS `@media print` (`handlePrintVerifiedDoc`, `GlobalDocFormPrintModal.tsx:4294-4325`, `:4877`) ไม่ผ่าน `/api/process/report/pdf`
- นับเป็น "พิมพ์เอกสารที่บันทึกแล้ว" ได้เมื่อ `isActualSavedMode = isSavedMode && dbRecord?.verified` (`:2640`) คือโหลดเอกสารกลับจาก DB ด้วย `fetchSavedDocFromDb` (`:2318`) ยืนยันแล้วเท่านั้น
- โหลดข้อมูลหัว/รายการเอกสารเองด้วย `queryList` ตามชนิดเอกสาร: `gl_journal` + `gl_journal_detail` (`:2321-2336`), `cb_chq_list` (`:2384-2392`), `ap_ar_trans` + `ap_ar_trans_detail` (`:2443-2476`), `ic_trans` + `ic_trans_detail` (`:2525-2558`) และข้อมูลบริษัท/คู่ค้า (`erp_company_profile`, `ap_supplier`/`ar_customer` + `_detail`, `:2109-2147`)
- แม่แบบสำเร็จรูป `READY_DOC_FORM_TEMPLATES` (`:205`, 18 แบบ) แต่ละอันระบุ `groupKey` (เช่น `sale_invoice`, `purchase_pr_po`, `payment_voucher`), `legalRef`, ธง `isFullTaxInvoice`/`isAbbrTaxInvoice`/`isTouristVatRefund`/`isCnDn` และ `defaultTransFlags`; `getLockedTemplatesForTransScreen` (`:582`) เลือกกลุ่มแม่แบบที่อนุญาตตาม `transFlag` + ชื่อเมนู
- ขนาดกระดาษ `DOC_PAPER_SIZES` (`:690`): A4, A5, Letter, Continuous 9x11, Continuous 9x5.5, Thermal 80mm, Thermal 58mm (`DocPaperSizeId` `:667-674`); สไตล์ `modern_standard | corporate_classic | executive_minimal | thermal_80mm` (`:760-764`)
- ส่วนประกอบของกระดาษสลับ/ซ่อน/จัดลำดับได้ (`DEFAULT_DOC_SECTION_ORDER` `:947`, `HeaderPieceId`, `PartyPieceId`, ความกว้างคอลัมน์ `DEFAULT_DOC_COL_WIDTHS_PCT` `:967`)
- `calculateThaiTouristVatRefund` (`:113`, เรียกที่ `:4744`) คำนวณยอดคืน VAT นักท่องเที่ยวให้ส่วนของกระดาษ `tourist_vrt` (กรอบคำร้อง ภ.พ.10 / e-VRT, `DocPaperSectionId` `:916`, ป้ายชื่อ `:958`); ตัวเลขเงื่อนไขอยู่ใน comment และฟังก์ชันนี้ (เกณฑ์ทางกฎหมายต้องตรวจกับแหล่งทางการก่อนอ้างอิง ยังไม่ยืนยัน)

#### ที่เก็บค่าของแบบฟอร์มเอกสาร

| ข้อมูล | ที่เก็บ | ที่มา |
|---|---|---|
| ค่าตั้งแบบพิมพ์ล่าสุดต่อเมนู | `localStorage` `bc_doc_form_prefs_v2` | `GlobalDocFormPrintModal.tsx:1211`, `:4118-4132` |
| ชุด preset ที่ตั้งชื่อ | `localStorage` `bc_doc_form_named_presets_v1` | `:1212` |
| layout ต่อเมนู / ค่ากลาง `__GLOBAL__` | DB ตาราง `erp_business_ext` (`entity_type='doc_form_layout'`, `ON CONFLICT (entity_type, entity_code)`) | `:2014-2019`, `:4143-4166` |
| preset ชื่อที่แชร์ | `erp_business_ext` `entity_type='doc_form_layout_preset'` | `:2049`, `:4224-4230` |
| จำนวนครั้งที่พิมพ์ (audit) | `erp_business_ext` `entity_type='doc_print_audit'` คีย์ `<transFlag>:<docNo>` เก็บ `print_count`, `last_printed_at`, `unsaved_attempt_count` | `:4294-4325`, `:2253` |
| แม่แบบที่ผูกกับ "รูปแบบเอกสาร" | `UPDATE erp_doc_format SET form_code=...` เมื่อบันทึก layout | `:4168-4176` |

- การพิมพ์เอกสารที่ยังไม่บันทึกจะนับเป็น `unsaved_attempt_count` (ผ่าน event `beforeprint`, `:2640-2672`) และมี prop `onSaveBeforePrint` (`GlobalDocFormPrintModal.tsx:891`, `:4327-4334`) ให้จอเรียก `handleSave` ก่อนพิมพ์ (`UniversalTransScreen.tsx:4324`)
- `DocFormatScreen` (`account/master/DocFormatScreen.tsx:37`, `:1155`) นำ `READY_DOC_FORM_TEMPLATES` ไปแสดงเป็นตัวเลือก `form_code` ในจอตั้งรูปแบบเอกสาร

### 3) ตัวออกแบบรายงาน: `FastReportDesignerScreen` (~4,070 บรรทัด)

- ลงทะเบียนผ่าน `createReportDesignerScreen` (`screenRegistry.tsx:101-130`) ซึ่งเลือกจอตาม `variant` / `menuKey` และส่ง `menuCode` ผ่าน `getMenuCodeByName` (`screenRegistry.tsx:113`, `:123`):

| เมนู (รหัสเมนู) | `menuKey` | variant | จอ |
|---|---|---|---|
| ออกแบบรายงาน (1094) | `fast_report_designer` | `fast_report` | `FastReportDesignerScreen` |
| สร้าง/แก้ไขแบบฟอร์ม (1093) | `menu_form_edit` | `form_designer` | `FormDesignerScreen` |
| ออกแบบงบการเงิน (1092) | `menu_gl_report_design` | `gl_statement` | `FastReportDesignerScreen` (เปิด tab `account`) |
| นำเข้ารายงาน (1114) | `menu_import_report` | `import_report` | `FastReportDesignerScreen` |
| นำเข้ารายงานสาขา (1115) | `menu_import_report_branch` | `import_report` + `branchMode` | `FastReportDesignerScreen` |
| นำเข้าแบบฟอร์ม (1113) | `menu_import_formdesign` | `import_report` (แต่ wrapper เปลี่ยนเป็น `FormDesignerScreen` เพราะ `menuKey` ตรง, `screenRegistry.tsx:109`) | `FormDesignerScreen` `initialImportMode` |

(ที่มา: `screenRegistry.tsx:101-130`, ลงทะเบียน `:190-262`; รหัสเมนูในวงเล็บคือรหัสที่ `getMenuCodeByName` คืนจากโครงเมนู `bcMenu`; เลขแบบจุด "1.13", "1.12" ฯลฯ ที่ลงทะเบียนไว้ใน `BASE_SCREENS` เป็นแค่ค่าสำรองเมื่อไม่พบชื่อเมนู) <!-- pragma: allowlist secret -->

- โครง JSON `BcReportDesignJSON` (`schemaVersion: "bc.report.json.v1"`, `:145-162`): `menuId, menuName, reportType (0..8), ownerCode, header, refNo, splitRow, showLineLastPage, paperSize, orientation, fontSizePt, conditions[], queries[] (Query 1..7 พร้อม fields), account (งบการเงิน), updatedAt`; ประเภทรายงาน 9 แบบ `BC_FASTREPORT_TYPES` (`:167-181`, 0 ทั่วไป ... 8 บัญชี)
- tab ฝั่งขวา: `condition, query1..query7, account, options, json` (`DesignerTabKey` `:868-879`)
- ดู Preview (`handleRunPreview`, `:1057-1143`) = เรียก `runBackendReport` (`report/run`, `:1094-1113`) ด้วย `customSql` ที่ `buildExecutableQuery` (`:1005-1023`) แทน `command` ของทุกเงื่อนไข (ค่าเริ่มต้นมี `#from_date#`, `#to_date#`, `#from_code#`, `#keyword#`) ด้วยค่าที่กรอกหรือค่าเริ่มต้น โดยครอบเครื่องหมาย ' และ escape ' ซ้ำ ปุ่ม Get Field (`handleGetFieldsFromSQL`, `:1189-1275`) รัน `queryForGetField` หรือ `SELECT * FROM <ตาราง> LIMIT 1` เพื่อค้นคอลัมน์ (`:1191-1193`)
- แผงซ้าย Resource/Schema โหลดรายชื่อตารางจริงจาก `information_schema.columns` ด้วย `queryList` จำกัด 400 แถว (`handleLoadDatabaseSchema`, `:1156-1178`)
- บันทึก = `runBackendReport` ด้วย `menuKey: "fast_report_designer"` + `templateAction: "save"` โดยใส่ JSON ทั้งก้อนไว้ใน `footerNote` (`JSON.stringify(nextDesign)`, `handleSaveToDatabase` `:1280`, `:1323-1327`); ลบ = `templateAction: "delete"` (`:1371`) ต้องมีสิทธิ์ `rights.canDelete` (`:1355`); บันทึกถูกห้ามเมื่อ `rights.readOnly` (`:1287`)
- ส่งออก/นำเข้าไฟล์ `<id>.report.json` ด้วย `Blob`/`FileReader` (ส่งออก `:1384-1401`, นำเข้า `:1404-1436`) ไม่ใช้ XML แล้ว (ข้อความสถานะ "JSON-First เลิกใช้ XML 100%", `:894`)

### 4) ตัวออกแบบแบบฟอร์ม: `FormDesignerScreen` (~5,540 บรรทัด) + `formDesignerPresets.ts` (~3,320 บรรทัด)

- JSON `BcFormDesignJSON` (`schemaVersion: "bc.formdesign.json.v1"`, `formDesignerPresets.ts:201-213`): `formCode, formName, formGuid, formType, transFlagInfo, pageSetup, pages[], queries[], imageList[], updatedAt`; ชนิดฟอร์ม 4 แบบ `BC_FORM_TYPES` (`:218-227`) (0 ทั้งหมด, 1 พิมพ์เอกสาร, 2 บาร์โค้ดสินค้า, 3 ป้ายชื่อขนส่ง)
- เครื่องมือวาด `FormDrawToolType` (`:7-19`): Pointer, Label, TextField, SpecialLabel, Table, Line, Rectangle, RoundedRectangle, Ellipse, Picture, ImageField, Barcode; หน่วยไม้บรรทัด `FormRulerUnit` = Centimeter/Millimeter/Inch/Pixel (`:21`); `CM_TO_PX = 37.795...` (96 DPI, `:266`)
- `presets` ในไฟล์: พื้นหลังสำเร็จรูป `BUILTIN_BACKGROUND_FORM_PRESETS` (`:293`), แบบฟอร์มมาตรฐาน `BC_STANDARD_FORM_TEMPLATES` (`:510`, 3 แบบ: `TAX-INV-A4`, `CHEQUE-TH`, `WHT-50TAWI`; แต่ละอันมี `buildDesign()`), `createDefaultFormQueries` (`:457`) และฟังก์ชันตัวเลขเป็นตัวอักษร `numberToThaiBahtText` (`:1771`) / `numberToEnglishBahtText` (`:1815`)
- โหลดรายการฟอร์มด้วย `queryList` จากตาราง `formdesign` (+ ข้อมูลตัวอย่างจาก `ic_trans`, `ic_trans_detail`, `erp_company_profile`) (`loadSavedFormsAndSampleData`, `FormDesignerScreen.tsx:987-1041`)
- บันทึก = `runBackendReport` ด้วย `menuKey: "menu_form_edit"` + `templateAction: "save"`, `footerNote: JSON.stringify(nextDesign)`, ชื่อ template `"<formCode> : <formName>"` (`handleSaveFormToDatabase`, `:1737-1811`, ชื่อ template `:1785`); ข้อความยืนยันระบุว่าเขียนลงตาราง `formdesign` และ `erp_report_template` (`:1804`); ตรงนี้ตารางจริงที่ backend เขียน (ยังไม่ยืนยัน ไม่ได้อ่านโค้ด backend)
- ส่งออก `handleExportFormJson` (`:1814-1829`) / นำเข้าไฟล์ JSON ของฟอร์ม `handleImportFormJson` (`:1831-1860`)

## ข้อควรระวัง

- รูปแบบรายงาน (template) กับดีไซน์ JSON ใช้กลไกเดียวกัน: ส่ง `templateAction` ผ่าน `report/run`; เวลาเพิ่ม/ลบรูปแบบต้องส่งเงื่อนไขรายงานครบชุด เพราะ endpoint คือรันรายงานจริงอีกรอบ
- พิมพ์รายงาน (PDF จาก backend) กับพิมพ์เอกสาร (`window.print()` ในเบราว์เซอร์) ไม่ใช่โค้ดชุดเดียวกัน แก้หน้าตาเอกสารต้องแก้ใน `GlobalDocFormPrintModal.tsx` ส่วนรายงานต้องแก้ฝั่ง backend renderer ด้วย
- ไฟล์ designer ใหญ่มาก (4-5 พันบรรทัด) ให้ค้นด้วยชื่อฟังก์ชัน เช่น `handleSaveFormToDatabase`, `handleRunPreview`, `handleImportJsonFile` แทนการอ่านทั้งไฟล์

## ที่มาในโค้ด

- `frontend/account/report/GlobalReportPrintModal.tsx:53-175` ค่าตั้งและ localStorage; `:2271-2495` modal พิมพ์ PDF (เปิดจาก `UniversalReportScreen.tsx:2422`)
- `frontend/account/report/FastReportDesignerScreen.tsx:145-181` type JSON และประเภทรายงาน; `:868-879` tab; `:1005-1143` preview; `:1280-1381` save/delete; `:1384-1436` ส่งออก/นำเข้า
- `frontend/account/report/FormDesignerScreen.tsx:987-1041` โหลดรายการ; `:1737-1860` บันทึก/ส่งออก/นำเข้า
- `frontend/account/report/formDesignerPresets.ts:7-227` type และชนิดฟอร์ม; `:266` `CM_TO_PX`; `:1771`, `:1815` ตัวเลขเป็นข้อความ
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:56-100, 205, 582, 667-690, 1277, 2014, 4118-4177, 4294-4325`
- `frontend/account/tabs/screenRegistry.tsx:101-130` `createReportDesignerScreen`; `:190-262` ลงทะเบียน 6 เมนู
- `frontend/account/transaction/UniversalTransScreen.tsx:109`, `:4315-4324` เรียก modal พิมพ์เอกสาร

## ดูเพิ่ม

[[fe-report-screens]] | [[fe-transaction-screens]] | [[fe-api-proxy-routes]] | [[fe-screen-registry-menu]] | [[fe-query-client-sql-builder]] | [[frontend-overview]] | [[accounting-overview]]
