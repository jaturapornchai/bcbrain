---
title: "ตัวออกแบบรายงานและแบบฟอร์ม (FastReportDesignerScreen / FormDesignerScreen)"
tags: [screens, report, admin]
aliases: ["FastReportDesignerScreen", "FormDesignerScreen", "ออกแบบรายงาน", "สร้าง/แก้ไขแบบฟอร์ม", "ออกแบบงบการเงิน", "นำเข้ารายงาน", "นำเข้าแบบฟอร์ม", "นำเข้ารายงานสาขา", "fast_report_designer", "menu_gl_report_design", "menu_form_edit", "menu_import_formdesign", "menu_import_report", "menu_import_report_branch", "form_designer"]
sources: ["frontend/account/tabs/screenRegistry.tsx:101-131", "frontend/account/tabs/screenRegistry.tsx:195-200", "frontend/account/tabs/screenRegistry.tsx:252-259", "frontend/src/config/bcMenu.ts:337-339", "frontend/shared/layout/MenuBar.tsx:819-821", "frontend/account/tabs/TabWorkspace.tsx:542-548", "frontend/account/report/FastReportDesignerScreen.tsx:859-866", "frontend/account/report/FastReportDesignerScreen.tsx:1057-1147", "frontend/account/report/FastReportDesignerScreen.tsx:1280-1352", "frontend/account/report/FastReportDesignerScreen.tsx:3897-3928", "frontend/account/report/FormDesignerScreen.tsx:809-815", "frontend/account/report/FormDesignerScreen.tsx:1737-1811", "frontend/account/report/FormDesignerScreen.tsx:4924-5100", "frontend/account/report/formDesignerPresets.ts:510", "backend/internal/application/process/report.go:246-376", "backend/internal/application/process/report_template.go:338-473", "backend/internal/application/process/report_template.go:644-679", "backend/internal/adapter/inbound/http/process/permission.go:60-67"]
---
# ตัวออกแบบรายงานและแบบฟอร์ม (FastReportDesignerScreen / FormDesignerScreen)

เครื่องมือสร้างและแก้ไข "แบบรายงาน" (ตารางข้อมูลจาก SQL) และ "แบบฟอร์มพิมพ์" (วางวัตถุบนกระดาษ A4/ใบเสร็จ/เช็ค) ของระบบ BC Ai Account มี 2 จอจริงในโค้ด คือ `FastReportDesignerScreen` และ `FormDesignerScreen` เมนูทั้ง 6 รายการของกลุ่มนี้ใช้ 2 จอนี้ร่วมกัน จอรายงานเก็บแบบที่ออกแบบลงตาราง `erp_report_template` ผ่าน API `report/run` จอแบบฟอร์มเก็บลงตารางเดียวกันและให้หลังบ้านคัดลอกอีกชุดลงตาราง `formdesign` เลขบรรทัดที่ไม่ระบุไฟล์ในส่วนจอรายงานเป็นของ `frontend/account/report/FastReportDesignerScreen.tsx` และในส่วนจอแบบฟอร์มเป็นของ `frontend/account/report/FormDesignerScreen.tsx`

## วิธีเปิด (6 เมนู)
`screenRegistry.tsx:101-131` ห่อทั้ง 2 จอไว้ในตัวเลือกเดียว: ถ้าคีย์เป็น `form_designer`, `menu_form_edit` หรือ `menu_import_formdesign` เปิด `FormDesignerScreen` (ส่ง `initialImportMode` ตามเมนู) นอกนั้นเปิด `FastReportDesignerScreen` (`:109-129`) การลงทะเบียนอยู่ที่ `:195-200`, `:206-211`, `:217-222`, `:228-234`, `:240-247`, `:252-259`

