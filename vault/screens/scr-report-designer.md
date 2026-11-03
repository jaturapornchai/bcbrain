---
title: "ตัวออกแบบรายงานและแบบฟอร์ม (FastReportDesignerScreen / FormDesignerScreen)"
tags: [screens, report, admin]
aliases: ["FastReportDesignerScreen", "FormDesignerScreen", "ออกแบบรายงาน", "สร้าง/แก้ไขแบบฟอร์ม", "ออกแบบงบการเงิน", "นำเข้ารายงาน", "นำเข้าแบบฟอร์ม", "นำเข้ารายงานสาขา", "createReportDesignerScreen", "fast_report_designer", "menu_form_edit"]
sources: ["frontend/account/tabs/screenRegistry.tsx:101-127", "frontend/account/tabs/screenRegistry.tsx:190-262", "frontend/account/report/FastReportDesignerScreen.tsx:881-948", "frontend/account/report/FastReportDesignerScreen.tsx:1189-1215", "frontend/account/report/FastReportDesignerScreen.tsx:1280-1381", "frontend/account/report/FastReportDesignerScreen.tsx:1690-1935", "frontend/account/report/FastReportDesignerScreen.tsx:2396-2406", "frontend/account/report/FastReportDesignerScreen.tsx:3678-3880", "frontend/account/report/FastReportDesignerScreen.tsx:3885-4064", "frontend/account/report/FormDesignerScreen.tsx:809-860", "frontend/account/report/FormDesignerScreen.tsx:1737-1875", "frontend/account/report/FormDesignerScreen.tsx:1957-2260", "frontend/account/report/FormDesignerScreen.tsx:4406-5260", "backend/internal/application/process/report_template.go:395-425"]
---

# ตัวออกแบบรายงานและแบบฟอร์ม

เมนูสร้างรายงานเองและสร้างแบบฟอร์มกระดาษเอง ทั้ง 6 เมนูลงทะเบียนด้วยฟังก์ชัน `createReportDesignerScreen` ตัวเดียว (screenRegistry.tsx:101-127, รายการ 190-262) แล้วแตกเป็น 2 จอจริง: **FastReportDesignerScreen** (รายงาน/งบการเงิน) และ **FormDesignerScreen** (แบบฟอร์มกระดาษ) กลไก JSON schema (`bc.report.json.v1`, `bc.formdesign.json.v1`) และวิธีบันทึกผ่าน `report/run` templateAction อธิบายไว้ใน [[fe-report-print-designer]] เอกสารนี้เน้นสิ่งที่ผู้ใช้เห็นและกดได้

## วิธีเปิด

| รหัสเมนู | menuKey | ชื่อบนเมนู | จอที่เปิด |
|---|---|---|---|
| 1094 | `fast_report_designer` | ออกแบบรายงาน | FastReportDesignerScreen (แท็บเริ่มต้น `query1`) |
| 1092 | `menu_gl_report_design` | ออกแบบงบการเงิน | FastReportDesignerScreen (แท็บเริ่มต้น `account`) |
| 1093 | `menu_form_edit` | สร้าง/แก้ไขแบบฟอร์ม | FormDesignerScreen |
| 1113 | `menu_import_formdesign` | นำเข้าแบบฟอร์ม | FormDesignerScreen เปิดหน้าต่างเลือกฟอร์มทันที (`initialImportMode`) |
| 1114 | `menu_import_report` | นำเข้ารายงาน | FastReportDesignerScreen เปิดหน้าต่างโหลดรายงานทันที |
| 1115 | `menu_import_report_branch` | นำเข้ารายงานสาขา | เหมือน 1114 ทุกอย่าง ต่างแค่หัวหน้าต่าง "นำเข้ารายงานตามสาขา (JSON Report Repository)" |

อ้างอิง: รหัส 4 หลักจาก `bcMenu.json`; registry ใช้รหัสเก่าแบบมีจุด ("1.13", "1.12", "1.9.7", "1.10.20/22/23") เป็น `code` (ดู [[fe-screen-registry-menu]], [[screens-overview]]) ที่มาแท็บเริ่มต้นและโมดัลเริ่มต้น: FastReportDesignerScreen.tsx:903-908, 945-947; FormDesignerScreen.tsx:852; ความต่างของ 1115 เฉพาะที่ FastReportDesignerScreen.tsx:3684-3690 (`branchMode` ใช้ตรงนี้ที่เดียว)

## 1. จอออกแบบรายงาน (FastReportDesignerScreen)

### แถบหัวและสถานะ

