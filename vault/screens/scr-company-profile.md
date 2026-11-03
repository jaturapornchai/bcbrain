---
title: "กำหนดรายละเอียดบริษัท (CompanyProfileForm)"
tags: [screens, config]
aliases: ["CompanyProfileForm", "1001", "menu_company_profile", "ข้อมูลบริษัท", "company profile", "SchemaForm", "FieldControl"]
sources: ["frontend/account/config/CompanyProfileForm.tsx:28", "frontend/account/config/CompanyProfileForm.tsx:69", "frontend/account/config/CompanyProfileForm.tsx:107", "frontend/src/config/schemas/companyProfile.ts:10", "frontend/account/form/SchemaForm.tsx:281", "frontend/account/form/FieldControl.tsx:36", "frontend/shared/layout/ScreenHeader.tsx:47", "frontend/account/tabs/screenRegistry.tsx:261", "frontend/src/config/bcMenu.ts:279"]
---
# กำหนดรายละเอียดบริษัท (CompanyProfileForm)

จอฟอร์มเดียวสำหรับกรอกข้อมูลนิติบุคคลของระบบ (ชื่อ ที่อยู่ เลขผู้เสียภาษี สถานะสาขา พิกัดแผนที่) บันทึกเป็น **แถวเดียว** ของตาราง `erp_company_profile`
ข้อมูลนี้ถูกอ่านต่อโดยเอกสาร/รายงาน/e-Tax (ที่อยู่ละเอียดมีหมายเหตุ "ใช้กับใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax)" ที่ `companyProfile.ts:114`)
ฟอร์มสร้างจาก schema ด้วยตัวกลาง `SchemaForm` + `FieldControl` ซึ่งจอตั้งค่าอื่น (เช่น [[scr-options]]) ใช้ร่วมกัน

## วิธีเปิด
- เมนู `1001` `menu_company_profile` "กำหนดรายละเอียดบริษัท" หมวด "เริ่มต้น > ตั้งค่าองค์กร พนักงาน และเอกสาร" (รหัสหมวด 1001-1023) — ลงทะเบียนมือใน `screenRegistry.tsx:261` เปิดเป็นแท็บ (`mode: "tab"`)
- เป็นเมนูเฉพาะผู้ดูแล: อยู่ใน `ADMIN_ONLY_MENU_SET` (`bcMenu.ts:279`) ผู้ใช้ทั่วไปเข้าไม่ได้ กลไกดู [[fe-screen-registry-menu]]
- สิทธิ์ในจอ: ใช้ `useScreenRights()` ถ้าไม่มีสิทธิ์ "แก้ไขข้อมูล" ปุ่มบันทึกถูกปิด และถ้าเรียก `save()` จะขึ้นกล่อง "ไม่มีสิทธิ์บันทึกข้อมูล" (`CompanyProfileForm.tsx:31,70-79,183`)

## ช่องข้อมูลสำคัญและ validation
ส่วน "1. ข้อมูลบริษัท" (`companyProfile.ts:14-110`, 1 คอลัมน์)
| ช่อง | คอลัมน์ | ชนิด | กติกา |
|---|---|---|---|
| ชื่อบริษัท | `company_name_1` | text 100 | **บังคับ** (`required: true` และเช็คซ้ำตอนบันทึก "ข้อมูลไม่สมบูรณ์ : ชื่อบริษัท" `CompanyProfileForm.tsx:80-91`) |
| ชื่อ (อังกฤษ) | `company_name_2` | text 100 | - |
| ชื่อผู้ประกอบการ (ไทย/อังกฤษ) | `business_name_1` / `business_name_2` | text 100 | - |
| ชื่อสถานที่ประกอบการ (ไทย/อังกฤษ) | `workplace_1` / `workplace_2` | text 200 | - |
| ที่อยู่ (ไทย/อังกฤษ) | `address_1` / `address_2` | textarea 3 แถว, 255 | - |
| โทรศัพท์ / โทรสาร | `telephone_number` / `fax_number` | text 100 | - |
| เลขที่ผู้เสียภาษี | `tax_number` | text 100 | placeholder "เลขประจำตัวผู้เสียภาษี 13 หลัก" แต่ **ไม่มีการตรวจจำนวนหลักหรือ checksum ในโค้ดจอนี้** |
| สถานประกอบการ | `branch_type` | select | 0 = "1.สำนักงานใหญ่", 1 = "2.สาขา" |
| สาขาลำดับที่ | `branch_code` | text 25 | ซ่อนในรุ่น starter (ดูข้างล่าง) |
| ใช้ระบบสาขา | `branch_status` | checkbox | - |