| รหัสเมนู | คีย์ (`name`) | ชื่อเมนู | จอที่เปิด | พฤติกรรมตอนเปิด |
|---|---|---|---|---|
| 1094 | `fast_report_designer` | ออกแบบรายงาน | `FastReportDesignerScreen` | เริ่มที่แท็บ Query 1 (`:903-908`) |
| 1092 | `menu_gl_report_design` | ออกแบบงบการเงิน | `FastReportDesignerScreen` (variant `gl_statement`) | เริ่มที่แท็บ Account (`:903-908`) |
| 1093 | `menu_form_edit` | สร้าง/แก้ไขแบบฟอร์ม | `FormDesignerScreen` | เริ่มในโหมดดู (`isEditing` เริ่มเป็น false, `FormDesignerScreen.tsx:837`) |
| 1113 | `menu_import_formdesign` | นำเข้าแบบฟอร์ม | `FormDesignerScreen` | เปิดหน้าต่าง "เปิดแบบฟอร์ม" ทันที (`:852`) |
| 1114 | `menu_import_report` | นำเข้ารายงาน | `FastReportDesignerScreen` | เปิดหน้าต่างโหลดแบบทันที (`:945-947`) |
| 1115 | `menu_import_report_branch` | นำเข้ารายงานสาขา | `FastReportDesignerScreen` | เหมือน 1114 ค่า `branchMode` เปลี่ยนแค่ชื่อหน้าต่าง (`:3683-3687`) |

รหัสในตารางมาจากการอ่านเมนูจริงผ่าน `frontend/src/config/bcMenu.ts` (บรรทัดเมนูใน `frontend/src/config/bcMenu.json` คือ `:1334`, `:1355`, `:1369`, `:1698`, `:1712`, `:1726`) ทั้ง 6 เมนูเป็น "เฉพาะผู้ดูแลระบบ": ตัวกรองเมนูอยู่ที่ `bcMenu.ts:337-339`, `:365-367`, `:392-397` ป้ายแสดงที่ `MenuBar.tsx:819-821` และผู้ใช้ที่ไม่ใช่แอดมินที่เปิดเมนูเหล่านี้จะถูกปฏิเสธใน `TabWorkspace.tsx:542-548` (ดู [[scr-admin-permissions]], [[fe-screen-registry-menu]]) การจำกัดนี้ทำที่ฝั่งหน้าเว็บเท่านั้น ฝั่ง API ดูหัวข้อ "ฝั่งหลังบ้าน"

ทางลัดอื่นเข้าจอแบบฟอร์ม: ปุ่ม "Form Designer" ในหน้าต่างพิมพ์เอกสาร (`GlobalDocFormPrintModal.tsx:5100-5112`) ที่เรียก `onOpenFormDesignerStudio` ของ `UniversalTransScreen` (`UniversalTransScreen.tsx:4353`, เลขบรรทัดตามฉบับ commit ล่าสุด) ดู [[scr-report-print-modal]], [[scr-universal-trans]]

## 1. ตัวออกแบบรายงาน (`FastReportDesignerScreen`)
Props รับ `menuKey`, `menuCode`, `title`, `variant` และโหมดนำเข้า (`:859-866`) เริ่มในโหมดแก้ไขทันที (`isEditing` เริ่มเป็น true, `:891`) การแก้ค่าใด ๆ เพิ่มตัวนับ `dirtyCount` และแสดงป้าย "แก้ไขแล้ว N จุด" (`markModified` `:973-986`, ป้าย `:1672-1674`) การบันทึก ลบ และเพิ่มใหม่ถูกคุมด้วยสิทธิ์ของผู้ใช้ในจอ (`rights.canAdd`, `canEdit`, `canDelete`, `readOnly`)

