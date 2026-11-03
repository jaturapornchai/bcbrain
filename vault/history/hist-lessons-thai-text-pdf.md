---
title: "บทเรียนข้อความไทยใน PDF และงานพิมพ์ (Thai text, PDF and print)"
tags: [history, lesson, thai, pdf, print]
aliases: ["PDF number wrap", "Thai word wrap", "fitPDFNumbers", "segmentThaiTokens", "print scrollbar", "white paper", "reportCodeAliases"]
sources: ["backend/internal/application/process/report_pdf.go:1425", "backend/internal/application/process/report_pdf.go:1488", "backend/internal/application/process/report_pdf.go:1707", "backend/internal/application/process/report_pdf.go:1881", "backend/internal/application/process/report_pdf.go:436", "backend/internal/application/process/report_pdf.go:870", "backend/internal/application/process/report.go:209", "backend/internal/application/process/menu_title.go:125", "backend/internal/application/process/report_pdf_numwrap_test.go:26", "frontend/shared/components/GlobalDocFormPrintModal.tsx:4864", "frontend/shared/components/GlobalDocFormPrintModal.tsx:9801", "frontend/src/app/globals.css:357", "frontend/src/app/globals.css:2254", "AGENTS.md:53", "AGENTS.md:59"]
---

# บทเรียนข้อความไทยใน PDF และงานพิมพ์

PDF รายงานสร้างฝั่ง Go (`report_pdf.go`) ส่วนฟอร์มเอกสารพิมพ์จากเบราว์เซอร์ (`GlobalDocFormPrintModal.tsx`) ถ้าเลย์เอาต์กะความกว้างโดยไม่วัดค่าจริง ตัวเลขจะตกบรรทัด ข้อความไทยจะถูกหักกลางพยางค์ และกระดาษพิมพ์จะเพี้ยนสีหรือถูกตัด