- ข้อความสถานะเริ่มต้น "พร้อมทำงาน (มาตรฐาน JSON-First เลิกใช้ XML 100%)" (บรรทัด 897-899)
- แถวปุ่มหลัก: ขณะดู = "แก้ไข" / "เพิ่มใหม่" / "ลบ" / "ปิดหน้าจอ"; ขณะแก้ = "บันทึก" / "ปิดหน้าจอ" (บรรทัด 1690-1790)
- สิทธิ์: ใช้ `useScreenRights()` ปุ่มแก้ไข/เพิ่มใหม่/ลบ/บันทึกถูกปิดตามสิทธิ์ `canEdit/canAdd/canDelete/readOnly` (บรรทัด 890, 1701-1751) ถ้ากดบันทึกโดยไม่มีสิทธิ์ ขึ้นข้อความ `ไม่มีสิทธิ์ "เพิ่ม/แก้ไขข้อมูล" ในหน้าจอนี้` และลบได้เฉพาะเมื่อมีสิทธิ์ลบ (บรรทัด 1287, 1355) ดูสิทธิ์รวมที่ [[scr-admin-permissions]]

### แถบเครื่องมือ ToolStrip (ตามต้นฉบับ BCFastReport._designer)

ปุ่ม: Preview, Query, ช่องเลือก "ประเภท :" (รายงานทั่วไป 0, สินค้าคงคลัง 1, ซื้อ 2, ขาย 3, เจ้าหนี้ 4, ลูกหนี้ 5, เงินสดและธนาคาร 6, สินทรัพย์ 7, บัญชี 8 — บรรทัด 172-180), Load, Save, Save As, Delete, "บันทึก JSON" (ส่งออกไฟล์ .json), "Load JSON" (นำเข้าไฟล์ .json), Search Name (สลับแผงค้นหา Resource), "พิมพ์ PDF" (เปิด [[scr-report-print-modal]]) และป้าย "Owner: <รหัสเจ้าของ>" (บรรทัด 1800-1930)

### แท็บฝั่งขวา (บรรทัด 2396-2406)

- **Condition** — ตารางเงื่อนไขรายงาน ชนิดช่อง Text / Number / Date / DropDown ฯลฯ ปุ่ม "เพิ่มเงื่อนไข" และ "Condition Preview" ลองกรอกค่าดูหน้าตาจอเงื่อนไขจริง
- **Query 1 ถึง Query 7** — "Table Name :", Command (SQL), ปุ่ม "Get Field" ดึงรายชื่อฟิลด์จาก SQL (ถ้า SQL ว่างใช้ `SELECT * FROM <ตาราง> LIMIT 1`, ตารางเริ่มต้น `ic_trans`; รันผ่าน backend `runBackendReport`, บรรทัด 1189-1215), "Add Field", "Clear All" และตารางฟิลด์ Field Name / Column Name / Width / Align / Format / Total / Hide พร้อม Move Up / Move Down, Font, Color, Break Line, AutoNumber
- **Account (งบการเงิน)** — "เพิ่มบรรทัดงบการเงิน" ชนิดบรรทัด HEADER (หัวข้อ) / ACCOUNT (ผังบัญชี) / FORMULA (สูตรรวม) / LINE (เส้นคั่น) ชื่อไทย/English ตัวหนา เส้นใต้ (ไม่ขีดเส้น/เส้นเดี่ยว/เส้นคู่) ย่อหน้า และปุ่ม "ประมวลผลงบการเงิน" ประเภทงบเลือกได้ งบทดลอง / งบกำไรขาดทุน / งบแสดงฐานะการเงิน / งบกระแสเงินสด (บรรทัด 2173, 3234-3277)
- **Report Options** — กระดาษ A4 มาตรฐาน / A3 กว้างพิเศษ / A5 ครึ่งหน้า / Letter / Legal / กระดาษต่อเนื่อง, แนวตั้ง-แนวนอน, ขนาดตัวอักษร 6.5 ถึง 13 pt (ค่าเริ่ม 8.5, บรรทัด 1194-1198)
- **JSON Schema** — ดูและแก้ JSON ตรง ๆ

แผงซ้าย "Search Resource และตาราง DB" ค้นด้วย "ค้นหา Code, ชื่อไทย, ตาราง..." จากรายชื่อตารางจริง (`information_schema.columns` จำกัด 400 แถว, บรรทัด 1155-1175) และแผงขวา/ล่าง "Preview (ตัวอย่างกระดาษรายงานสด)" มีปุ่มรีเฟรช

### หน้าต่างโหลด / นำเข้า (บรรทัด 3678-3880)