### แถบปุ่มและแท็บ
- ปุ่มหลักมี 2 ชุด (`:1694-1775`) ชุดโหมดดู: **แก้ไข** (ต้องมีสิทธิ์แก้), **เพิ่มใหม่** (สร้างแบบเปล่ารหัส `REP-` ตามด้วยเลข 4 หลักจากเวลา แล้วเข้าโหมดแก้ไข, `:1706-1723`), **ลบ**, และ **ปิดหน้าจอ** (แสดงเฉพาะเมื่อจอถูกเปิดเป็นแท็บและมี `onClose`) ชุดโหมดแก้ไข: **บันทึก** (ปิดเมื่อสิทธิ์เป็นอ่านอย่างเดียว) กับ **ปิดหน้าจอ** ที่ทำงานเป็นขั้นเดียว: ถ้ามีแก้ไขค้าง ปุ่มนี้แค่ล้างตัวนับและออกจากโหมดแก้ไข โดยไม่ย้อนค่าและไม่ถามยืนยัน (`:1761-1763`) กดอีกครั้งจึงปิดแท็บ (`:1764-1765`)
- ToolStrip (`:1791-1930`) สั่งโหลดแบบ ส่งออก/นำเข้า JSON พิมพ์ และรันตัวอย่าง
- แท็บ (`:2394-2404`): Condition, Query 1-7, Account (งบการเงิน), Report Options (`:3492-3600`), JSON Schema (`:3605-3669`)
- แท็บ Condition (`:2428-2531`) กำหนดช่องเงื่อนไขของรายงาน ค่าตั้งต้น (`conditionValues`) อยู่ที่ `:915-921` ส่วนปุ่ม "Condition Preview" (`:2523-2530`) และปุ่ม "ประมวลผลงบการเงิน" ในแท็บ Account (`:3275`) คือการสั่งรันตัวอย่างซ้ำ (`handleRunPreview`) ไม่ได้คำนวณงบด้วยตรรกะแยก

### แท็บ Query (`:2776-3203`)
ตารางนิยามฟิลด์ 16 คอลัมน์ (`:2919-2936`) ผู้ใช้เขียน SQL ของแต่ละบล็อกเอง บล็อกว่างสร้างโดย `createEmptyQueryBlocks` (`:282-422`) และแบบตั้งต้นโดย `createDefaultReportDesignJSON` (`:424-573`) ชนิดรายงานที่เลือกได้อยู่ใน `BC_FASTREPORT_TYPES` (`:167-181`) ช่อง Relation, Left Margin และ Font (`:3139-3202`) เก็บค่าลงแบบเท่านั้น ไม่มีผลกับตัวอย่างหรือการพิมพ์ในหน้านี้

### ตัวอย่าง (Preview)
- `buildExecutableQuery` (`:1005-1024`) เตรียม SQL และ `backendColumnOverrides` (`:1034-1054`) จับคู่ชื่อคอลัมน์ `handleRunPreview` (`:1057-1147`) รันเฉพาะ SQL ของ Query 1 เท่านั้น ผ่าน `report/run` พร้อม `customSql`
- แท็บ Account ใช้ SQL สำเร็จรูปที่ฝังในโค้ด (`:1065-1080`, `LIMIT 200`) ดึงยอดบัญชี ไม่ใช้ช่วงบรรทัดหรือสูตรที่ผู้ใช้ตั้ง
- ตารางตัวอย่างแสดงไม่เกิน 60 แถว (`:2276`) และข้อความตัวอย่างในช่องที่ยังไม่มีข้อมูลเขียนว่า "ตามยอดบัญชีจริง" (`:2226`) ตัวอย่างรันอัตโนมัติครั้งแรกเมื่อเปิดจอ (`:1150-1153`)
- พิมพ์ (`:3897-3928`) ส่ง SQL ของแท็บ Query ที่เปิดอยู่ (`customSql`, `:3917`) ไปพร้อมคอลัมน์ของ Query 1 (`customColumns`, `:3918`) ต่างจากตัวอย่างที่ใช้ Query 1 อย่างเดียว

### แผงตาราง (Schema dock) และ Get Field
- แผงตาราง (`:1156-1184`) อ่านรายการคอลัมน์จาก `information_schema.columns` ของตารางที่กำหนดไว้ในโค้ด 11 ตาราง ด้วย `LIMIT 400` (`:1170`) เพื่อให้เลือกชื่อฟิลด์ไปใส่ SQL
- "Get Field" (`:1189-1275`) รัน `queryForGetField` ของแท็บที่เปิดอยู่ ถ้าว่างใช้ `SELECT * FROM <ตารางต้นทาง หรือ ic_trans> LIMIT 1` (โหมด `report_ic` ช่วงวันที่ 2020-01-01 ถึงวันนี้) แล้วสร้างแถวฟิลด์จากคอลัมน์ที่ได้: คอลัมน์ที่ชื่อตรงกับฟิลด์เดิมคงแถวเดิมไว้ ที่เหลือเดาชนิด Number/Date/Text และรูปแบบจากชนิดคอลัมน์ ถ้า SQL ของบล็อกยังว่างจะใส่ SQL นี้ให้โดยเปลี่ยน `LIMIT 1` เป็น `LIMIT 100`

