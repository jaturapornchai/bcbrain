---
title: "หน้าต่างพิมพ์รายงานและพิมพ์แบบฟอร์มเอกสาร (GlobalReportPrintModal / GlobalDocFormPrintModal)"
tags: [screens, report, transaction]
aliases: ["GlobalReportPrintModal", "GlobalDocFormPrintModal", "GlobalReportPageSetupBar", "GlobalReportStudioPanel", "พิมพ์รายงาน", "พิมพ์แบบฟอร์มมาตรฐานสรรพากร", "ตัวอย่าง PDF รายงาน", "ล็อกการพิมพ์จริง", "ภ.พ.10 นักท่องเที่ยว"]
sources: ["frontend/account/report/GlobalReportPrintModal.tsx:53-118", "frontend/account/report/GlobalReportPrintModal.tsx:723-1166", "frontend/account/report/GlobalReportPrintModal.tsx:1168-1400", "frontend/account/report/GlobalReportPrintModal.tsx:2271-2494", "frontend/account/report/UniversalReportScreen.tsx:812", "frontend/account/report/FastReportDesignerScreen.tsx:3898-3900", "frontend/lineoa/LineOaChatStudio.tsx:3897", "frontend/src/app/api/ai/chat/route.ts:256", "frontend/shared/components/GlobalDocFormPrintModal.tsx:113-205", "frontend/shared/components/GlobalDocFormPrintModal.tsx:878-925", "frontend/shared/components/GlobalDocFormPrintModal.tsx:2640-2672", "frontend/shared/components/GlobalDocFormPrintModal.tsx:4140-4330", "frontend/shared/components/GlobalDocFormPrintModal.tsx:4740-4830", "frontend/shared/components/GlobalDocFormPrintModal.tsx:4940-5180", "frontend/account/transaction/UniversalTransScreen.tsx:4315-4354"]
---

# หน้าต่างพิมพ์รายงานและพิมพ์แบบฟอร์มเอกสาร

สองหน้าต่างพิมพ์ส่วนกลางที่ทุกจอเรียกใช้ร่วมกัน: **GlobalReportPrintModal** พิมพ์ "รายงาน" (ตารางผลลัพธ์) เป็น PDF ที่ backend เรนเดอร์ และ **GlobalDocFormPrintModal** พิมพ์ "เอกสาร" (ใบกำกับภาษี ใบสั่งซื้อ ใบเสร็จ ฯลฯ) จากหน้าจอทรานแซกชัน ทั้งสองไม่ใช่เมนูของตัวเอง เปิดจากปุ่มพิมพ์ในหน้าจออื่น ตัวออกแบบ layout ฝั่งผู้พัฒนาอยู่ที่ [[fe-report-print-designer]] และจอออกแบบที่ผู้ใช้เปิดจากเมนูอยู่ที่ [[scr-report-designer]]

## 1. พิมพ์รายงาน (GlobalReportPrintModal)

### วิธีเปิด

- ปุ่ม "พิมพ์รายงาน" บนแถบเครื่องมือของ [[scr-universal-report]] (UniversalReportScreen.tsx:1136 เรียก `handlePrintPdf` :812 ที่เปิดโมดัล :2422) และปุ่มพิมพ์ของ [[scr-report-designer]] (FastReportDesignerScreen.tsx:3898-3900) คอมโพเนนต์รับ `basePayload` (เงื่อนไขและคอลัมน์ล่าสุด), `settings`, `templates` (รูปแบบรายงานที่บันทึกไว้) (GlobalReportPrintModal.tsx:2271-2284)

### ตั้งค่าหน้ากระดาษ (GlobalReportPageSetupBar, บรรทัด 723-1166)