หัวหน้าต่าง "เลือกรายงานที่ต้องการโหลด" (หรือ "นำเข้ารายงานมาตรฐาน (JSON Report Repository)" ในโหมดนำเข้า) มีตัวกรอง "หมวดรายงาน" (-- ทุกประเภทรายงาน --), ช่องค้นหา "ค้นหารหัสรายงาน หรือ ชื่อรายงาน...", ตาราง เลือก / รหัสรายงาน (menuid) / ชื่อรายงาน (menuname) / ประเภทรายงาน / การดำเนินการ แถวสำเร็จรูปในโค้ดมี 3 รายงาน (FAST-IC-001 ยอดคงเหลือและต้นทุนสินค้า, FAST-SO-001 วิเคราะห์ยอดขายและภาษีขาย, FAST-GL-001 สมุดรายวันและผังบัญชี) ปุ่ม "เปิดใช้งาน" และแถวจากฐานข้อมูลปุ่ม "โหลดจาก DB" รวมถึง "นำเข้าจากไฟล์ .json ในเครื่อง" ปุ่ม "นำเข้ารายงานที่เลือก" (โหมดนำเข้าเท่านั้น) **ทำเพียงปิดหน้าต่างและขึ้นข้อความ "นำเข้ารายงานมาตรฐาน (JSON) เข้าสู่ระบบเรียบร้อย" — การโหลดจริงเกิดตอนกด "เปิดใช้งาน/โหลดจาก DB" แล้ว** (บรรทัด 3855-3872, 1436-1492)

### หน้าต่าง Save As และการตรวจสอบ (บรรทัด 3885-4064)

หัว "บันทึกรายงาน (Save Report — JSON Database)" ช่อง "รหัสเมนูรายงาน (Menu Id) *", "ชื่อรายงาน (Menu Name) *", "ประเภทรายงาน (Report Type)", "รหัสเจ้าของรายงาน (Owner Code)" ถ้า Menu Id หรือ Menu Name ว่างขึ้น "กรุณากรอกข้อมูล Menu Id และ Menu Name ให้ครบถ้วน" (บรรทัด 4051) ปุ่ม "ยกเลิก (Cancel)" / "บันทึก (Save)"

### ลบ

ถ้าไม่ได้เปิดรายงานที่บันทึกไว้ (ไม่มี template ที่ active) กด "ลบ" จะแค่รีเซ็ตเป็นค่าเริ่มต้น "รีเซ็ตรายงานกลับเป็นค่าเริ่มต้นแล้ว" โดยไม่แตะฐานข้อมูล (บรรทัด 1355-1365)

## 2. จอออกแบบแบบฟอร์ม (FormDesignerScreen)

### โครงจอ

- ใช้ JSON ฟอร์มหลายหน้า (ต้นฉบับ/สำเนา) วางวัตถุบนกระดาษด้วยเครื่องมือ Pointer, Label, TextField, SpecialLabel, Table, Line, Rectangle, RoundedRectangle, Ellipse, Picture, ImageField, Barcode (รายการเครื่องมือใน [[fe-report-print-designer]])
- ชนิดฟอร์ม 4 แบบ: 0 ฟอร์มทั้งหมด, 1 ฟอร์มพิมพ์เอกสาร, 2 ฟอร์มบาร์โค้ดสินค้า, 3 ฟอร์มป้ายชื่อขนส่ง (`BC_FORM_TYPES`, formDesignerPresets.ts:218)
- ปุ่มหลัก ขณะดู: "แก้ไข" / "เพิ่มใหม่" / "ลบ" / "ปิดหน้าจอ" ขณะแก้: "บันทึก" / "ปิดหน้าจอ" ต้องกด "แก้ไข" ก่อนจึงวางวัตถุบนกระดาษได้ (ข้อความ "กรุณากดปุ่ม [แก้ไข] ก่อนวาง…" บรรทัด 1141) การตรวจสิทธิ์ใช้ `useScreenRights()` เช่นเดียวกัน (บรรทัด 817, 1743, 1990)
- แถบไอคอน (เลื่อนเมาส์จะมีคำอธิบาย, บรรทัด 2043-2123): สร้างใหม่ (New Form), "เปิดแบบฟอร์ม / ฟอร์มมาตรฐาน (n)", "บันทึกเป็นรหัสใหม่ (Save As)", "ตั้งค่ารูปพื้นหลังแบบฟอร์ม (Background Form)", "อัปโหลดรูปฟอร์มมาทาบ" (PNG/JPG/WebP), "AI อ่านฟอร์มวางตำแหน่งอัตโนมัติ (Clean & Rebuild)", "คำสั่งดึงข้อมูล SQL (Query 0..n)", "ทดสอบพิมพ์ฟอร์ม / ดูตัวอย่างจริง (Print Preview)", "ส่งออกไฟล์แบบฟอร์ม (Save JSON)"
- แถบจัดตัวอักษร: แบบอักษร Tahoma / Sarabun / Cordia New / Angsana New / Courier New, ขนาด, ตัวหนา/เอียง/ขีดเส้นใต้; ซูมกระดาษ "85% = พอดีหน้าจอ"; สลับหน้ากระดาษ ต้นฉบับ/สำเนา; ล้างวัตถุทั้งหมดบนหน้า; ล็อก/ปลดล็อกตำแหน่ง; ทำซ้ำวัตถุ; จัดชิดซ้าย/กึ่งกลาง/ชิดขวา/เต็มความกว้าง (บรรทัด 2200-3520)
- คีย์ลัดมีเพียง **Ctrl+S** (บันทึกเมื่ออยู่ในโหมดแก้ไขและแท็บนี้กำลังแสดง) ไม่มี Delete/ลูกศร แม้คอมเมนต์ในโค้ดเขียนว่า "F12" (บรรทัด 1862-1875)