### บันทึก ลบ และโหลด
- **บันทึก** (`:1280-1352`): ส่ง `report/run` พร้อม `templateAction = save` ใช้ `menuKey` ค่าคงที่ `fast_report_designer` ทุกเมนูของจอรายงานจึงเก็บรวมใต้คีย์เดียวกัน ชื่อแบบคือ `<menuId> : <menuName>` เก็บ JSON ของแบบทั้งก้อนใน `footerNote` เก็บ SQL ของ Query 1 ใน `customSql` และคอลัมน์ของ Query 1 ใน `customColumns` (`:1309-1329`) ถ้าจอมี `activeTemplateId` จะอัปเดตแถวเดิม ถ้าบันทึกผ่านหน้าต่าง "บันทึกเป็น" (`:3883-3892`, คอมโพเนนต์ `:3937-4062`, ตรวจข้อมูลที่ `:4048-4049`) จะสร้างแถวใหม่ เมื่อสำเร็จจอออกจากโหมดแก้ไขและล้างตัวนับ (`:1338-1343`) เมื่อไม่สำเร็จแสดงข้อความผิดพลาดใน `previewError`
- **ลบ** (`:1354-1381`): ถ้ายังไม่เคยบันทึก (ไม่มี `activeTemplateId`) แค่รีเซ็ตแบบกลับค่าเริ่มต้นในหน้าจอ ถ้ามีแล้วและมีสิทธิ์ลบ ส่ง `templateAction = delete` ไม่มีกล่องยืนยัน เมื่อสำเร็จล้าง `activeTemplateId` และอัปเดตรายการแบบ แต่ไม่รีเซ็ตแบบที่แสดงอยู่ เมื่อไม่สำเร็จไม่แสดงข้อความใด (`:1365-1380`)
- **ส่งออก JSON** (`:1384-1401`) ดาวน์โหลดไฟล์ `<menuId>.report.json` **นำเข้า JSON** (`:1404-1436`) ผสมไฟล์เข้ากับแบบตั้งต้น ตั้ง `schemaVersion = bc.report.json.v1` เข้าโหมดแก้ไขแล้วรันตัวอย่าง
- **โหลดแบบ** (`:1439-1494`, หน้าต่าง `:3676-3878`): รายการแบบที่บันทึกไว้ (`savedTemplates`) มากับผลของ `report/run` ทุกครั้งที่รันตัวอย่าง บันทึก หรือลบ (`:1125-1127`, `:1335-1337`, `:1376-1378`) เลือกต้นแบบสำเร็จรูป (preset) จะไม่มี `activeTemplateId` เลือกแบบจากฐานข้อมูลจะอ่าน JSON จาก `footerNote` ถ้าอ่านไม่ได้จะสร้างแบบใหม่จาก `customTitle`, `customSubtitle` และ `customSql` แล้วรันตัวอย่างทันที ช่องติ๊กเลือก (`selectedImportIds`, `:951`, `:3759`, `:3809`) ในหน้าต่างโหลดไม่มีผลต่อการโหลด

## 2. ตัวออกแบบแบบฟอร์ม (`FormDesignerScreen`)
Props `:809-815`; ออกแบบตั้งต้นสร้างที่ `:820-822` เครื่องมือวาดมี 12 ชนิด (`formDesignerPresets.ts:7-19`) ชนิดแบบฟอร์มใน `BC_FORM_TYPES` (`:218-227`)

### การวางและแก้วัตถุ
- วางวัตถุ (`:1131-1163`) และปุ่มฟิลด์ด่วน (`:1166-1196`) ลากย้ายวัตถุ (`:1199-1245`) ไม่เข้า undo ส่วนลบ/คัดลอก/วาง/จัดชั้น (`:1248-1315`) เข้า undo
- undo เก็บย้อนหลัง 25 ขั้น (`:955-984`)
- วัตถุที่ล็อกตำแหน่งลบไม่ได้ ต้องปลดล็อกก่อน (`:1251`) การผูกข้อมูลของวัตถุตั้งที่แผงคุณสมบัติ (`:3542-3565`)
- ริบบอน (`:2145-2489`) และแผงซ้าย 3 แท็บ: เครื่องมือ/ฟิลด์ ชั้นวัตถุ ต้นแบบ (`:2508-2618`) ข้อความช่วยเหลือของปุ่มลบที่ `:2191` บอกว่ากดปุ่ม Delete ได้ แต่โค้ดไม่มีตัวจับปุ่มนี้

