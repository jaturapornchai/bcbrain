---
title: "การจัดกลุ่มหลายระดับและการพิมพ์ PDF รายงาน (Report hierarchy & PDF)"
tags: [process, report, hierarchy, pdf, thai-font, big-rat]
aliases: ["report/pdf", "RenderReportPDF", "GroupNodes", "HierarchyLevels", "running balance", "ยอดคงเหลือสะสม", "gopdf", "พิมพ์รายงาน"]
sources: ["backend/internal/application/process/report_hierarchy.go:51", "backend/internal/application/process/report_hierarchy.go:97", "backend/internal/application/process/report_hierarchy.go:625", "backend/internal/application/process/report_pdf.go:23", "backend/internal/application/process/report_pdf.go:35", "backend/internal/application/process/report_pdf.go:76", "backend/internal/application/process/report_pdf.go:111", "backend/internal/application/process/report_pdf.go:318", "backend/internal/application/process/report_pdf.go:525", "backend/internal/adapter/inbound/http/process/handler.go:270"]
---

# การจัดกลุ่มหลายระดับและการพิมพ์ PDF รายงาน (Report hierarchy & PDF)

หลัง `RunReport` ได้แถวและยอดรวมแล้ว มี 2 งานต่อท้าย: (1) สร้างต้นไม้กลุ่มหลายระดับพร้อมยอดย่อยแบบ `*big.Rat` (2) เมื่อเรียก `/report/pdf` เรนเดอร์ผลเดียวกันเป็น PDF ภาษาไทยด้วย `gopdf` ฟอนต์ที่ฝังในโค้ด

## ทำงานอย่างไร

### การจัดกลุ่มหลายระดับ (`buildReportMultiLevelHierarchy`)
- ผลลัพธ์ใส่ใน `res.HierarchyLevels` (`[]ReportHierarchyLevel`: `level`, `keyColumn`, `labelColumn`, `extraColumns`, `titlePrefix`) และ `res.GroupNodes` (`[]ReportGroupNode`: `groupKey`, `groupLabel`, `openingValue` จากแถว "ยอดยกมา", `rowCount`, `rowIndices`, `subtotals`, `children`)
- ระดับมาจาก 2 ทาง: ตรวจโครงสร้างอัตโนมัติ (`inferReportHierarchyLevels` เช่น เคลื่อนไหวสินค้า/บัตรสินค้า/ยอดคงเหลือตามคลัง/เคลื่อนไหวเจ้าหนี้-ลูกหนี้/สมุดรายวัน) หรือผู้ใช้เลือก `groupByColumn` + `subGroupByColumn` (1-2 ระดับ) กับรายงานใดก็ได้รวมถึง Custom SQL
- ถ้าผู้ใช้เลือกกลุ่มเอง `ensureRowsContiguousForLevels` จัดแถวให้ติดกันตามคีย์ โดยคงลำดับเวลาภายในกลุ่ม
- ยอดย่อยของกลุ่ม (`computeGroupNodeSubtotals`) คำนวณด้วย `*big.Rat`

### รายงานแบบยอดสะสม (running balance)
- `isRunningBalanceReport` ถือว่าเป็นรายงานยอดสะสมเมื่อ `ReportTypeCode` มี `STK_MOVE`/`STK_CARD` หรือเท่ากับ `IC_REPORT_PRODUCT_MATERIAL`, `IC_REPORT_TRANSFER_STANDARD`, `AP_MOVEMENT`, `AR_MOVEMENT` หรือมีชุดคอลัมน์ (`จำนวนเพิ่ม`/`จำนวนลด`/`ยอดคงเหลือ`, `ยอดเพิ่มหนี้`/`ยอดลดหนี้`/`ยอดคงค้าง`, `เดบิต`/`เครดิต`/`ยอดคงเหลือ`)
- กฎ: คอลัมน์เคลื่อนไหว (เพิ่ม/ลด) รวมทุกบรรทัดของกลุ่ม; คอลัมน์ยอดคงเหลือ/ยอดคงค้าง/มูลค่า/ต้นทุนเฉลี่ย ใช้ค่าแถวสุดท้ายของกลุ่ม และ **ยอดรวมทั้งรายงาน = ผลรวมของยอดปลายงวดของแต่ละกลุ่มระดับ 1** (ไม่รวมยอดสะสมทุกบรรทัดซ้ำซ้อน) ผ่าน `applyRunningBalanceGrandTotals` ซึ่งแก้ `res.Totals`

