---
title: "สร้าง ตรวจสอบ และโอนข้อมูลฐานข้อมูล (CreateDatabaseScreen, CheckDatabaseScreen, TransferDataScreen)"
tags: [screens, admin]
aliases: ["CreateDatabaseScreen", "CheckDatabaseScreen", "TransferDataScreen", "สร้างฐานข้อมูลใหม่", "ตรวจสอบฐานข้อมูล", "โอนข้อมูล", "/admin/create-database", "/admin/check-database", "/admin/transfer"]
sources: ["frontend/account/admin/screens/ExtraAdminScreens.tsx:620", "frontend/account/admin/screens/ExtraAdminScreens.tsx:700", "frontend/account/admin/screens/ExtraAdminScreens.tsx:815", "frontend/src/config/adminMenu.ts:98"]
---
# สร้าง ตรวจสอบ และโอนข้อมูลฐานข้อมูล

3 จอท้ายของไฟล์ `ExtraAdminScreens.tsx` ในพื้นที่ `/admin` ([[scr-admin-console]]) ใช้ `ProviderScopedScreen` (เลือก Provider ก่อน) ไม่มีคีย์ลัดและไม่ใช้ `ScreenHeader` ของ ERP

## วิธีเปิด
| จอ | path | ชื่อเมนูใน `/admin` |
|---|---|---|
| CreateDatabaseScreen | `/admin/create-database` | สร้างฐานข้อมูลใหม่ |
| CheckDatabaseScreen | `/admin/check-database` | ตรวจสอบฐานข้อมูล |
| TransferDataScreen | `/admin/transfer` | โอนข้อมูล |

ทั้งสามอยู่ในกลุ่ม "Database Manage (Provider)" ของ `adminMenu.ts` (บรรทัด 88-137) เฉพาะผู้ดูแลระบบส่วนกลางเข้าได้

## 1) สร้างฐานข้อมูลใหม่ (CreateDatabaseScreen, `:620-696`)
หมายเหตุหัวจอ "สร้างและผูกฐานข้อมูลบริษัทใหม่เข้ากับระบบ BC Account"
- ฟอร์ม "สร้าง/ลงทะเบียนฐานข้อมูลกิจการใหม่" มี 4 ช่อง (`:672-685`)
  - กลุ่มข้อมูล (Data Group) ว่าง = `MAIN` (`:650`)
  - รหัสฐานข้อมูล (Data Code) เช่น `bcdemo` หรือ `branch02`
  - ชื่อบริษัท / ชื่อฐานข้อมูลที่แสดงตอนเข้าสู่ระบบ
  - ชื่อฐานข้อมูล PostgreSQL (Physical Database Name) ค่าเริ่มต้นในฟอร์มเป็น `bcdemo` (`:636`)
- ปุ่ม **สร้างและผูกฐานข้อมูล** ต้องกรอกรหัส ชื่อบริษัท และชื่อฐานข้อมูลครบ ไม่งั้นขึ้น "กรุณากรอกรหัสข้อมูล ชื่อบริษัท และชื่อฐานข้อมูลให้ครบ" (`:641-644`)
- ส่ง `POST /api/admin/databases` พร้อม `{provider, data_group, data_code, data_name, data_database_name}` (`:648-654`) ซึ่งเป็น endpoint เดียวกับ "เชื่อมฐานข้อมูล" ใน [[scr-admin-console]] ผลสำเร็จ: `สร้างและผูกฐานข้อมูล "<รหัส> (<ชื่อ>) -> <ฐาน>" เรียบร้อย`
- **ข้อควรระวัง:** จากโค้ดฝั่งจอ ปุ่มนี้ทำเพียงลงทะเบียนแถวในรายการฐานข้อมูลของ provider ไม่มีขั้นตอน `CREATE DATABASE` หรือสร้างตารางเริ่มต้นในจอนี้ ชื่อ "สร้าง" จึงอาจทำให้เข้าใจว่าสร้างฐานจริง ให้ตรวจที่ API `/api/admin/databases` (นอกขอบเขตบันทึกนี้)