### ปุ่มหลัก
ปุ่มหลักมี 2 ชุดเหมือนจอรายงาน (`:1957-2035`) ชุดโหมดดู: **แก้ไข** (`:1957-1964`), **เพิ่มใหม่**, **ลบ**, **ปิดหน้าจอ** ชุดโหมดแก้ไข: **บันทึก** กับ **ปิดหน้าจอ**
- **เพิ่มใหม่** (`:1965-1986`) เสนอรหัส `FORM-NNN` (จำนวนแบบที่บันทึกแล้ว + 1) เตรียมค่าในหน้าต่าง "แบบฟอร์มใหม่" ล้าง `activeTemplateId` แล้วเข้าโหมดแก้ไข แต่ไม่เปิดหน้าต่างนั้นและไม่ล้างแบบที่แสดงอยู่ การบันทึกต่อจากนี้จึงสร้างแถวใหม่ด้วยแบบเดิมที่แสดงอยู่
- **ลบ** (`:1987-1999`) ไม่ลบอะไรในฐานข้อมูล แค่เปลี่ยนแบบที่แสดงเป็นแบบมาตรฐานแบบแรกในรายการ (`BC_STANDARD_FORM_TEMPLATES[0]`) และไม่ล้าง `activeTemplateId` ถ้ากดแก้ไขแล้วบันทึกต่อ แบบมาตรฐานจะเขียนทับแถวที่เปิดไว้
- **ปิดหน้าจอ** ในโหมดดู เรียก `onClose` (`:2003-2008`) ในโหมดแก้ไข (`:2021-2032`) ปุ่มชื่อเดียวกันแค่ออกจากโหมดแก้ไขและล้างตัวนับ โดยไม่ย้อนค่า ไม่ถามยืนยัน และไม่ปิดแท็บ ต้องกดอีกครั้งในโหมดดู
- แถบไอคอน (`:2038-2130`): ฟอร์มใหม่ (`:2044-2055`), เปิด (`:2057-2062`), บันทึกเป็น (`:2064-`)
- แบบฟอร์มใหม่ผ่านหน้าต่างเฉพาะ (`:1320-1395`, หน้าต่าง `:5160`)

