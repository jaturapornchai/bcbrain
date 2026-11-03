---
title: "บทเรียนบั๊กลงบัญชี GL และความสมดุล (GL Posting & Balance Bugs)"
tags: [history, gl, journal]
aliases: ["GL ไม่สมดุล", "journal unbalanced", "GL fallback"]
sources: ["git:7b6fe34b", "git:cc66944c", "git:906c5b45", "git:00815c01", "git:13f953cc", "backend/internal/application/process/service.go:508", "backend/internal/application/process/gl_template.go:1046"]
---

## ภาพรวม
GL มี 2 ทาง: ตัวสร้างตามรูปแบบ `erp_doc_format_gl` (port จาก C#) และ `buildStandardGLLines` เป็นทางสำรอง ปัญหาซ้ำช่วง 2026-10-21 .. 2026-10-29 คือ (1) ลงด้านเดียวหรือผิดบัญชีจน Dr ≠ Cr (2) ทางสำรองไม่อ่านแท็บชำระ (3) รหัสบัญชีไม่อยู่ในผังจริง นโยบายปัจจุบันดู [[acc-gl-posting-standard]], [[acc-gl-template-engine]]

## อาการ
- **G1 ตัวสร้างตามรูปแบบ (7b6fe34b):** แถว `erp_doc_format_gl` ที่เป็นค่าชั่วคราวจาก seed ลงรายการด้านเดียว จึงไม่สมดุล
- **G2 ขายสินทรัพย์ (cc66944c):** ขายเชื่อ/ขายสดแยกผิด ลูกหนี้กับเงินสดสลับกัน
- **G3 ทางสำรอง (906c5b45, 00815c01):** รายได้/ค่าใช้จ่ายอื่นและเงินทอนในแท็บชำระไม่ถูกลง; สั่ง rebuild ช่วงที่มีปี 0000 ได้ 500 ดิบ
- **G4 UAT S1 (13f953cc):** ใบรับชำระที่มีภาษีถูกหัก ณ ที่จ่ายลงเงินสดเต็มยอด (#9); ฝากเงิน 401 ใช้บัญชีธนาคารตายตัว (#10); รายได้อื่น 250/ค่าใช้จ่ายอื่น 260 ไม่ใช้ผังของรหัสที่เลือก (#11, #12); ยอดยกมาสินค้าใช้รหัสที่ไม่อยู่ในผัง งบดุลไม่แสดง (#15)
- **G5 (160e31aa):** ตามข้อความ commit คือ GL posting + ค่าเสื่อมให้ตรง C# (ยังไม่ได้ตรวจ diff)

## สาเหตุ (root cause)
- **G1:** ไม่มีการแยก "รูปแบบที่ใช้ได้" ออกจากแถว placeholder และไม่ตรวจความสมดุลของผลลัพธ์
- **G2:** โค้ดเดิมถือ inquiry 1 หรือ 2 เป็นสด แต่ตาม C# `_saleType` คือ 1 หรือ 3 (diff cc66944c)
- **G3:** ทางสำรองคิดจากยอดรวมเอกสาร ไม่อ่านรายการชำระอื่น; `time.Parse` รับปี 0000 แต่ PostgreSQL ไม่มีปี 0 (คอมเมนต์ `service.go:1337`)
- **G4:** รหัสบัญชีตายตัวแทนที่จะ resolve จาก `erp_pass_book`/`erp_income_list`/`erp_expenses_list` ตาม `_transProcess.cs`; ประเภท 300/301, 410-416, 422, 451-463 ไม่มี case ในทางสำรอง (diff เพิ่ม case เหล่านี้)

## วิธีแก้
- **G1:** แยกทางรูปแบบออกจากทางสำรอง; ถ้ารูปแบบไม่สมดุลให้เตือน ไม่ทำให้ save หรือ RebuildGL ล้ม (คอมเมนต์ `gl_template.go:1003`) และมีไฟล์ default ของรูปแบบมาตรฐาน
- **G2:** ฟังก์ชันเดียว `assetSaleIsCash` ใช้ทุกจุด พร้อมเทสวนทุก inquiry type
- **G3:** `payOtherGL` ลงรายได้/ค่าใช้จ่ายอื่นและเงินทอน; `checkDateRange` ปฏิเสธปีนอกช่วงด้วยข้อความไทยก่อนยิง SQL
- **G4:** `resolveChartAccount` เลือกรหัสแรกที่มีในผัง (เช่น WHT ไล่ 2122, 2123, 2120); `payTenders` แยกเงินสด/โอน/เช็ค/บัตร/ภาษีถูกหัก; เพิ่ม case ที่ขาด; ล้างรหัส flag 54 ที่ไม่อยู่ในผัง

## commit ที่เกี่ยวข้อง
- `7b6fe34b` — port ตัวสร้าง GL ตามรูปแบบ + ทางสำรอง
- `160e31aa` — GL posting + ค่าเสื่อมตรง C# (ตามข้อความ commit)
- `cc66944c` — ประเภทขายสินทรัพย์ในรูปแบบ GL
- `906c5b45` / `00815c01` — ทางสำรองลงรายได้/ค่าใช้จ่ายอื่น+เงินทอน, ปี 0, ตรวจวันที่ rebuild
- `13f953cc` — GL ของ S1 (WHT, ธนาคาร, ผังรายได้/ค่าใช้จ่าย, เช็ค, 422, flag 54)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/service.go:508` `ValidateAndBalanceJournal`; `:1614` เรียกตอน rebuild (KindValidation); `:1335` `checkDateRange`; `:1755` `resolveChartAccount`; `:1775` `buildStandardGLLines`; `:1666` ล้างรหัส flag 54; `:2221` case 422
- `backend/internal/application/process/gl_template.go:1046` เตือน "ไม่สมดุล"
- `backend/internal/application/process/fa_sale.go:374` ปฏิเสธไม่สมดุล; `:695` `assetSaleIsCash`; เทส `:127` ใน fa_sale_test.go
- `backend/internal/application/process/gl_pay_other.go:17` `payOtherGL`

## บทเรียน / กฎที่ได้
- ทุกเส้นทางสร้างรายการบัญชีต้องผ่าน `ValidateAndBalanceJournal` หรือเตือนชัด ห้ามเก็บ Dr ≠ Cr เงียบ ๆ
- รหัสบัญชี resolve จากข้อมูลหลักของเอกสาร ห้าม hard-code; รหัสที่ไม่อยู่ในผังทำให้งบไม่แสดง
- ทางสำรองต้องอ่านแท็บชำระครบ (เงินสด โอน เช็ค บัตร ภาษีถูกหัก เงินทอน)
- enum ของ C# (inquiry type) ต้องมีฟังก์ชันตัดสินจุดเดียวและเทสทุกค่า
- rebuild GL ได้จาก Raw (ข้อ 9) แต่ดูงวดปิดก่อน; handoff ค้าง GL-CLOSED-PERIOD และ GL-MISSING-CHART-ACCOUNT
- ข้อค้างตาม handoff (ยังไม่ verify กับโค้ดปัจจุบัน): ทางสำรองของ 250/252/254 ลงเงินสดเสมอ ขณะที่ `arDebtWhere` นับ inquiry 0/2 เป็นลูกหนี้

## ดูเพิ่ม
[[acc-gl-posting-standard]] · [[acc-gl-template-engine]] · [[acc-gl-rebuild]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-payment-cheque-tenders]] · [[history-overview]]

## ที่มาในโค้ด
- git: `7b6fe34b`, `160e31aa`, `cc66944c`, `906c5b45`, `00815c01`, `13f953cc`
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` (ข้อ 3, 6, 8), `tests/uat/out/20261028/summary.md`