## 2) ตรวจสอบฐานข้อมูล (CheckDatabaseScreen, `:700-810`)
หมายเหตุ "ตรวจสอบโครงสร้างตารางและดัชนีของฐานข้อมูล PostgreSQL"
- ดรอปดาวน์ "ฐานข้อมูลที่ตรวจสอบ:" แสดง `รหัส — ชื่อ (ชื่อฐาน)` ของ provider (`:761-769`)
- เมื่อเลือกฐาน (และตอนเปิดจอ) จอเรียก `POST /api/admin/main-query` พร้อมชื่อฐานเป้าหมาย รัน SQL ที่อ่าน `information_schema.columns` ของ schema `public` นับจำนวนคอลัมน์ต่อตาราง (`:728-743`)
- แสดง "พบ N ตารางในระบบ PostgreSQL", เวลา "ตรวจล่าสุด" และปุ่ม **ตรวจสอบโครงสร้างทันที** (`:775-779`)
- ตารางผล: ชื่อตาราง (Table Name), จำนวนคอลัมน์, สถานะโครงสร้าง (แสดง "สมบูรณ์" `:787-800`)
- **ข้อควรระวัง:** จอนี้ไม่ได้ตรวจกับโครงสร้างมาตรฐาน ตามโค้ดมันแค่ลิสต์ตารางและนับคอลัมน์ในฐาน (ดู SQL `:735-741`) ป้าย "สมบูรณ์" ในคอลัมน์ "สถานะโครงสร้าง" ถูกใส่ตายตัวทุกแถว (`:798-801`) จึงยืนยันเพียงว่าตารางนั้นมีอยู่ ไม่ได้ตรวจดัชนีหรือชนิดข้อมูลแม้หมายเหตุหัวจอพูดถึงดัชนี การตรวจโครงสร้างจริงอยู่ที่เมนู ERP ตรวจสอบโครงสร้างฐานข้อมูล (`menu_verify_database`, รหัส 1100) ซึ่งทำงานผ่านจอ SQL utility

## 3) โอนข้อมูล (TransferDataScreen, `:815-899`)
หมายเหตุ "โอนข้อมูลหลัก (Master Data) และผังบัญชีระหว่างฐานข้อมูลในร..." (`:819`)
- เลือก "ฐานข้อมูลต้นทาง (Source)" และ "ฐานข้อมูลปลายทาง (Destination)" จากฐานของ provider (`:858-872`)
- เลือกชุดข้อมูลที่จะโอน (checkbox ที่ `:879-887`) จาก 7 ชุด: ข้อมูลสินค้า (`ic_inventory`), หน่วยนับสินค้า (`ic_unit`), คลังสินค้า (`ic_warehouse`), ข้อมูลลูกหนี้ (`ar_customer`), ข้อมูลเจ้าหนี้ (`ap_supplier`), ผังบัญชี (`gl_chart_of_account`), รูปแบบเอกสาร (`erp_doc_format`) (`:840-846`) ตารางที่เกี่ยวข้อง: [[tbl-ic-inventory]], [[tbl-ic-unit]], [[tbl-ic-warehouse]], [[tbl-ar-customer]], [[tbl-ap-supplier]], [[tbl-gl-chart-of-account]], [[tbl-erp-doc-format]]
- ปุ่ม **เริ่มโอนข้อมูล** (`:889-896`) **ไม่เรียก API ใด ๆ** มีเพียง `setDone("ตรวจสอบและซิงค์ข้อมูลหลักจาก <ต้นทาง> ไปยัง <ปลายทาง> เรียบร้อย")` เท่านั้น ดังนั้นจอนี้ยังเป็นเพียงหน้าตา ไม่มีการคัดลอกข้อมูลจริง และไม่ตรวจว่าต้นทาง/ปลายทางต่างกันหรือไม่ได้เลือกชุดข้อมูลหรือเปล่า

## Popups
ไม่มี popup ใช้แถบข้อความ `err` / `done` เหนือฟอร์มเท่านั้น

## ที่มาในโค้ด
- `frontend/account/admin/screens/ExtraAdminScreens.tsx:618-696` — สร้างฐานข้อมูล
- `frontend/account/admin/screens/ExtraAdminScreens.tsx:698-810` — ตรวจสอบฐานข้อมูล (SQL ที่ `:735-741`)
- `frontend/account/admin/screens/ExtraAdminScreens.tsx:813-899` — โอนข้อมูล (ปุ่มที่ `:889-896`)
- `frontend/src/config/adminMenu.ts:88-137` — ตำแหน่งเมนู
- ดูเพิ่ม: [[scr-admin-console]] · [[scr-admin-permissions]] · [[screens-overview]]