### เปิด บันทึก และตัวอย่างข้อมูล
- หน้าต่างเปิด (`:4653-4745`) แสดงแบบมาตรฐานจากโค้ด (`BC_STANDARD_FORM_TEMPLATES`, `formDesignerPresets.ts:510` เช่น `TAX-INV-A4` `:518`, `CHEQUE-TH` `:1309`, `WHT-50TAWI` `:1538`) และแบบที่บันทึกไว้ใน `erp_report_template` การโหลดแบบมาตรฐาน (`FormDesignerScreen.tsx:4678-4688`) ไม่ล้าง `activeTemplateId` จึงทำให้การบันทึกครั้งถัดไปเขียนทับแบบที่เปิดไว้ก่อนหน้า
- **บันทึก** (`:1737-1811`) ทำได้ด้วยปุ่ม (`:2013-2020`) หรือ `Ctrl+S` ขณะอยู่ในโหมดแก้ไข (`:1863-1875`) ส่ง `report/run` ด้วย `menuKey = menu_form_edit` ชื่อแบบ `<formCode> : <formName>` เก็บ JSON ของแบบทั้งก้อนใน `footerNote` และส่ง SQL ของคิวรีลำดับ 1 (`queries[1]` ที่หน้าจอเรียก Query 1 เพราะนับจาก 0) หรือ `SELECT ... FROM ic_trans LIMIT 10` ถ้าว่าง เป็น `customSql` หน้าต่าง "บันทึกเป็น" (`:4768-4847`) ส่งโดยไม่มี `templateId` จึงสร้างแถว `erp_report_template` ใหม่ทุกครั้ง
- ส่งออก/นำเข้าไฟล์ JSON (`:1814-1860`)
- ข้อมูลตัวอย่างบนกระดาษ (`loadSavedFormsAndSampleData` `:987-1038`) โหลดผ่านตัวช่วยคิวรีของหน้าเว็บ: รายการแบบจาก `report/run` ของ `menu_form_edit`, 100 แถวแรกของตาราง `formdesign` (เก็บใน `dbFormDesignRows` `:890`, `:1024` ซึ่งยังไม่มีส่วนใดนำไปใช้), ข้อมูลบริษัท 1 แถวจาก `erp_company_profile`, หัวเอกสารล่าสุด 15 แถวจาก `ic_trans` และรายการสินค้า 15 แถวจาก `ic_trans_detail`
- แบบตั้งต้นมี 5 คิวรี (`createDefaultFormQueries`, `formDesignerPresets.ts:457-505`) หน้าต่าง Query (`FormDesignerScreen.tsx:4856-4919`) แก้ SQL ผูกข้อมูลของแบบที่แสดงอยู่ และค่าจะถูกเก็บลงฐานเมื่อบันทึกแบบ
- ฟังก์ชันแปลงจำนวนเงินเป็นคำอ่านบาทไทยและอังกฤษ (`formDesignerPresets.ts:1771`, `:1815`) ใช้แสดงวัตถุคำอ่านจำนวนเงินในจอนี้ (`FormDesignerScreen.tsx:741-742`) และหน้าต่างพิมพ์เอกสารของ ERP ยืมไปใช้ต่อ (`GlobalDocFormPrintModal.tsx:4513-4516`, [[scr-report-print-modal]])
- "สแกนด้วย AI" (`:1400-`, ชนิดข้อมูลที่ `formDesignerPresets.ts:2040-`) ทำบนแคนวาสในเครื่อง ไม่เรียกเครือข่าย
- ตัวอย่างก่อนพิมพ์ (`:4924-5100`): ปุ่มพิมพ์ที่ `:4989` ใช้ `window.print` ค่าชดเชยหัวพิมพ์ (`:5045-5046`) มีผลกับภาพตัวอย่างเท่านั้น ไม่ส่งไปเครื่องพิมพ์

## ฝั่งหลังบ้าน
- เส้นทาง `report/run` ใน `backend/internal/application/process/report.go:246-376` ตั้งเวลาสูงสุด 45 วินาที (`:253`) จัดการแบบ (`TemplateAction`, `report.go:67`) ที่ `:258-265` แล้วรัน SQL กำหนดเอง (`:327-343`) คีย์ของตัวออกแบบอยู่ที่ `:393-403`
- `report_template.go`: สร้างตารางด้วย DDL (`:195-232`), รายการแบบกรองด้วย `menu_key = $1 OR '*'` (`:243-305`), บันทึก/ลบ/ตั้งค่าเริ่มต้น (`:338-473`) JSON ของการออกแบบ (ทั้งรายงานและแบบฟอร์ม) ไปอยู่ในฟิลด์ `footerNote` ของ `page_setup_json` (`:475-493`) ถ้า `menuKey` เป็น `menu_form_edit` หรือ `menu_import_formdesign` หลังบ้านลบแถวในตาราง `formdesign` ที่ `formcode` ตรงกัน (ไม่สนตัวพิมพ์) หรือ `guid_code` ตรงกัน แล้วเพิ่มแถวใหม่ที่เก็บ JSON เดียวกันใน `formdesigntext` (`:401-427`) ค่า `form_type` ที่เขียนเป็น 0 เสมอ (`:418`) ไม่ใช่ชนิดแบบที่ผู้ใช้เลือก และ `formcode` ถูกตัดที่ 25 ตัวอักษร (`:406-408`) ถ้า `templateId` ที่ส่งมาเป็นของรายงานอื่น การบันทึกตอบ "ไม่พบ" (`:398-400`) ข้อความผิดพลาดของขั้นตอน `formdesign` ที่ `:414`, `:425` ในโค้ดเป็นตัวอักษร "?" ทั้งหมด
- รัน SQL กำหนดเอง (`:644-679`) ตรวจว่าเป็นคำสั่งอ่านอย่างเดียว (`validateReadOnlyReportSQL`, `:499-529`) รันในธุรกรรมแบบอ่านอย่างเดียว (`:664-667`) และครอบด้วย `LIMIT 50000` (`:657-662`) ไม่มีรายการตารางที่อนุญาต ตัวแปร `#...#` ที่นักออกแบบเก็บไว้ไม่ถูกขยายโดยฟังก์ชันขยายพารามิเตอร์ของหลังบ้าน (`:604-640`)
- เทมเพลตถูก commit (`report.go:258-265`, `report_template.go:428`) ก่อนรัน SQL กำหนดเอง (`report.go:327-343`) ถ้า SQL ผิดหลังบันทึก API ตอบล้มเหลว แต่แบบถูกบันทึกแล้ว
- สิทธิ์: ที่ชั้นเส้นทาง `report/run` และ `report/pdf` ที่มี `customSql` ไม่ว่าง ต้องมีสิทธิ์ผู้ดูแลระบบ ถ้าไม่มี `customSql` จัดเป็นสิทธิ์อ่าน (`permission.go:60-67`) เมนูทั้ง 6 จึงจำกัดแอดมินที่ฝั่งหน้าเว็บ ส่วนการลบหรือตั้งค่าเริ่มต้นของแบบผ่าน `report/run` โดยไม่มี `customSql` ไม่มีตัวตรวจสิทธิ์เฉพาะที่พบในชั้นเส้นทาง (ยังไม่ได้ทดสอบจริง)