### การพิมพ์ PDF (`RenderReportPDF`)
1. ทางเข้า `POST /process/report/pdf` (สิทธิ์เหมือน `report/run`) -> `Handler.RenderReportPDF` ตั้ง provider/database/username จาก claims
2. `RenderReportPDF` เรียก `RunReport` ด้วยเงื่อนไขชุดเดียวกับหน้าจอ แล้วโหลดหัวบริษัทจาก `erp_company_profile` (`company_name_1/2`, `address_1/2`, `tax_number`; timeout 3 วินาที; ถ้าไม่มีข้อมูลใช้ชื่อเริ่มต้นของระบบ)
3. ถ้า `reportLang = en` โหลดตารางแปลชื่อไทย->อังกฤษ (`loadBilingualDataMap`, สูงสุด 10,000 คู่ จาก `ic_inventory`, `ic_unit`, `ar_customer`, `ap_supplier`, `gl_chart_of_account`) แล้วแทนค่าข้อความในเซลล์ที่ตรงกันพอดี
4. `buildReportPDFBytes` ใช้ตัวเลือกจาก `RunReportInput`: `paperSize` (A4 ค่าเริ่มต้น, A3, Letter, Legal, A5, Continuous/9X11), `orientation` (`auto` = แนวนอนเมื่อคอลัมน์เกิน 7), `fontSizePt` (ค่าเริ่มต้น 8.5 และหนีบ 6.5-13.0), `density` (`compact`/`comfortable`/ปกติ), `printTheme`, `colorMode` (`monochrome`/`grayscale`/สี), `showZebra`, `showRowNumber`, `showCompanyHeader`, `showSignatureBlock` (บล็อกลายเซ็น 3 ช่อง ความสูง 62), `signatureLabels`, `footerNote`
5. ชื่อไฟล์: `<menuKey>_<yyyymmdd_hhmm>.pdf` (ใช้ `bc_report` ถ้าไม่มี menuKey)
6. ฟอนต์ไทย 2 ไฟล์ฝังด้วย `//go:embed` จากโฟลเดอร์ `fonts/`: `thai-regular.ttf`, `thai-bold.ttf`
7. การตัดบรรทัดไทย: แบ่งตาม grapheme cluster และโทเค็นคำ (`splitIntoGraphemeClusters`, `segmentThaiTokens`, `wrapTextToLines`), ปรับสระ/วรรณยุกต์บน (`normalizeThaiUpstairsMarks`), คำนวณความกว้างคอลัมน์ให้ตัวเลขไม่ถูกตัด (`fitPDFNumbers`, `widenPDFNumericColumns`) และนับเลขหน้าแบบ "X/Y" โดยทำ 2 รอบ (`pdfPageBreakBefore` ใช้ทั้งสองรอบ)
8. `pageBreakColumn` (ตั้งโดยตัวสร้างรายงาน) ทำให้ขึ้นหน้าใหม่เมื่อค่าคอลัมน์เปลี่ยน (C# `new_page_by_ar_code`)

## จุดที่ต้องระวัง
- ข้อความหัวบริษัทเริ่มต้นใน `loadCompanyHeaderInfo` เป็นค่าฮาร์ดโค้ด ใช้เมื่อไม่มี `erp_company_profile`
- PDF ใช้แถวหลังผ่าน `RunReport` ทั้งหมด จึงมีข้อจำกัดเดียวกัน เช่น Custom SQL ที่ถูกปฏิเสธเพราะต้นทุน
- การแปลเป็นภาษาอังกฤษแทนเฉพาะค่าที่ตรงกับ `name_1` ทั้งข้อความ ไม่แปลข้อความผสม

## ที่มาในโค้ด
- `backend/internal/application/process/report_hierarchy.go:27-49` - `ReportHierarchyLevel`, `ReportGroupNode`
- `backend/internal/application/process/report_hierarchy.go:51` - `buildReportMultiLevelHierarchy`
- `backend/internal/application/process/report_hierarchy.go:97` - `applyRunningBalanceGrandTotals`
- `backend/internal/application/process/report_hierarchy.go:124` - `inferReportHierarchyLevels`
- `backend/internal/application/process/report_hierarchy.go:625` - `isRunningBalanceReport`
- `backend/internal/application/process/report_pdf.go:23-27` - ฝังฟอนต์ไทย
- `backend/internal/application/process/report_pdf.go:35` - `loadCompanyHeaderInfo`
- `backend/internal/application/process/report_pdf.go:76` - `loadBilingualDataMap`
- `backend/internal/application/process/report_pdf.go:111` - `RenderReportPDF`
- `backend/internal/application/process/report_pdf.go:318` - `resolvePaperDimensions`
- `backend/internal/application/process/report_pdf.go:525` - `buildReportPDFBytes`
- `backend/internal/application/process/report_pdf.go:1298` - `pdfPageBreakBefore`
- `backend/internal/adapter/inbound/http/process/handler.go:270` - handler `RenderReportPDF`

## ดูเพิ่ม
- [[proc-report-engine]]
- [[proc-report-custom-sql-template]]
- [[proc-report-registry-conditions]]
- [[process-overview]]
