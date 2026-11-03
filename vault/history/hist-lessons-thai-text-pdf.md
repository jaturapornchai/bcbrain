---
title: "บทเรียน ข้อความไทยใน PDF และงานพิมพ์ (Thai text, PDF and print)"
tags: [history, thai, pdf, print]
aliases: ["PDF number wrap", "Thai word wrap", "fitPDFNumbers", "print scrollbar", "white paper"]
sources: ["git:631d8b93", "git:d0506985", "git:5e33f5c2", "git:5fa7e098", "git:3ca3b07b", "git:8bd0dafb", "git:09d490a5", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md R3g"]
---

## ภาพรวม
PDF รายงานสร้างฝั่ง Go (`report_pdf.go`) ส่วนฟอร์มเอกสารพิมพ์จากเบราว์เซอร์ (`GlobalDocFormPrintModal.tsx`) ต้นเหตุร่วมคือเลย์เอาต์กะความกว้างโดยไม่เผื่อค่าจริง (ตัวเลขยาว, ไทยไม่มีช่องว่าง, theme ครอบสีกระดาษ) ช่วง 22-29 ต.ค. 2026 ไล่แก้ 4 กลุ่ม

## อาการ
- A) ตัวเลขใน PDF ตกบรรทัด, วันที่ขึ้น `2026-09-3 / 0`, เลขที่เอกสาร/รหัสถูกหักกลางค่า โดยเฉพาะรายงาน 27 คอลัมน์
- B) หัวคอลัมน์/คำอธิบายถูกตัดกลางพยางค์ (`หน่ / วย / นับ`, `พื้นที่เ / ก็บ`) และ label ยอดรวมย่อยตกบรรทัด
- C) หัวกระดาษ PDF ใช้ชื่อหมวดแทนชื่อรายงาน และ client บางตัวส่ง `reportCode`/`doc_date_from` แทนชื่อ param มาตรฐาน
- D) พิมพ์/Save PDF จากเบราว์เซอร์มี scrollbar และเนื้อหาถูกตัด; กระดาษฟอร์มกลายเป็นสีตาม theme (ไม่ขาว) สิ้นเปลืองหมึก; ป้ายปุ่มยังเป็นอังกฤษ "Save JSON"

## สาเหตุ (root cause)
- A) `wrapTextToLines` หักตามความกว้างคอลัมน์ที่เฉลี่ยตาม % โดยไม่วัดค่าจริงในแถว (diff `631d8b93`, `d0506985`, `5e33f5c2` ตรวจแล้ว)
- B) เดิมตัดต่อ rune ไม่มีพจนานุกรมคำ/พยางค์ไทย (ดูฟังก์ชันที่เพิ่มใน diff `5fa7e098`)
- C) `reportTitle` fallback ไป `res.ReportCategory` และไม่ normalize alias ของ param (diff `3ca3b07b`)
- D) โครงเดิมใช้ `overflow-hidden` ทุกชั้นโดยไม่มี `print:overflow-visible` (diff `8bd0dafb`); CSS theme `div.bg-white` ทาสีทับกระดาษ ตามคอมเมนต์ใน `globals.css` ของ `09d490a5`