ส่วน "2. ข้อมูลอย่างละเอียด (ที่อยู่อย่างละเอียด)" (`companyProfile.ts:111-145`): อาคาร `house`, ห้องที่ `room_no`, ชั้นที่ `floor_no`, หมู่บ้าน `village`, เลขที่ `house_no`, หมู่ที่ `crowd_no`, ตรอก/ซอย `lane`, ถนน `road`, ตำบล/แขวง `locality`, อำเภอ/เขต `amphur`, จังหวัด `province`, รหัสไปรษณีย์ `postcode` (ทุกช่อง text 255 เป็น text อิสระ ไม่ใช่ lookup จังหวัด) และ `latitude`/`longitude` (number)

ตำแหน่งแผนที่: ใต้ฟอร์มมีกล่อง `BcLocationFieldBox` ชื่อ "ตำแหน่งสำนักงานใหญ่ / บริษัท" (category `COMPANY`, ซ่อนช่องตัวเลข) ผู้ใช้เลือกจุดแล้วค่าไปลง `latitude`/`longitude` (`CompanyProfileForm.tsx:213-226`)

พฤติกรรมของ `SchemaForm`/`FieldControl` ที่ผู้ใช้เห็น
- ชนิดช่องที่วาดได้: `code` (ตัวพิมพ์ใหญ่, monospace), `text`, `textarea`, `checkbox`, `radio` (กรอบ GroupBox เต็มแถว), `select` (ถ้ามีตัวเลือก 1-9 ตัวแสดงเป็นปุ่มวิทยุเรียงแถว ถ้า 10 ตัวขึ้นไปเป็นรายการเลื่อนลง; ถ้าค่าไม่ตรงตัวเลือกใดจะแสดงตัวเลือกแรก), `lookup`, `number` (ช่อง `NumberBox` พร้อมเครื่องคิดเลข ไม่ยอมให้ติดลบถ้า `min` ไม่ติดลบ — เก็บเป็นสตริง ดู [[fe-numeric-money]]), `password`, `date`, `image`, `label`, `blank`, `heading` (`FieldControl.tsx:38-296`, `SchemaForm.tsx:78-110`)
- ช่องที่แก้แล้วแต่ยังไม่บันทึกจะถูกไฮไลต์ (`fld-dirty`) และหัวจอแสดง "แก้ไขแล้ว N ช่อง" (`ScreenHeader.tsx:83-85`)
- ซ่อนช่องตามรุ่นผลิตภัณฑ์: ถ้าไม่มี GL ซ่อนช่อง lookup ผังบัญชี/`account_code*`/`gl_account*`; ถ้าไม่มีสาขา/แผนกซ่อน `branch_code`, `department_code` ฯลฯ; รุ่นที่ไม่มี Pro ซ่อน `multi_currency`, `home_currency`, `pr_approve_lock` ฯลฯ (`SchemaForm.tsx:10-58`)