ค่าเริ่มต้น (`DEFAULT_REPORT_PRINT_SETTINGS` บรรทัด 82-103): กระดาษ A4, แนวพิมพ์อัตโนมัติ, ตัวอักษร 8.5 pt, พิมพ์สี, ธีม `bc_emerald`, ระยะบรรทัดมาตรฐาน, เส้นตารางแนวนอน, สีสลับแถว เลขลำดับ และหัวบริษัทเปิด, ช่องเซ็นชื่อปิด, ความกว้างคอลัมน์อัตโนมัติเปิด, ป้ายเซ็นชื่อ "ผู้จัดทำรายงาน / ผู้ตรวจสอบ / ผู้อนุมัติ", ภาษารายงานไทย ตัวเลือกบนแถบ:

| ป้าย | ตัวเลือก |
|---|---|
| รูปแบบรายงาน | "★ มาตรฐานระบบ (System Default)" หรือรูปแบบที่บันทึกไว้ |
| ปุ่ม | "คอลัมน์ %", "SQL Query (กำหนดเอง)", "เก็บรูปแบบ (n)", "ค่าเริ่มต้น" (รีเซ็ต) |
| ภาษารายงาน | ไทย / English (แปลหัวข้อ หัวคอลัมน์ และป้ายเซ็นชื่อด้วย `translateThaiToEnglish`) |
| กระดาษ | A4, A3, Letter, Legal, A5, Continuous 9x11 |
| แนวพิมพ์ | อัตโนมัติ / แนวตั้ง / แนวนอน |
| ตัวอักษร | ปุ่ม ก- / ก+ |
| โหมดสี | พิมพ์สี / ขาวดำ (เทา) / ขาวดำประหยัดหมึก; "ธีมสี" 6 ธีม (`PRINT_THEME_OPTIONS`, บรรทัด 106) |
| ระยะบรรทัด | มาตรฐาน / กระชับ ประหยัดกระดาษ / โปร่ง เผื่อเจาะรูเข้าแฟ้ม |
| เส้นตาราง | เส้นแนวนอน BC / ตีตารางครบทุกช่อง / เฉพาะกรอบหัว-ท้าย |
| ช่องติ๊ก | สีสลับแถว, เลขลำดับ, ช่องเซ็นชื่อ, ความกว้างอัตโนมัติ |

ค่าที่ผู้ใช้ตั้งเก็บในเบราว์เซอร์ (localStorage คีย์ `bc_global_report_print_prefs_v2`, บรรทัด 104)

### แผงออกแบบสด (GlobalReportStudioPanel, บรรทัด 1168)

เปิดจากปุ่มคอลัมน์/SQL/รูปแบบของจอรายงาน มี 3 ส่วน:

1. **ปรับขนาดคอลัมน์ % และเปิด/ปิดคอลัมน์** — ตารางลำดับ / เปิดแสดง / ฟิลด์ข้อมูล (Key) / การจัดวาง (ชิดซ้าย กึ่งกลาง ชิดขวา) และยอดรวมต่อคอลัมน์ (ไม่แสดง, SUM, AVG, COUNT, MIN, MAX)
2. **คำสั่ง SQL Query และทดสอบ Query สด (On-The-Fly)** — แก้ SQL ของรายงานแล้วกดทดสอบ มีกล่อง "AI สร้างคำสั่ง SQL รายงานจากภาษาไทย (AI Text-to-SQL Builder)" พร้อมคำสั่งลัดและปุ่มแทรกพารามิเตอร์
3. **เก็บรูปแบบรายงานลง Database และตั้งค่าหัว-ท้ายกระดาษ** — ช่องหัวเรื่อง, หัวเรื่องรอง, หมายเหตุท้ายกระดาษ, "แสดงชื่อบริษัทบนหัวกระดาษ PDF", ชื่อรูปแบบ, "ตั้งเป็นค่าเริ่มต้น (⭐ Default)", ปุ่มลบ และ "บันทึกเป็นรูปแบบใหม่ลง Database" (กลไกบันทึกผ่าน `report/run` templateAction ดู [[fe-report-print-designer]])