### หน้าต่างย่อย

- **สร้างแบบฟอร์มใหม่ (New Form Design)** (บรรทัด 5160-5260): รหัส (Form Code) *, ชื่อ (Form Name) *, ประเภทฟอร์ม, ขนาดกระดาษ, แนวกระดาษ แล้วเลือกวิธีเริ่ม 3 แบบ — 1) กระดาษเปล่า 100% 2) กระดาษเปล่า + เลือกรูปสแกนฟอร์มจากเครื่อง 3) เริ่มจากโครงสร้างมาตรฐาน (หัวเอกสาร ตารางสินค้า ท้ายบิลวางไว้ให้) มีคำเตือนว่าการสร้างใหม่จะล้างวัตถุบนกระดาษปัจจุบัน
- **เปิดแบบฟอร์มมาตรฐาน และแบบฟอร์มในฐานข้อมูล** (บรรทัด 4626-4760): ส่วน 1 ฟอร์มมาตรฐานพร้อมรูปพื้นหลัง 3 แบบ (TAX-INV-A4 ใบกำกับภาษี/ใบส่งของ/ใบแจ้งหนี้, CHEQUE-TH ฟอร์มพิมพ์เช็คธนาคารมาตรฐานไทย, WHT-50TAWI) ปุ่ม "โหลดแบบฟอร์มนี้" ส่วน 2 ฟอร์มที่บันทึกในฐานข้อมูล (formDesignerPresets.ts:510, 800, 1029)
- **Background Form** (4406), **Save As** (4768), **Query SQL** (4856), **ตัวอย่างก่อนพิมพ์แบบฟอร์มจริง (Form Print Preview)** (4924) — แสดงข้อมูลตัวอย่างจากเอกสารจริงใน `ic_trans`/`ic_trans_detail`/`erp_company_profile` (ดึงด้วย `queryList` บรรทัด 986-1020)
- **"AI อ่านฟอร์ม"**: ทำ 3 ขั้น (ล้างวัตถุเดิม, สแกนเส้นตารางและกรอบข้อมูล, วางฟิลด์ใหม่) ด้วยฟังก์ชัน `analyzeBackgroundFormAndBuildObjects` ซึ่งวิเคราะห์ภาพด้วย `canvas` ในเบราว์เซอร์ ค้นทั้งฟังก์ชัน (formDesignerPresets.ts:2150-3320) ไม่พบการเรียก `fetch`/`/api` จึงไม่ส่งรูปออกนอกเครื่อง แม้ปุ่มจะชื่อ "AI" (FormDesignerScreen.tsx:1398-1520)

### บันทึก

`handleSaveFormToDatabase` (บรรทัด 1737-1810): รหัสแบบฟอร์มแปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่าง บันทึกผ่าน `report/run` ด้วย `menuKey: "menu_form_edit"`, `templateAction: "save"` ข้อความสำเร็จบอกว่า `บันทึกแบบฟอร์ม "<รหัส> - <ชื่อ>" (JSON) ลงตาราง form…` ฝั่ง backend เขียนแถวลงตาราง `formdesign` (ลบแถวเดิมที่รหัสเดียวกันแล้ว INSERT ใหม่) โดย **ตัดรหัสแบบฟอร์มเหลือ 25 ตัวอักษร** (report_template.go:401-425)

## ข้อควรระวัง