## ปุ่ม / คีย์ลัด
- **บันทึก** (`Ctrl+S`) — `ScreenHeader` ผูก `Ctrl+S` เท่านั้น และกดได้เมื่อแท็บ active + ฟอร์มกรอกครบ + แก้ไขแล้ว + มีสิทธิ์ (`ScreenHeader.tsx:47-56`, `CompanyProfileForm.tsx:183`). ความเห็นในโค้ดบรรทัด 30 กล่าวถึง F12 แต่ **ไม่พบตัวจับ F12 ใน ScreenHeader**
- **ปิดหน้าจอ** (`Esc`) — ถ้ามีการแก้ไขจะขึ้น "มีการแก้ไขปรับปรุง ต้องการออกจากหน้าจอนี้หรือไม่" (ตกลง/ยกเลิก) ก่อนทิ้ง (`CompanyProfileForm.tsx:147-173`; `ScreenHeader.tsx:58-60`)
- ปุ่มบันทึกถูกปิดและมีข้อความ "ยังไม่ได้กรอก: …" เมื่อมีช่องบังคับว่าง (`CompanyProfileForm.tsx:184-188`)

## popup / modal ที่เรียกได้
- `BcDialog` ชนิด alert/error/success/confirm สำหรับเตือน (ไม่มีสิทธิ์, ข้อมูลไม่สมบูรณ์, ล้มเหลว, สำเร็จ) — ดู [[scr-data-list-and-lookup]]
- `BcMapPickerModal` (ภายใน `BcLocationFieldBox`) สำหรับเลือกพิกัด

## API / process actions
- โหลด: `queryList("SELECT * FROM erp_company_profile LIMIT 1")` — ถ้าไม่มีแถวใช้ฟอร์มว่าง (`CompanyProfileForm.tsx:49-58`)
- บันทึก: `queryExecBatch(["DELETE FROM erp_company_profile", insert …])` ใน transaction เดียว — **ลบทั้งตารางแล้วใส่แถวใหม่** ตามพฤติกรรม BC เดิม (`CompanyProfileForm.tsx:107-116`). SQL insert สร้างจาก `buildInsertSql` ซึ่งใส่ทุกคอลัมน์ใน schema ยกเว้นชนิด label/image/blank/heading (`bc-query-builder.ts:263-287`). กลไก: [[fe-query-client-sql-builder]]
- หลังสำเร็จขึ้น "บันทึกข้อมูลเสร็จเรียบร้อย โปรแกรมจะปิดหน้าจอนี้ให้" แล้วปิดแท็บ (`:134-144`)

## ตารางที่ข้อมูลลงไป
[[tbl-erp-company-profile]] (แถวเดียว; DELETE ทั้งตารางแล้ว INSERT)

## ข้อควรระวัง
- เพราะบันทึกแบบ "ลบทั้งตาราง + insert" ถ้าคอลัมน์ในตารางจริงมีฟิลด์ที่ schema ไม่ครอบคลุม ค่านั้นจะหายหลังบันทึก (คอลัมน์ที่ไม่อยู่ใน `companyProfileSchema` ไม่ถูกเขียน)
- ไม่มีการตรวจรูปแบบเลขผู้เสียภาษี/รหัสไปรษณีย์ในจอนี้ (มีเพียง `maxLength`)
- ต้องมีสิทธิ์แก้ไขและเป็นผู้ดูแล มิฉะนั้นดูได้อย่างเดียว

## ที่มาในโค้ด
- `frontend/account/config/CompanyProfileForm.tsx:28-244` — จอทั้งหมด (โหลด 49, บันทึก 69-145, ปิด 147-173, แผนที่ 213-226)
- `frontend/src/config/schemas/companyProfile.ts:10-145` — schema ฟิลด์ (อ้างอิง `BCERPConfig/_companyProfile.cs` ตามคอมเมนต์บรรทัด 6)
- `frontend/account/form/SchemaForm.tsx:10-58,78-110,281` — ซ่อนตามรุ่น + การวาดแถว
- `frontend/account/form/FieldControl.tsx:36-296` — ตัววาดช่องแต่ละชนิด
- `frontend/shared/layout/ScreenHeader.tsx:47-64` — คีย์ลัด Ctrl+S / Esc
- `frontend/account/tabs/screenRegistry.tsx:261`, `frontend/src/config/bcMenu.ts:279`
- ดูเพิ่ม: [[scr-options]] · [[fe-screen-registry-menu]] · [[fe-query-client-sql-builder]] · [[fe-numeric-money]] · [[screens-overview]]
