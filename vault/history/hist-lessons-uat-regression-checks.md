---
title: "บทเรียนจุดตรวจถอยหลังจากรอบ UAT (UAT regression checks)"
tags: [history, lesson, uat, regression, test]
aliases: ["uat_s1_fixes_test", "UAT regression", "customSql admin", "transVatTabs deposit", "isPublicOrNoDbPath", "negative amount validation"]
sources: ["backend/internal/adapter/inbound/http/process/permission.go:59", "backend/internal/adapter/inbound/http/process/permission_test.go:89", "backend/internal/application/process/report_template.go:499", "backend/internal/application/process/report_template.go:650", "backend/internal/application/process/trans.go:863", "backend/internal/application/process/trans.go:1005", "backend/internal/application/process/trans.go:1019", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:272", "backend/internal/application/process/report_menu_gl_fa.go:1026", "backend/internal/application/process/uat_s1_fixes_test.go:10", "backend/internal/application/process/uat_s1_fixes_test.go:45", "backend/internal/application/process/uat_s1_fixes_test.go:86", "backend/internal/application/process/uat_s1_fixes_test.go:111", "backend/internal/application/process/uat_s1_fixes_test.go:139", "backend/internal/application/process/uat_s1_fixes_test.go:146", "backend/internal/application/process/uat_s1_fixes_test.go:154", "frontend/src/config/i18n/bcBilingualDataCache.ts:74", "frontend/src/config/i18n/bcBilingualDataCache.ts:111", "docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:56", "AGENTS.md:48", "AGENTS.md:64", "AGENTS.md:73"]
---

# บทเรียนจุดตรวจถอยหลังจากรอบ UAT

บั๊กที่รอบ UAT เคยเจอมักเกิดจากเส้นทางที่ข้ามด่านกลาง (สิทธิ์, validator, ตารางลงทะเบียน) ไม่ใช่ตรรกะเดี่ยว ๆ โค้ดวันนี้ตรึงไว้ด้วยเทสต์ 7 ข้อใน `uat_s1_fixes_test.go` และด่านในโค้ดจริง หน้านี้ชี้ว่าแต่ละข้อป้องกันอะไร และข้อที่เทสต์ยังไม่ครอบ

## อะไรพังได้
- **รายงาน SQL เอง (customSql)** รันด้วยสิทธิ์อ่านทั่วไป หรือเรียกฟังก์ชันอ่านไฟล์บนเซิร์ฟเวอร์ได้
- **ยอด/ราคา/จำนวนติดลบ** ผ่านการบันทึกเอกสาร (ส่วนลดเกินยอด, ราคาติดลบ, จำนวนเบิกติดลบ)
- **โอนเงินระหว่างสมุด (422) ไม่มีสมุดปลายทาง** หรือยอดโอนไม่หักค่าธรรมเนียม
- **รับคืนเข้าสต็อก (48, 58, 60)** เข้าด้วยราคาขายหรือศูนย์ ทำให้ต้นทุนเฉลี่ยเพี้ยน
- **เอกสารมัดจำ (11, 25, 110, 112)** ไม่มีแท็บ VAT จึงไม่ลงรายงานภาษี
- **ปีภาษีปน ค.ศ./พ.ศ.** ทำให้ช่วงเดือนภาษีเทียบผิด
- **หน้าก่อนล็อกอิน** (login, เลือกฐาน, admin) ยิงคำสั่งอ่านฐานข้อมูลที่ยังไม่มี session

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| customSql ต้อง Admin | `backend/internal/adapter/inbound/http/process/permission.go:59-67`; เทสต์ `permission_test.go:89-91` | `report/run` และ `report/pdf` ที่มี `customSql` ไม่ว่างต้องใช้สิทธิ์ admin ส่วนรายงานมาตรฐานใช้สิทธิ์อ่าน (เทสต์: ผู้อ่านรันไม่ได้ ผู้ดูแลรันได้) |
| validator อ่านอย่างเดียว | `backend/internal/application/process/report_template.go:499-530`; เทสต์ `uat_s1_fixes_test.go:154` | ยอมเฉพาะ `SELECT`/`WITH` คำสั่งเดียว บล็อกคำสั่งเขียนและฟังก์ชันอ่านไฟล์/ไดเรกทอรี (`pg_read_file`, `pg_ls_dir`, `pg_stat_file`, `lo_export`) หลังตัด literal ในเครื่องหมายคำพูดออกแล้ว |
| รันใน transaction อ่านอย่างเดียว | `report_template.go:650-666` | หลัง validate แล้วเปิด transaction แบบ `pgx.ReadOnly` |
| ยอดติดลบ | `trans.go:863,1005-1016`; เทสต์ `uat_s1_fixes_test.go:45` | ปฏิเสธมูลค่าสุทธิติดลบ, ราคาต่อหน่วยติดลบ, จำนวน/มูลค่ารายการติดลบ (ข้ามข้อจำนวน/มูลค่าเฉพาะ `TransFlag` 66) |
| โอนเงิน 422 | `trans.go:1019-1039`; เทสต์ `uat_s1_fixes_test.go:10` | ต้องระบุสมุดปลายทางและต่างจากสมุดต้นทาง, ค่าธรรมเนียมไม่ติดลบ, ยอดโอน = ยอดรวม - ค่าธรรมเนียม (เทสต์ยืนยัน 12000 - 25 = 11975.00) |
| ต้นทุนรับคืน | `backend/internal/application/process/service.go:272-278` (`CalculateMovingAverage`); เทสต์ `uat_s1_fixes_test.go:86,111` | 48 เข้าที่ต้นทุนเฉลี่ยปัจจุบัน ไม่ใช่ราคาขาย; 58/60 ที่ยอดเป็นศูนย์ใช้ต้นทุนเฉลี่ยปัจจุบัน |
| แท็บ VAT ของมัดจำ | `trans_tax.go:37-43` (`transVatTabs`); เทสต์ `uat_s1_fixes_test.go:146` | ลงทะเบียนแฟลก 11, 25, 110, 112 ครบ |
| ปีภาษี | `report_menu_gl_fa.go:1026`; เทสต์ `uat_s1_fixes_test.go:139` | ปี >2400 ลบ 543 ก่อนเทียบช่วงงวด (เทสต์เช็กแค่ว่า SQL มี `2400` หรือ `543`) |
| หน้าสาธารณะไม่ยิง API | `frontend/src/config/i18n/bcBilingualDataCache.ts:74-85,111` | `isPublicOrNoDbPath()` ข้ามการโหลดคู่ภาษาบน `/login`, `/select-database`, `/admin` |

ข้อที่ไม่เห็นเทสต์อัตโนมัติ: ด่านหน้าสาธารณะ (`bcBilingualDataCache.ts:74`) ตรวจได้ด้วยการเปิดหน้าจริงเท่านั้น

## กฎที่ต้องจำ
- ด่านสิทธิ์และ validator ต้องอยู่ฝั่ง backend ทุกเส้นทาง (`customSql` ทั้งตอนรันและตอน PDF) หน้าจอซ่อนปุ่มอย่างเดียวไม่พอ
- แก้บั๊กแล้วต้องมีเทสต์ที่พังก่อนแก้ ชื่อเทสต์อ้างรหัสข้อที่พบ (ดูรูปแบบ `TestUAT_<รหัส>_...`) และเทสต์ที่เช็กแค่ข้อความ SQL ไม่พอพิสูจน์พฤติกรรม
- ตารางลงทะเบียนตามแฟลก (`transVatTabs`) ต้องเพิ่มเมื่อเพิ่มชนิดเอกสารใหม่ และมีเทสต์วนเช็กแฟลกที่ต้องมี
- ทดสอบกับ `bcdemo` เท่านั้น ห้ามแก้ข้อมูลที่ไม่ขึ้นต้นด้วย `UAT` (`AGENTS.md:48`)
- แก้โค้ดแล้วส่งรายการไฟล์ให้ตัวทดสอบ และห้ามบอกว่าเสร็จก่อนผลตรวจจุดที่กระทบผ่านครบ (`AGENTS.md:64-67,73-77`); ตัวทดสอบตรวจหน้าจอ (ไม่มี `_` ในวงเล็บ ไม่มี F1-F12 ไม่มี `undefined`/`NaN`), ปุ่ม, รายงาน/PDF และ console error (`docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:56-59`)

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/process/permission.go:59-67`, `permission_test.go:89-91`
- `backend/internal/application/process/report_template.go:499-530,650-666`, `trans.go:863,1005-1039`, `trans_tax.go:37-43`, `report_menu_gl_fa.go:1026`
- `backend/internal/application/process/service.go:272-278`
- `backend/internal/application/process/uat_s1_fixes_test.go:10,45,86,111,139,146,154`
- `frontend/src/config/i18n/bcBilingualDataCache.ts:74-85,111`
- `docs/kms/KMS_UAT_SWARM_AND_ISSUEMATE.md:56-59`, `AGENTS.md:48,64-67,73-77`
- ดูเพิ่ม: [[std-uat-issuemate-workflow]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-stock-cost-moving-average]] · [[hist-lessons-permission-rights]] · [[hist-lessons-query-gateway-write-lockdown]] · [[history-overview]]