### หน้าต่างตัวอย่าง PDF (บรรทัด 2271-2494)

- แสดง PDF ที่ backend สร้างใน iframe ชื่อ "ตัวอย่างรายงาน PDF - …" ระหว่างโหลดมีข้อความ "กำลังเรนเดอร์ไฟล์ PDF ใหม่จาก Backend (ข้อมูลครบถ้วน 100% ไม่ตัดคำ)..." ถ้าผิดพลาดขึ้นแถบแดง ค่าเริ่มต้น "สร้างไฟล์ PDF รายงานไม่สำเร็จ" (บรรทัด 2344, 2477)
- ปุ่ม "สั่งพิมพ์ออกเครื่องพิมพ์" (:2424 สั่งพิมพ์จาก iframe; ถ้าไม่มี iframe เปิดแท็บใหม่ :2379-2387), "ดาวน์โหลด PDF" (:2433, `handleDownloadPdf` :2371-2377), "เปิดแท็บใหม่" (:2444), "ปิดหน้าต่าง" (:2448) สามปุ่มแรกกดไม่ได้ระหว่างโหลดหรือเมื่อยังไม่มี PDF

## 2. พิมพ์เอกสาร (GlobalDocFormPrintModal)

### วิธีเปิด

- จอทรานแซกชันหลัก [[scr-universal-trans]] ผูกไว้ที่ UniversalTransScreen.tsx:4315-4354 ด้วยพร็อพ `isSavedMode` = ไม่ได้แก้ไข ไม่ใช่เอกสารใหม่ และมีเลขที่เอกสาร; ระหว่างแก้ไข ปุ่ม "บันทึกเอกสารเพื่อพิมพ์จริง" เรียก `onSaveBeforePrint` = `handleSave({openPrintImmediately:true})` ปุ่ม "Form Designer" ในกล่องพิมพ์ปิดกล่องแล้วเปิดเมนู `menu_form_edit` (รหัส 1093, UniversalTransScreen.tsx:4353) ดู [[scr-report-designer]] (เลขบรรทัดของ UniversalTransScreen.tsx ในหัวข้อนี้ตามฉบับที่ commit ล่าสุด)
- จอแชต LINE OA ก็เปิดโมดัลนี้ได้ (lineoa/LineOaChatStudio.tsx:3897) ส่วน [[scr-doc-format]] และแดชบอร์ด e-Tax นำ `READY_DOC_FORM_TEMPLATES` และ `calculateThaiTouristVatRefund` ไปใช้ (account/master/DocFormatScreen.tsx:37, etax/EtaxDashboard.tsx:39)
- พร็อพรับข้อมูลเอกสารทั้งชุด: เลขที่/วันที่/เครดิต/คู่ค้า/พนักงานขาย/ยอดก่อนภาษี/VAT/ยอดรวม/รายการสินค้า (GlobalDocFormPrintModal.tsx:878-925)

### สองโหมด: ตัวอย่าง กับ พิมพ์จริง

