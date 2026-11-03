---
title: "ตัดคำไทยใน PDF ไม่แยกสระ/วรรณยุกต์ และรายงานหลายชั้น (Thai Wrap, Multi-Level Report)"
tags: [standards, report, pdf, thai, backend]
aliases: ["splitIntoGraphemeClusters", "segmentThaiTokens", "wrapTextToLines", "ตัดคำไทย", "สระลอย", "buildReportMultiLevelHierarchy", "รายงานหลายชั้น", "ReportGroupNode", "running balance ยอดคงเหลือ", "report_pdf.go", "fitPDFNumbers", "ตัวเลข PDF ไม่ตัดกลาง"]
sources: ["AGENTS.md:53", ".agents/skills/report-and-form-engine/SKILL.md:14-15", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:28-31", "backend/internal/application/process/report_pdf.go:404", "backend/internal/application/process/report_pdf.go:1455", "backend/internal/application/process/report_pdf.go:1488-1492", "backend/internal/application/process/report_pdf.go:1607", "backend/internal/application/process/report_pdf.go:1621", "backend/internal/application/process/report_pdf.go:1697", "backend/internal/application/process/report_pdf.go:1707", "backend/internal/application/process/report_pdf.go:1819", "backend/internal/application/process/report_pdf.go:1856", "backend/internal/application/process/report_pdf.go:1881", "backend/internal/application/process/report_pdf.go:2062", "backend/internal/application/process/report_pdf.go:2120", "backend/internal/application/process/report_pdf.go:2145-2160", "backend/internal/application/process/report_pdf_numwrap_test.go:26-155", "backend/internal/application/process/report_hierarchy.go:5-16", "backend/internal/application/process/report_hierarchy.go:27-47", "backend/internal/application/process/report_hierarchy.go:51", "backend/internal/application/process/report.go:370"]
---

# ตัดคำไทยใน PDF และรายงานหลายชั้น

PDF รายงานสร้างฝั่ง Go (`report_pdf.go`) ต้องตัดบรรทัดไทยโดยไม่แยกสระ/วรรณยุกต์ออกจากพยัญชนะ (กฎข้อ 12, `AGENTS.md:53`) และรองรับรายงานแม่-ลูกหลายชั้นด้วยยอดรวมที่คำนวณด้วย `*big.Rat`

## ตัดคำไทย (ชื่อฟังก์ชันตรวจกับโค้ดจริง 2026-11-03)
- `KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:30` เรียกว่า `wrapThaiTextSmart` และ skill (`SKILL.md:15`) เรียก `wrapThaiAwareLine` — **ทั้งสองชื่อไม่พบในโค้ดปัจจุบัน** ฟังก์ชันจริงใน `report_pdf.go`:

  | ฟังก์ชัน | บรรทัด | หน้าที่ |
  |---|---|---|
  | `normalizeThaiUpstairsMarks` | 404 | ปรับสระ/วรรณยุกต์ที่ซ้อนบนให้แสดงถูก |
  | `isThaiCombiningRune` | 1607 | ตรวจตัวอักษรไทยที่ต้องติดพยัญชนะ (สระบน/ล่าง วรรณยุกต์) |
  | `splitIntoGraphemeClusters` | 1621 | แตกข้อความเป็น grapheme cluster ก่อนวัดความกว้าง |
  | `isThaiLeadingVowel` | 1697 | สระหน้า (`เ แ โ ไ ใ`) ห้ามค้างท้ายบรรทัด |
  | `segmentThaiTokens` | 1707 | แบ่งคำไทยเป็นโทเค็นตามขอบเขตคำ |
  | `wrapHeaderLabelToLines` | 1819 | ตัดหัวคอลัมน์ |
  | `wrapGraphemeFallback` / `wrapLongToken` | 1856 / 1881 | ตัดโทเค็นยาวทีละ cluster เมื่อไม่มีจุดตัดคำ |
  | `wrapTextToLines` | 2062 | ตัดข้อความเซลล์ตามความกว้างจริง |

- กฎ: **ห้ามแยกสระหน้า (`เ แ โ ไ ใ`) หรือวรรณยุกต์ออกจากพยัญชนะ**

## ตัวเลขใน PDF
- `fitPDFNumbers` (`:1488`) วัดความกว้างของตัวเลขที่กว้างที่สุดแต่ละคอลัมน์แล้วลดขนาดฟอนต์ทีละ 0.5pt ลงไม่ต่ำกว่า 6.5pt (`:1491`) ก่อนยอมให้ตัวเลขถูกตัดบรรทัด; `widenPDFNumericColumns` (`:1455`) ขยายคอลัมน์ตัวเลขจากคอลัมน์ข้อความก่อน
- ชุดเทสต์ `report_pdf_numwrap_test.go` (`:26`–`:155`) ครอบคลุม: ตัวเลขอยู่บรรทัดเดียว, ลดฟอนต์ตามขั้น, ถอยไปตัดบรรทัดเมื่อไม่พอ, คอลัมน์ตัวเลขว่างไม่ถูกบีบ, ขยายคอลัมน์ข้อความทีละคอลัมน์
- ค่า `0`/`0.00` (และค่าที่ขึ้นต้น `เฉลี่ย `/`ต่ำสุด `/`สูงสุด `) แสดงว่างเมื่อผ่าน `formatNumberWithCommas` (`:2145-2160`, ตรวจด้วย `isZeroNumericString` `:2120`)

## รายงานหลายชั้น (Multi-Level Hierarchical Report)
- ตัวสร้าง: `buildReportMultiLevelHierarchy(&res, groupByColumn, subGroupByColumn)` ใน `report_hierarchy.go:51` เรียกจาก `report.go:370` — เป็นที่ตั้งจริงของตรรกะหลายชั้น (KMS `:31` ชี้ `report.go`)
- โครงสร้างข้อมูลที่ส่งออก: `ReportHierarchyLevel` (Level 1 Root / 2 SubGroup, `KeyColumn`, `LabelColumn`, `ExtraColumns`, `TitlePrefix`) และ `ReportGroupNode` (`Subtotals`, `OpeningValue` จากแถว "ยอดยกมา", `Children`) — `report_hierarchy.go:27-47`
- ตรวจโครงสร้างอัตโนมัติ (`report_hierarchy.go:5-8`): บัญชีคุมสต็อกพิเศษ (2.24.6, 2.25.2, 2.25.3), ยอดคงเหลือตามคลัง/ชั้นเก็บ/ล็อต, ประวัติซื้อ-ขาย, สูตรชุดสินค้า, ราคา, ลูกหนี้-เจ้าหนี้เคลื่อนไหว/Ageing, รายละเอียดเอกสาร, GL/สมุดรายวัน
- ผู้ใช้เลือกจัดกลุ่ม 1 หรือ 2 ชั้นเองได้ผ่าน `groupByColumn` + `subGroupByColumn` กับรายงานหรือ SQL On-The-Fly
- **ยอดรวม**: ใช้ `*big.Rat` ทุกกลุ่ม; คอลัมน์เคลื่อนไหว (จำนวนเพิ่ม/ลด, มูลค่าเพิ่ม/ลด) รวมทุกบรรทัดในกลุ่ม ส่วนคอลัมน์ยอดคงเหลือสะสม (running balance, ต้นทุนเฉลี่ย) เอาค่า **แถวสุดท้ายของกลุ่ม** และ Grand Total รวมจากยอดสุดท้ายของแต่ละกลุ่มชั้น 1 — ห้ามรวมซ้ำทีละบรรทัด (`report_hierarchy.go:11-16`)
- ผลลัพธ์ใส่ใน `res.HierarchyLevels` / `res.GroupNodes` (`:56`) — ไม่มีแถว (`:58`) → `GroupNodes` เป็นค่าว่าง

## ที่มา
- `.agents/skills/report-and-form-engine/SKILL.md` Workflow 1 ข้อ 1
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Workflow §3
- `backend/internal/application/process/report_pdf.go`, `report_hierarchy.go`, `report_pdf_numwrap_test.go` (อ่านโค้ดจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-report-engine-standard]] · [[std-data-integrity-money-transactions]] · [[std-display-readability-rules]] · [[backend-overview]] · [[accounting-overview]]