## วิธีแก้
- A) สามชั้น: `631d8b93` `fitPDFNumbers` วัดค่าจริงกว้างสุดของคอลัมน์ตัวเลข ขยายคอลัมน์ ไม่พอก็ลดฟอนต์ทีละ 0.5pt จนต่ำสุด 6.5pt; `d0506985` นับคอลัมน์ "วันที่/กำหนด/เลขที่/รหัส" เป็น token column ด้วย (`isPDFTokenColumn`, token = คำเดียว <=25 ตัวอักษร); `5e33f5c2` ถ้า 6.5pt ยังไม่พอ ขยาย token column ทีละคอลัมน์ซ้ายไปขวา (RD-1 greedy fit ตาม handoff) และ `runSQLUtilityReport` ไม่ตัดแถวเงียบ (RD-2)
- B) `5fa7e098`: `segmentThaiTokens` ตัดตามพจนานุกรมคำบัญชีก่อน แล้วถอยเป็นพยางค์; ยอดรวม/รวมย่อยวาด 1 บรรทัดด้วย `drawSingleLineHorizontalPDFText` (ลดฟอนต์ถึง 5.5pt) และ `ensurePDFHorizontalTotalLabelWidth`
- C) `3ca3b07b`: `normalizeRunReportInput` แปลง `reportCode`/`doc_date_from` ฯลฯ เป็นช่องมาตรฐาน; ชื่อรายงานดึงจากเมนูฝังใน `bcMenu.json` ผ่าน `getMenuTextByName`
- D) `8bd0dafb`: render ผ่าน `createPortal` ไป `document.body` และ print CSS ซ่อนทุกอย่างนอก `#bc-doc-form-print-portal`, เปลี่ยน `overflow` เป็น visible ตอนพิมพ์; `09d490a5`: ยกเว้นกระดาษด้วย `data-doc-form-paper` แล้วบังคับ `#ffffff`; `848b9e05`: "Save JSON" -> "บันทึก JSON"

## commit ที่เกี่ยวข้อง
`631d8b93`, `d0506985`, `5e33f5c2` (ตัวเลข/token), `5fa7e098` (ตัดคำไทย, ยอดรวมแนวนอน; ข้อความ commit ระบุ "clean underscore variable labels" ยังไม่ได้ตรวจ diff ส่วนนี้), `3ca3b07b` (ชื่อ PDF), `8bd0dafb`, `09d490a5` (พิมพ์), `848b9e05` (ป้ายไทย)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/report_pdf.go:1355,1406,1421,1469` (`pdfNumberWidths`, `isPDFTokenColumn`, `isPDFToken`, `fitPDFNumbers`); ฟอนต์ขั้นต่ำ `:534`, `:1472`
- `report_pdf.go:436,1515,1688,1862,1899` (`drawSingleLineHorizontalPDFText`, `ensurePDFHorizontalTotalLabelWidth`, `segmentThaiTokens`, `wrapLongToken`, `rebalancePDFColumnsForTextAndHeaders`), `:868` (ชื่อรายงาน)
- `backend/internal/application/process/menu_title.go:125`, `report.go:209,225`; เทสต์ `report_pdf_numwrap_test.go:26-155` (7 เทสต์)
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:4864,4898,9801`; `frontend/src/app/globals.css:357`

## บทเรียน / กฎที่ได้
1. วัดความกว้างจากค่าจริงในแถว (ใช้ฟอนต์จริงที่ฝัง) ก่อนแบ่งคอลัมน์ ห้ามเฉลี่ยตาม % อย่างเดียว
2. ตัวเลข วันที่ เลขที่ และรหัสต้องไม่ตกบรรทัด; ข้อความอิสระ (ชื่อ รายละเอียด หมายเหตุ ที่อยู่) เป็นฝ่ายยอมหัก
3. หักบรรทัดไทยตามพจนานุกรม/พยางค์ ไม่ใช่ต่อ rune
4. ทดสอบงานพิมพ์จริง (Save PDF) ไม่ใช่ดูหน้าจอ; modal พิมพ์ต้องอยู่ที่ root ผ่าน portal และกระดาษขาวเสมอ
5. ทำ fallback ทีละชั้น (ขยายคอลัมน์ -> ลดฟอนต์ -> ขยายรายคอลัมน์) และมีเทสต์ครอบทุกชั้น

## ดูเพิ่ม
[[hist-lessons-report-engine-parity]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-grid-ux-regressions]] · [[std-report-pdf-thai-wrap-multilevel]] · [[proc-report-hierarchy-pdf]] · [[proc-report-engine]] · [[history-overview]]

## ที่มาในโค้ด
repo `bcaiaccount` (อ่านอย่างเดียว): `backend/internal/application/process/{report_pdf.go,report.go,menu_title.go}`, `frontend/shared/components/GlobalDocFormPrintModal.tsx`, `frontend/src/app/globals.css`, handoff R3g, diff ของ `631d8b93`, `d0506985`, `5e33f5c2`, `3ca3b07b`, `8bd0dafb`, `09d490a5`