- หัวจอ: "พิมพ์แบบฟอร์มมาตรฐานสรรพากร และเลือกธีมเอกสาร" (บรรทัด 4948)
- **โหมดพิมพ์จริง** (เอกสารบันทึกแล้วและยืนยันว่ามีใน DB: `isActualSavedMode = isSavedMode && dbRecord?.verified`, บรรทัด 2640) ป้าย "จากข้อมูลที่บันทึกแล้ว (ดึงจากฐานข้อมูล)" และแสดงเลขครั้งพิมพ์ "พิมพ์ครั้งแรก (ครั้งที่ 1)" / "พิมพ์ซ้ำครั้งที่ N" (บรรทัด 4952-4962) ปุ่ม "สั่งพิมพ์ / บันทึก PDF (จากข้อมูลที่บันทึกแล้ว)" (บรรทัด 5138)
- **โหมดตัวอย่าง** (ยังไม่บันทึก): ป้าย "โหมดตัวอย่าง (Preview — ยังไม่ได้บันทึกข้อมูล)" ปุ่มพิมพ์ถูกแทนด้วย "ล็อกการพิมพ์จริง (ป้องกันพิมพ์แล้วไม่ Save)" และปุ่มสีเหลือง "บันทึกเอกสารเพื่อพิมพ์จริง" ที่สั่งบันทึกเอกสารก่อน (บรรทัด 5145-5162, `handleTriggerSaveBeforePrint` 4327)
- เมื่อสั่งพิมพ์จริง `handlePrintVerifiedDoc` เพิ่มจำนวนครั้ง เขียนแถวตรวจสอบ (entity `doc_print_audit` ในตาราง `erp_business_ext`, ค่า `print_count`, `last_printed_at`, `unsaved_attempt_count`) ด้วย `queryExec` แล้วเรียก `window.print()` หลังหน่วง 60 มิลลิวินาที (บรรทัด 4294-4325)

### ปุ่มและตัวเลือกบนหน้าจอ

- ภาษาฟอร์ม: ไทย / อังกฤษ / พิมพ์คู่ 2 ภาษา (บรรทัด 4995-5044); ปุ่ม "🤖 AI Chat สั่งจัดฟอร์ม (ภาษามนุษย์)"; ปุ่ม "แยกชิ้นส่วน และลาก-วาง (On-The-Fly)"; ปุ่ม "Form Designer" (บรรทัด 5100-5112); "บันทึก Layout หน้าจอนี้" (:5125); "ปิด" (บรรทัด 5070-5175)
- กล่อง "ปรับ Layout ทันที (On-The-Fly) & บันทึก" (บรรทัด 5195) มีปุ่ม "รีเซ็ต Layout" (:5205), โหมดสำเนา ต้นฉบับ / สำเนา / "พิมพ์คู่ ต้นฉบับ + สำเนา (2 หน้า)" (บรรทัด 6605), "แสดงตราประทับยาง" (บรรทัด 6655) และปุ่มบันทึก "บันทึกประจำหน้าจอนี้", "บันทึกใช้ทุกหน้าจอ", "บันทึกโปรไฟล์" (บรรทัด 6158-6188), "บันทึก Layout ลง DB" (บรรทัด 7562)
- แม่แบบสำเร็จรูป 18 แบบ (`READY_DOC_FORM_TEMPLATES`, บรรทัด 205): TAX_INV_RECEIPT, TAX_INV_DELIVERY, DELIVERY_INVOICE_ONLY, ABBR_TAX_SLIP_80MM, TOURIST_VAT_REFUND_PP10, QUOTATION, SALES_ORDER_FORM, BILLING_NOTE, OFFICIAL_RECEIPT, RECEIPT_TAX_INVOICE, CREDIT_DEBIT_NOTE, DEBIT_NOTE_SALES, PURCHASE_ORDER, PURCHASE_REQUISITION, GOODS_RECEIPT, PURCHASE_RETURN_CN, PAYMENT_VOUCHER, INVENTORY_SLIP; แต่ละหน้าจอทรานแซกชันถูกล็อกให้เห็นเฉพาะแม่แบบที่เข้ากับตัวเอง (`getLockedTemplatesForTransScreen`, บรรทัด 582)
- ขนาดกระดาษ 7 แบบ: A4, A5, Continuous 9x11, Continuous 9x5.5, Letter, Thermal 80mm, Thermal 58mm (`DOC_PAPER_SIZES`, บรรทัด 690)
- "AI Chat สั่งจัดฟอร์ม" ส่งคำสั่งภาษาไทยพร้อมสถานะ layout ปัจจุบันไป `POST /api/ai/chat` แล้วรับ JSON ค่าปรับ layout กลับมา (บรรทัด 3713-3790) route นี้เรียก DeepSeek API ภายนอก (`frontend/src/app/api/ai/chat/route.ts:256`) ภาพรวมสถานะที่ส่ง (บรรทัด 3716-3743) มีค่าตั้ง layout และเลขที่เอกสาร ไม่มีรายการสินค้าหรือยอดเงิน แต่แนบข้อความแชตล่าสุดสูงสุด 6 ข้อความไปด้วย (บรรทัด 3745-3752)

