---
title: "ตัดคำไทยใน PDF ไม่แยกสระ/วรรณยุกต์ และรายงานหลายชั้น (Thai Wrap, Multi-Level Report)"
tags: [standards, report, pdf, thai, backend]
aliases: ["splitIntoGraphemeClusters", "segmentThaiTokens", "wrapTextToLines", "ตัดคำไทย", "สระลอย", "buildReportMultiLevelHierarchy", "รายงานหลายชั้น", "ReportGroupNode", "running balance ยอดคงเหลือ", "report_pdf.go"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md", ".agents/skills/report-and-form-engine/SKILL.md", "backend/internal/application/process/report_pdf.go:1588", "backend/internal/application/process/report_pdf.go:1602", "backend/internal/application/process/report_pdf.go:1688", "backend/internal/application/process/report_pdf.go:2043", "backend/internal/application/process/report_hierarchy.go:51", "backend/internal/application/process/report.go:370"]
---

# ตัดคำไทยใน PDF และรายงานหลายชั้น

PDF รายงานสร้างฝั่ง Go (`report_pdf.go`) ต้องตัดบรรทัดไทยโดยไม่แยกสระ/วรรณยุกต์ออกจากพยัญชนะ และรองรับรายงานแม่-ลูกหลายชั้นด้วยยอดรวมที่คำนวณด้วย `*big.Rat`

## ตัดคำไทย (ชื่อฟังก์ชันตรวจกับโค้ดจริง)
- KMS เรียกว่า `wrapThaiTextSmart` / skill เรียก `wrapThaiAwareLine` — **ทั้งสองชื่อไม่พบในโค้ดปัจจุบัน** (ไฟล์/ฟังก์ชันอ้างอิงไม่พบแล้ว) ฟังก์ชันจริงที่ทำหน้าที่นี้ใน `report_pdf.go`:
  | ฟังก์ชัน | บรรทัด | หน้าที่ |
  |---|---|---|
  | `isThaiCombiningRune` | 1588 | ตรวจตัวอักษรไทยที่ต้องติดพยัญชนะ (สระบน/ล่าง วรรณยุกต์) |
  | `splitIntoGraphemeClusters` | 1602 | แตกข้อความเป็น grapheme cluster ก่อนวัดความกว้าง |
  | `isThaiLeadingVowel` | 1678 | สระหน้า (`เ แ โ ไ ใ`) ห้ามค้างท้ายบรรทัด |
  | `segmentThaiTokens` | 1688 | แบ่งคำไทยเป็นโทเค็นตามขอบเขตคำ |
  | `wrapHeaderLabelToLines` | 1800 | ตัดหัวคอลัมน์ |
  | `wrapGraphemeFallback` / `wrapLongToken` | 1837 / 1862 | ตัดโทเค็นยาวทีละ cluster เมื่อไม่มีจุดตัดคำ |
  | `wrapTextToLines` | 2043 | ตัดข้อความเซลล์ตามความกว้างจริง |
  | `normalizeThaiUpstairsMarks` | 404 | ปรับสระ/วรรณยุกต์ที่ซ้อนบนให้แสดงถูก |
- กฎ: **ห้ามแยกสระหน้า (`เ แ โ ไ ใ`) หรือวรรณยุกต์ออกจากพยัญชนะ** และตัวเลขต้องไม่ถูกตัดกลาง (`fitPDFNumbers`, `widenPDFNumericColumns` ขยายคอลัมน์ตัวเลขก่อน)
- ค่า `0`/`0.00` ใน PDF แสดงว่าง (`isZeroNumericString`, `report_pdf.go:2101`) และจัดรูป `formatNumberWithCommas` (`:2126`)

## รายงานหลายชั้น (Multi-Level Hierarchical Report)
- ตัวสร้าง: `buildReportMultiLevelHierarchy(&res, groupByColumn, subGroupByColumn)` ใน `report_hierarchy.go:51` เรียกจาก `report.go:370` (ชื่อไฟล์นี้ไม่ได้อยู่ใน KMS แต่เป็นที่ตั้งจริงของตรรกะหลายชั้น)
- โครงสร้าง: `ReportHierarchyLevel` (Level 1 Root / 2 SubGroup, `KeyColumn`, `LabelColumn`, `ExtraColumns`, `TitlePrefix`) และ `ReportGroupNode` (`Subtotals`, `OpeningValue`, `Children`)
- ตรวจโครงสร้างอัตโนมัติ: บัญชีคุมสต็อกพิเศษ (2.24.6, 2.25.2, 2.25.3), ยอดคงเหลือตามคลัง/ชั้นเก็บ/ล็อต, ประวัติซื้อ-ขาย, สูตรชุดสินค้า, ราคา, ลูกหนี้-เจ้าหนี้เคลื่อนไหว/Ageing, รายละเอียดเอกสาร, GL/สมุดรายวัน
- ผู้ใช้เลือกจัดกลุ่ม 1 หรือ 2 ชั้นเองได้ผ่าน `groupByColumn` + `subGroupByColumn` กับรายงานหรือ SQL On-The-Fly
- ตัวอย่างจาก KMS: ชั้น 1 แสดงรหัส/ชื่อสินค้า ชั้น 2 แสดงรายการเคลื่อนไหวพร้อมชื่อลูกค้า/เจ้าหนี้
- **ยอดรวม**: ใช้ `*big.Rat` ทุกกลุ่ม; คอลัมน์เคลื่อนไหว (จำนวนเพิ่ม/ลด, มูลค่าเพิ่ม/ลด) รวมทุกบรรทัดในกลุ่ม ส่วนคอลัมน์ยอดคงเหลือสะสม (running balance, ต้นทุนเฉลี่ย) เอาค่า **แถวสุดท้ายของกลุ่ม** และ Grand Total รวมจากยอดสุดท้ายของแต่ละกลุ่มชั้น 1 — ห้ามรวมซ้ำทีละบรรทัด

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Workflow §3 (ตัดคำไทยอัจฉริยะ, รายงานหลายชั้น)
- `.agents/skills/report-and-form-engine/SKILL.md` Workflow 1 ข้อ 1
- `backend/internal/application/process/report_pdf.go`, `report_hierarchy.go` (อ่านโค้ดจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-report-engine-standard]] · [[std-data-integrity-money-transactions]] · [[backend-overview]] · [[accounting-overview]]
