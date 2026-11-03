---
title: "บทเรียนรอบ UAT และบั๊ก S1 วันที่ 2026-10-29 (UAT Rounds & S1 Bugs)"
tags: [history, uat, issuemate, bugs, test-data]
aliases: ["13 S1 bugs", "5 Hold items", "UAT r3b", "ZZ4 test data", "BCAIACC-123..169"]
sources: ["git:13f953cc", "git:a3809aba", "git:8dad8a4d", "git:3ca3b07b", "git:1ae4ac0c", "git:4341ae81", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md:28"]
---

## ภาพรวม
2026-10-19..29 บั๊กเข้าสามทาง: GitHub issue #1-#100 ที่ watcher ดึงมาแก้เป็นชุด, UAT swarm (R1, r2, r3b ใน handoff 2026-10-22) และใบงาน IssueMate BCAIACC-nnn วันที่ 29 ปิด "13 S1 bugs + 5 Hold" กับ BCAIACC-123..169 ซ้ำเพราะเส้นทางที่ข้ามด่านกลางและข้อมูลทดสอบที่ค้าง

## อาการ
- **A (watcher):** 1ae4ac0c ปิด #1-#35 (147 ไฟล์ รวม `wait_for_issue.py`); ต่อด้วย bc8d27d4 (#36-#48), 866328e7 (#49-#72), bbf81811 (#73-#91), 72d402f3 (#92-#93), 6ba1a6d9 (#94-#97 รวม 401 refresh token), 2c97aa3a (#98-#100) (ชุดหลังตามข้อความ commit; ยังไม่ตรวจ diff)
- **B (UAT r3b, 2026-10-22):** หยุดกลางทางราว 40 นาที; `r3f-trans-gl` พบ B1: บันทึกเอกสาร ~10 ใบพร้อมกันกับสินค้าเดียวกันได้ `deadlock detected` เป็น HTTP 400; `regression` 64 เคสไม่พบ
- **C (13f953cc):** จาก `uat_s1_fixes_test.go`: A3/Hold1 ต้นทุนเฉลี่ยรับคืน (48, 58, 60), A5 โอน 422 ไม่บังคับสมุดปลายทาง, A6 ยอด/ราคา/จำนวนติดลบผ่าน, B1 ปี พ.ศ./ค.ศ. ในรายงานภาษี, B3 flag มัดจำ 11/25/110/112 ไม่อยู่ใน VAT, C1 SQL รายงานอ่านไฟล์เซิร์ฟเวอร์ได้; ส่วน GL, สิทธิ์, bcrypt ไม่มี test
- **D (a3809aba, 8dad8a4d, 3ca3b07b):** `/login`, `/admin` ยิง query ก่อนล็อกอิน; ไม่มีลูกค้า POS `AR0001`/`CASH`; อัตรา VAT 0; หน้าเปลี่ยนรหัสผ่านโหมดสาธิตไม่มีช่องกรอก (BCAIACC-122); PDF ไม่มีชื่อเมนู, ปุ่มลัด grid

## สาเหตุ (root cause)
- B: บันทึกแก้ `ic_trans_detail` ของเอกสารอื่นที่ใช้สินค้าเดียวกันโดยไม่เรียงลำดับ lock (คอมเมนต์ 4341ae81; handoff ไม่ระบุ commit แก้ แต่วันและอาการตรงกัน)
- C: ข้ามด่านกลาง: `report/run` รับ `customSql` ด้วยสิทธิ์อ่าน, `vat_effective_year` ลบ 543 ตรงๆ แม้เป็น ค.ศ.
- D: หน้าบ้านเรียก API ทั้งที่ยังไม่มี session/DB (`bcBilingualDataCache.ts`, `numeric.ts`); seed ไม่ครบ

## วิธีแก้
- C: `report/run`/`report/pdf` ที่มี `customSql` ต้อง admin; `HashPassword` + `Authenticate` รองรับ bcrypt; `glfaPeriodSQL` แยกปีด้วย `>2400`; ลง `transVatTabs` 4 flag; `trans.go` ปฏิเสธยอดติดลบ/บังคับสมุดปลายทาง 422; รับคืน 48 ใช้ต้นทุนเฉลี่ยปัจจุบัน
- B: 4341ae81 เพิ่ม `lockStockItems` (advisory lock เรียงรหัสสินค้า) ดู [[hist-lessons-concurrency-advisory-locks]]
- D: `isPublicOrNoDbPath` ข้ามการโหลดบนหน้า login/select-database/admin; seed ลูกค้า POS; ถอดอัตรา VAT จากยอดเมื่อเป็น 0

## commit ที่เกี่ยวข้อง
- `13f953cc` — 13 S1 + 5 Hold (33 ไฟล์) รวมบัญชี 212015 ของ 310/311/315 และ WHT ในช่องทางจ่าย
- `a3809aba` — กัน query ก่อนล็อกอิน, seed POS, อัตรา VAT; watcher ปลุกเมื่อ `ai_approved`/มีคอมเมนต์ใหม่
- `8dad8a4d` — หน้ารหัสผ่านสาธิต + กฎฐานทดสอบ; `3ca3b07b` — BCAIACC-123..169
- BCAIACC-106..116 (22-23 ต.ค. UI/ตัวเลข/แท็บ) ตามข้อความ commit ยังไม่ได้ตรวจ diff; 234/235 แยก 6 commit ตาม root cause

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/uat_s1_fixes_test.go:10-160` (test ทั้ง 7 ข้อ)
- `backend/internal/application/process/report_template.go:499,502`; `.../http/process/permission.go:60`; `.../http/admin/handler.go:283,340`
- `backend/internal/application/process/trans_tax.go:42,80-81`; `report_menu_gl_fa.go:1023`; `trans.go:863,1021`
- `backend/internal/application/process/service.go:272` (48), `:987-1000` (`lockStockItems`), `:1658` (212015); `pos_config.go:410`
- `frontend/src/config/i18n/bcBilingualDataCache.ts:74`; `frontend/src/lib/api-server.ts:79-104` (refresh token single-flight จาก 6ba1a6d9); `scripts/wait_for_issue.py:713` (poll 60 วินาที)

## บทเรียน / กฎที่ได้
1. จัดกลุ่มบั๊กตาม root cause, แก้พร้อม test ที่พังก่อนแก้, commit ละ root cause แล้วรันชุดเต็มซ้ำ ห้ามบอกเสร็จก่อนรอบสุดท้ายผ่าน (`HANDOFF_BCCM_PARITY_2026-10-22.md:52`)
2. ทดสอบกับ `bcdemo` เท่านั้น ห้ามแตะฐานลูกค้าจริง; r3b ทิ้งเอกสาร `ZZ4-` ไว้ 55 `ic_trans`, 19 `gl_journal`, 6 `cb_trans`, 3 สินค้า (handoff ข้อ 4) ลบผ่านหน้าจอ/API ลบของ backend เท่านั้นเพื่อให้สต็อก/GL ถอย ห้าม SQL ดิบ; แถว audit ปล่อยไว้
3. AGENTS.md ข้อ 7 (8dad8a4d) สร้างฐาน `uat_<name>` ได้ แต่ห้ามรหัสหลุดลงเว็บ/แชท/log/git และห้ามแก้ `bcdemo` ยกเว้นแถว `UAT`
4. สิทธิ์และ SQL ตรวจที่ backend ทุกเส้นทาง; หน้าก่อนล็อกอินห้ามยิง API
5. ชุด `options-r3efg` (แก้ `erp_option`) รันเดี่ยว: INSERT -> ทดสอบ -> DELETE ใน try/finally แล้วนับแถว = 0

## ดูเพิ่ม
[[std-uat-issuemate-workflow]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[hist-lessons-gl-posting-balance]] · [[hist-lessons-permission-rights]] · [[hist-lessons-master-save-preserve-columns]] · [[hist-parity-bccm]] · [[history-overview]]

## ที่มาในโค้ด
- git: 13f953cc, a3809aba, 8dad8a4d, 3ca3b07b, 1ae4ac0c, bc8d27d4, 866328e7, bbf81811, 72d402f3, 6ba1a6d9, 2c97aa3a, 4341ae81
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` (ข้อ 3-4), `docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md`