### การบันทึก layout (ที่ไหนก็บันทึกลง DB ตรงจากเบราว์เซอร์)

"บันทึก Layout หน้าจอนี้" เขียนค่าลง `erp_business_ext` entity `doc_form_layout` คีย์ = menuKey (และ `__GLOBAL__` สำหรับ "ใช้ทุกหน้าจอ") แล้ว `UPDATE erp_doc_format SET form_code = <แม่แบบ> WHERE upper(code) = upper(<รหัสรูปแบบเอกสาร>)` (บรรทัด 4140-4175) "บันทึกโปรไฟล์" เขียนอีก entity `doc_form_layout_preset` (บรรทัด 4225) ฝั่งเบราว์เซอร์ยังเก็บค่าใน localStorage คีย์ `bc_doc_form_prefs_v2` และ `bc_doc_form_named_presets_v1` (บรรทัด 1211-1212) ตารางหลัก [[tbl-erp-doc-format]]

### แบบฟอร์มนักท่องเที่ยวขอคืน VAT (ภ.พ.10)

เมื่อเลือกแม่แบบ TOURIST_VAT_REFUND_PP10 (หรือเปิดโหมดนักท่องเที่ยว) หน้าจอกรอกชื่อ/พาสปอร์ต/สัญชาติ ติ๊กสินค้า Luxury ≥ 40,000 บาท/ชิ้น และของพกพา ≥ 100,000 บาท แล้วคำนวณเงินคืนด้วย `calculateThaiTouristVatRefund` (บรรทัด 113-203) กดบันทึกจะ UPSERT `erp_business_ext` entity `tourist_vrt_pp10` และเรียก `POST /api/etax/document` (บรรทัด 4744-4830)

## ข้อควรระวัง