- **ฟอร์มที่ออกแบบแล้วไม่ถูกนำไปใช้พิมพ์เอกสารในโค้ดที่ค้น**: ตาราง `formdesign` ถูกเขียน/ลบโดย `report_template.go` และอ่านโดยจอออกแบบเท่านั้น ส่วนหน้าต่างพิมพ์เอกสารจริง ([[scr-report-print-modal]]) ใช้แม่แบบ 18 แบบในโค้ด (`READY_DOC_FORM_TEMPLATES`) กับค่า `erp_doc_format.form_code` ([[scr-doc-format]]) ค้น `formdesign` ใน `frontend/account`, `frontend/shared`, `frontend/src`, `backend` ไม่พบตัวพิมพ์ที่อ่านตารางนี้ ผู้ใช้ที่ออกแบบฟอร์มจึงอาจคาดหวังว่าจะเห็นผลตอนพิมพ์ใบกำกับภาษี แต่ในโค้ดที่ตรวจไม่มีทางเชื่อมนั้น (ควรยืนยันกับเจ้าของระบบว่ายังอยู่ระหว่างพัฒนาหรือมีตัวพิมพ์ภายนอกอ่านตารางนี้)
- รหัสแบบฟอร์มยาวเกิน 25 ตัวอักษรจะถูกตัดตอนบันทึก (ฝั่ง backend) ทำให้รหัสที่เห็นหลังเปิดซ้ำต่างจากที่พิมพ์
- เมนู 1115 "นำเข้ารายงานสาขา" ไม่มีตรรกะเฉพาะสาขา เปลี่ยนแค่ข้อความหัวหน้าต่าง ผู้ใช้ที่หวังให้กรองตามสาขาจะไม่พบ
- **ปุ่ม "ปิดหน้าจอ" ในโหมดแก้ไขไม่ได้ปิดจอ**: ในจอฟอร์มแค่ออกจากโหมดแก้ไข ขึ้น "ออกจากโหมดแก้ไขแบบฟอร์ม" และรีเซ็ตตัวนับการแก้ไขเป็น 0 โดยไม่ถามและไม่ย้อนค่า ส่วนจอรายงานถ้ามีการแก้ไขค้างจะออกจากโหมดแก้ไข (ถ้าไม่มีจึงปิดจอ) (FormDesignerScreen.tsx:2023-2030, FastReportDesignerScreen.tsx:1760-1771) งานที่ยังไม่บันทึกยังค้างในหน้าจอแต่ถูกนับเป็นไม่มีการแก้ไข
- ปุ่ม "นำเข้ารายงานที่เลือก" ไม่ได้นำเข้าเพิ่ม (ดูหัวข้อหน้าต่างโหลด) การเลือกจริงเกิดที่ปุ่มของแต่ละแถว
- ชนิดฟอร์ม 2 (บาร์โค้ด) และ 3 (ป้ายขนส่ง) ถูกกำหนดในรายการประเภท แต่จอพิมพ์บาร์โค้ด/ป้ายขนส่งที่ตรวจ ([[scr-barcode-print]], [[scr-transport-label-print]]) ไม่ได้ระบุว่าอ่านแบบฟอร์มจากจอนี้
- ตัวอย่างภาพพื้นหลัง/โลโก้ที่อัปโหลดจัดเก็บภายในไฟล์ JSON ของแบบฟอร์ม ไฟล์ใหญ่ได้ถ้าใช้ภาพความละเอียดสูง (ไม่ได้ตรวจขนาดจำกัดในส่วนที่อ่าน)

## ที่มาในโค้ด

- ลงทะเบียน 6 เมนู: `frontend/account/tabs/screenRegistry.tsx:101-127, 190-262`
- จอรายงาน: `frontend/account/report/FastReportDesignerScreen.tsx` (props `:864-890`, สิทธิ์ `:890, 1287, 1355`, Get Field `:1189`, บันทึก `:1280-1351`, ลบ `:1352-1381`, ToolStrip `:1800-1930`, แท็บ `:2396-2406`, หน้าต่างโหลด `:3678-3880`, Save As `:3885-4064`, preset ในโค้ด `:578`)
- จอฟอร์ม: `frontend/account/report/FormDesignerScreen.tsx` (props `:809-817`, AI สแกน `:1398-1520`, บันทึก `:1737-1810`, ส่งออก/นำเข้า `:1814-1870`, Ctrl+S `:1863-1875`, ปุ่ม `:1957-2260`, หน้าต่างย่อย `:4406-5260`)
- ชนิดฟอร์ม/ฟอร์มมาตรฐาน/สแกนภาพ: `frontend/account/report/formDesignerPresets.ts:218, 510, 2150`
- บันทึกฝั่ง backend: `backend/internal/application/process/report_template.go:395-425`
- กลไก JSON และบันทึกผ่าน `report/run`: [[fe-report-print-designer]]