## อะไรพังได้
- **ตัวเลข/วันที่/เลขที่ตกบรรทัด**: หั่นความกว้างตาม % อย่างเดียว ทำให้ค่าเช่น `2026-09-3 / 0` แตกกลางค่า โดยเฉพาะรายงานคอลัมน์เยอะ
- **ไทยถูกหักกลางพยางค์**: หัวคอลัมน์เช่น `หน่ / วย / นับ` หรือ `พื้นที่เ / ก็บ` เมื่อตัดต่อทีละตัวอักษรแทนที่จะตัดตามคำ
- **ยอดรวมย่อยตกบรรทัด**: ป้ายยอดรวมยาวกว่าช่องแล้วหักเป็นหลายบรรทัด
- **หัวกระดาษผิดชื่อ**: ใช้ชื่อหมวดแทนชื่อรายงาน หรือรับ param คนละชื่อ (`reportCode`, `doc_date_from`) แล้วไม่ทำงาน
- **พิมพ์/Save PDF จากเบราว์เซอร์ถูกตัด**: modal ที่ใช้ `overflow-hidden` ทุกชั้นมี scrollbar หรือตัดเนื้อหา; กระดาษฟอร์มถูกธีมทาสีจนไม่ขาว

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| รักษาตัวเลขให้อยู่บรรทัดเดียว | `backend/internal/application/process/report_pdf.go:1374,1488-1531` (`pdfNumberWidths`, `fitPDFNumbers`) | วัดความกว้างจริงของตัวเลขในแถว ขยายคอลัมน์ตัวเลข ถ้าไม่พอลดฟอนต์ทีละ 0.5pt ไม่ต่ำกว่า 6.5pt สุดท้ายค่อยให้ตัวเลขที่ไม่พอตกบรรทัด |
| คอลัมน์ "token" ไม่ถูกหัก | `report_pdf.go:1425-1443` (`isPDFTokenColumn`, `isPDFToken`) | คอลัมน์ที่ป้ายมีวันที่/เลขที่/รหัส/คลัง/หน่วย ฯลฯ ถือเป็นค่าคำเดียว (โค้ดจำกัดไม่เกิน 18 ตัวอักษร ส่วนคอมเมนต์บอก 25) และข้อความอิสระ (ชื่อ รายละเอียด หมายเหตุ ที่อยู่) เป็นฝ่ายยอมหัก |
| ขยาย token column ทีละคอลัมน์ | `report_pdf.go:1506-1531` | เมื่อ 6.5pt ยังไม่พอ ขยายคอลัมน์วันที่/เลขที่/รหัสซ้ายไปขวาตามที่คอลัมน์อื่นยอมให้ได้ |
| ตัดคำไทยตามพจนานุกรม/พยางค์ | `report_pdf.go:1707` (`segmentThaiTokens`), `:1881` (`wrapLongToken`) | หักที่ขอบคำก่อน ถอยเป็นพยางค์ และ grapheme เมื่อพยางค์เดียวยังกว้างเกิน (คอมเมนต์ยกตัวอย่าง `หน่ / วย / นับ`) |
| ยอดรวมแนวนอนบรรทัดเดียว | `report_pdf.go:436-446,1534` (`drawSingleLineHorizontalPDFText`, `ensurePDFHorizontalTotalLabelWidth`) | ลดฟอนต์ลงถึง 5.5pt เพื่อไม่ให้ป้ายยอดรวมตกบรรทัด |
| รับ param หลายชื่อ | `report.go:209-243` (`reportCodeAliases`, `normalizeRunReportInput`), เรียกซ้ำที่ `report_pdf.go:112` | แปลง `reportCode`, `doc_date_from`, `doc_no_from` ฯลฯ เป็นช่องมาตรฐาน |
| ชื่อรายงานบนหัวกระดาษ | `report_pdf.go:870-884`, `menu_title.go:125` | ลำดับ `CustomTitle` -> `Title` -> ชื่อเมนูจาก `getMenuTextByName` -> ชื่อระบบ |
| พิมพ์ผ่าน portal | `frontend/shared/components/GlobalDocFormPrintModal.tsx:4864,4898,9801` | modal อยู่ที่ `document.body` ผ่าน `createPortal`, CSS พิมพ์ซ่อนทุกอย่างนอก `#bc-doc-form-print-portal`, `print:overflow-visible` |
| กระดาษขาวเสมอ | `frontend/src/app/globals.css:357,2254-2268` | ธีมไม่ทาสีทับ `[data-doc-form-paper]`; กฎ anti-overflow บังคับ `#ffffff` และ `overflow-x:hidden` |
| เทสต์ | `report_pdf_numwrap_test.go:26-155` | 7 เทสต์: ตัวเลขอยู่บรรทัดเดียว, ลดฟอนต์เป็นขั้น, fallback เป็น wrap, คอลัมน์ว่างไม่ถูกบีบ, token column ขยายทีละคอลัมน์ |

## กฎที่ต้องจำ
- วัดความกว้างจากค่าจริงในแถวด้วยฟอนต์ที่ฝังจริงก่อนแบ่งคอลัมน์ ห้ามเฉลี่ยตาม % อย่างเดียว
- ตัวเลข วันที่ เลขที่ รหัส ห้ามตกบรรทัด (`AGENTS.md:59`); รายงานห้ามตัดข้อมูลด้วย `..` และต้องตัดคำไทยไม่แยกสระลอย (`AGENTS.md:53`)
- fallback ทีละชั้น (ขยายคอลัมน์ -> ลดฟอนต์ -> ขยายรายคอลัมน์ -> ยอมหัก) และมีเทสต์ครอบทุกชั้น
- ทดสอบงานพิมพ์ด้วย Save PDF จริง ไม่ใช่ดูแค่หน้าจอ

## ที่มาในโค้ด
- `backend/internal/application/process/report_pdf.go:436,870,1374,1425,1488,1534,1707,1881`
- `backend/internal/application/process/report.go:209-243`, `menu_title.go:125`, `report_pdf_numwrap_test.go:26-155`
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:4864-4901,9801`, `frontend/src/app/globals.css:357,2254`
- ดูเพิ่ม: [[hist-lessons-report-engine-rules]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-grid-ux-regressions]] · [[std-report-pdf-thai-wrap-multilevel]] · [[proc-report-hierarchy-pdf]] · [[proc-report-engine]] · [[history-overview]]