- **PDF รายงานถูกขอใหม่จาก backend ทุกครั้งที่ตั้งค่าเปลี่ยน** — `renderPdfFromBackend` มี deps `[basePayload, open, settings]` และถูกเรียกจาก `useEffect` (บรรทัด 2292, 2350-2359) ไม่มี debounce การกด ก-/ก+ หรือพิมพ์ชื่อหัวเรื่องทีละตัวอักษรจึงสั่งสร้าง PDF ถี่
- **ตารางเงินคืน VAT นักท่องเที่ยวเขียนค่าคงที่ในโค้ด และใช้เลข JS Number** (ขั้นต่ำ 2,000 บาท; ต่ำกว่า 5,000 = 80 + ขั้น×25; ต่ำกว่า 30,000 = 230 + ขั้น×27.5; ต่ำกว่า 100,000 = 1,605 + ขั้น×58; ตั้งแต่ 100,000 = 5,665 + ขั้น×60; ตั้งแต่ 200,000 = 6.1% ของยอด) (บรรทัด 113-203) **ยังไม่ได้ตรวจกับแหล่งทางการของกรมสรรพากร** (กฎหมายไทยต้องค้น primary source ก่อนใช้จริง) และขัดกับหลัก [[fe-numeric-money]] ที่ห้ามใช้ float กับเงิน ส่วนต่างระหว่าง VAT กับเงินคืนถูกแสดงเป็น `handlingFee` (บรรทัด 164) และกรณีต่ำกว่า 200,000 ใช้ `Math.min(vat, เงินคืน)` ครอบ (บรรทัด 161) ส่วนกรณี 6.1% ไม่ผ่านการครอบนี้ (บรรทัด 147-149)
- **ส่งข้อมูลเข้า e-Tax แบบเงียบ**: `fetch("/api/etax/document", …).catch(() => {})` (บรรทัด 4797-4816) ถ้าบริการ e-Tax ล้มเหลว หน้าจอยังขึ้นข้อความ "บันทึกข้อมูลคำร้อง ภ.พ.10 … & ส่งเข้าระบบ e-Tax" และ body ใส่ `action_type: "SCAN_OCR"`, `generate_sample_photo: true` (ภาพตัวอย่าง 2 รูป), `branch_code: "00000"` ตายตัว และ `base_amount` สำรอง 2,500 ถ้าคำนวณฐานไม่ได้ — ควรตรวจกับเจ้าของฟีเจอร์ว่าเป็นค่าสาธิตหรือค่าจริง
- เลขพาสปอร์ตของนักท่องเที่ยวถูกเก็บใน `erp_business_ext` และส่งเป็น `party_tax_id` ของเอกสาร e-Tax (บรรทัด 4788, 4807)
- การพิมพ์จริงเพิ่มตัวนับครั้งพิมพ์และเขียนแถวตรวจสอบ **ก่อน** เรียก `window.print()` ถ้าผู้ใช้กดยกเลิกในกล่องพิมพ์ของเบราว์เซอร์ ตัวนับก็เพิ่มไปแล้ว (บรรทัด 4294-4325)
- ทั้งโมดัลเอกสารเขียนฐานข้อมูลด้วย SQL ตรงจากเบราว์เซอร์ (`queryList`/`queryExec`, บรรทัด 2014-2661, 4143-4315, 4786) ตามแนวทางที่อธิบายใน [[fe-query-client-sql-builder]]
- แบบที่ออกแบบและบันทึกจาก [[scr-report-designer]] ไม่ถูกโหลดมาใช้ในกล่องนี้ (ไม่มีการอ่าน `erp_report_template` หรือ `formdesign` ในไฟล์) กล่องนี้ใช้แม่แบบสำเร็จรูปในโค้ด (`READY_DOC_FORM_TEMPLATES`) กับ layout ใน `erp_business_ext` เท่านั้น สิ่งที่ยืมมาจากตัวออกแบบมีเพียงฟังก์ชันคำอ่านจำนวนเงินบาท (นำเข้า :47-49, ใช้ :4513-4516)

## ที่มาในโค้ด

- รายงาน: การตั้งค่า/ค่าเริ่มต้น/ธีม `frontend/account/report/GlobalReportPrintModal.tsx:53-110`; แถบตั้งค่าหน้ากระดาษ `:723-1166`; แผงออกแบบสด `:1168-1400`; หน้าต่าง PDF `:2271-2494`
- เอกสาร: การคำนวณนักท่องเที่ยว `frontend/shared/components/GlobalDocFormPrintModal.tsx:113-203`; แม่แบบ/กระดาษ `:205, 582, 690`; พร็อพ `:878-925`; ตรวจสอบการพิมพ์ `:2640-2672, 4294-4327`; บันทึก layout `:4140-4260`; AI Chat `:3713-3790`; หัวจอและปุ่ม `:4940-5180`; ฟอร์ม ภ.พ.10 `:4740-4830`
- จุดเรียกใช้: `frontend/account/transaction/UniversalTransScreen.tsx:4315-4354` (ตามฉบับ commit ล่าสุด), `frontend/account/report/UniversalReportScreen.tsx:812`, `:1136`, `:2422`, `frontend/account/report/FastReportDesignerScreen.tsx:3898-3900`, `frontend/lineoa/LineOaChatStudio.tsx:3897`
- route ภายนอก: `frontend/src/app/api/ai/chat/route.ts`, `frontend/src/app/api/etax/document/route.ts`
- ดูเพิ่ม [[scr-report-designer]] · [[fe-report-print-designer]] · [[fe-report-screens]] · [[screens-overview]]