## ข้อควรระวัง
- แบบที่ออกแบบในจอฟอร์มไม่มีโค้ดส่วนใดของหน้าพิมพ์เอกสาร ERP อ่านไปใช้ หน้าต่างพิมพ์เอกสารใช้แบบจาก [[scr-doc-format]] และตัวพิมพ์ของตัวเอง ([[scr-report-print-modal]]) จอนี้เป็นแหล่งเก็บและดูตัวอย่างแบบเท่านั้น
- ตัวอย่างของจอรายงานรันเฉพาะ Query 1 พิมพ์รันแท็บที่เปิดอยู่ ผลที่เห็นในสองที่อาจต่างกัน
- ตัวออกแบบสร้างแถว `erp_report_template` ใหม่ทุกครั้งที่ "บันทึกเป็น" ไม่มีขั้นตอนรวมหรือลบซ้ำ
- งานพิมพ์บาร์โค้ดและป้ายขนส่งเป็นจอแยก ดู [[scr-barcode-print]], [[scr-transport-label-print]]

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:101-131` ตัวห่อเลือกจอ; `:195-259` การลงทะเบียน 6 เมนู
- `frontend/src/config/bcMenu.ts:337-339`, `:365-367`, `:392-397`; `frontend/shared/layout/MenuBar.tsx:819-821`; `frontend/account/tabs/TabWorkspace.tsx:519-548`, `:630` การจำกัดแอดมิน
- `frontend/account/report/FastReportDesignerScreen.tsx:859-1494` สถานะ ตัวอย่าง บันทึก ลบ โหลด; `:2394-3669` แท็บ; `:3676-4062` หน้าต่างโหลด/บันทึกเป็น/พิมพ์
- `frontend/account/report/FormDesignerScreen.tsx:809-1875` สถานะ วางวัตถุ บันทึก; `:1957-2618` ปุ่มและริบบอน; `:4653-5100` หน้าต่างเปิด บันทึกเป็น Query ตัวอย่างก่อนพิมพ์
- `frontend/account/report/formDesignerPresets.ts:7-19`, `:218-227`, `:457-505`, `:510`
- `backend/internal/application/process/report.go:246-403`; `backend/internal/application/process/report_template.go:195-679`
- `backend/internal/adapter/inbound/http/process/permission.go:60-67`
- ดูเพิ่ม: [[fe-report-print-designer]] · [[fe-report-screens]] · [[scr-universal-report]] · [[scr-report-print-modal]] · [[scr-doc-format]] · [[screens-overview]]
