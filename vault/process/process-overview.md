---
title: "ภาพรวมกลุ่ม process ของ Backend (Process overview)"
tags: [process, overview, hub, backend, router, handler]
aliases: ["process-overview", "ภาพรวม process", "application/process", "process hub", "กลุ่มงาน process"]
sources: ["backend/internal/adapter/inbound/http/router.go:40", "backend/internal/adapter/inbound/http/router.go:127", "backend/internal/adapter/inbound/http/router.go:168", "backend/internal/adapter/inbound/http/router.go:328", "backend/internal/adapter/inbound/http/process/permission.go:24", "backend/internal/application/process/menu_title.go:10"]
---

# ภาพรวมกลุ่ม process ของ Backend

โฟลเดอร์ `backend/internal/application/process/` คือชั้น `Service` ของงานที่ไม่ใช่รายการบัญชีหลัก ได้แก่ รายงาน, เอกสารและตารางสินค้า, ข้อมูลหลัก, ราคา/บาร์โค้ด, เครื่องมือสต็อกและระบบ, workflow, ผู้ช่วย AI และ POS โน้ตในโฟลเดอร์นี้ครอบคลุมเฉพาะกลุ่มที่ไม่ใช่บัญชี (กลุ่ม `trans`, `gl`, `stock`, `cost`, `ap`, `pay`, `cheque`, `fx`, `fa`, `period` ฯลฯ อยู่ในโน้ตของส่วนบัญชี ดู [[accounting-overview]]) ภาพรวมระบบ backend ทั้งหมดดู [[backend-overview]]

## ทำงานอย่างไร

### เส้นทางคำขอ: request -> dispatch -> handler -> service
1. ในโค้ดไม่มีไฟล์ `process.go` เป็นตัวกระจายกลาง การกระจายคำขอแบ่งเป็น 2 ชั้นคือ route group ใน `router.go` และ `*_handler.go` ใน `adapter/inbound/http/process/` (รายละเอียด [[proc-dispatcher]])
2. `router.go` ลงทะเบียน `/process` (:127-167) และ `/api/v1/process` (:168-209) เป็นชุดเดียวกัน ผ่าน middleware `Auth` (JWT) แล้ว `RequireRight(ex.Rights, processhttp.RequiredRight)` ตรวจสิทธิ์เมนูก่อนถึง handler (ดู [[proc-permission-rights]])
3. handler ถอด JSON เข้า struct ใส่ `ProviderCode` / `DatabaseName` / ผู้ใช้จาก token (ฟิลด์เหล่านี้ `json:"-"` ไม่รับจาก body) แล้วเรียก `Service`
4. `Service` ขอ connection pool ของบริษัทผ่าน `companyPool(ctx, providerCode, databaseName)` (ระบบหลายบริษัท) แล้วทำงานกับฐานข้อมูลของบริษัทนั้น
5. กลุ่ม POS แยกอีกชุดที่ `/api/v1/pos/*` (`router.go:328-348`) ใช้การยืนยันตัวตนแบบ token ของเครื่อง POS หรือ token ผู้ใช้ (ดู [[proc-pos-sync]])

### แผนที่โน้ตทั้งหมดในหมวดนี้

#### ตัวกระจายและสิทธิ์
- [[proc-dispatcher]] - route group, ตาราง action ของแต่ละกลุ่ม, ตัวช่วย `serve`, ขนาด body
- [[proc-permission-rights]] - `routeRights` และ `RequiredRight` แปลง route เป็นสิทธิ์เมนู (route ที่ไม่รู้จักถือเป็นสิทธิ์ผู้ดูแล)
- [[proc-wh-shelf-permission]] - สิทธิ์คลัง/ที่เก็บรายกลุ่มผู้ใช้ (`perm_wh_shelf`)
- [[proc-menu-title]] - `bcMenu.json` ฝังในไบนารี ใช้หาชื่อเมนูไทยเติมหัวรายงาน

#### รายงาน
- [[proc-report-engine]] - `RunReport` เครื่องมือรายงานฝั่ง backend
- [[proc-report-registry-conditions]] - ทะเบียนรายงานรายเมนูและเงื่อนไขกรอง
- [[proc-report-custom-sql-template]] - SQL กำหนดเองและเทมเพลตรายงาน
- [[proc-report-hierarchy-pdf]] - จัดกลุ่มหลายระดับและพิมพ์ PDF (ฟอนต์ไทยฝังในไบนารี)

#### เอกสารและตารางสินค้า
- [[proc-save-doc]] - `doc/save`, `doc/delete`, `doc/bills` สำหรับ `ap_ar_trans` / `gl_journal` และรายการหนี้ค้างชำระ
- [[proc-doc-cancel-approve]] - ยกเลิกและอนุมัติเอกสาร
- [[proc-doc-flow-numbering]] - สถานะต่อเนื่องของเอกสาร กราฟโยงเอกสาร เลขที่เอกสารถัดไป
- [[proc-doc-item-pictures]] - แนบรูปเอกสารและรูปสินค้า
- [[proc-grid-calc]] - `transgrid` คำนวณแถว สูตรลัด ยอดรวม นำเข้าอ้างอิง
- [[proc-lookup-filters]] - ตัวกรองหน้าค้นหา (คู่ค้า, เอกสารอ้างอิง, คลัง, สินค้าถูกกัน)

#### ข้อมูลหลัก ราคา บาร์โค้ด
- [[proc-master-data]] - ข้อมูลหลักแบบหัว-รายการ (รวมงวดบัญชี สูตรโปรโมชัน POS แคมเปญท้ายใบเสร็จ) รหัสอัตโนมัติ เลย์เอาต์ DataList
- [[proc-item-master-detail]] - ข้อมูลสินค้าและข้อมูลสินค้าเพิ่มเติม
- [[proc-price-engine]] - เครื่องมือหาราคา ศูนย์ราคา และแก้ราคา (`modifyprice`)
- [[proc-barcode]] - บาร์โค้ดสินค้า ส่วนลดบาร์โค้ด EAN13 พิมพ์ป้าย

#### เครื่องมือสต็อกและระบบ
- [[proc-stock-tools]] - กลุ่ม `stocktools` (ตรวจบาร์โค้ด, ซีเรียล, ล็อต, ยอดยกมา, ฯลฯ)
- [[proc-hidden-cost]] - ต้นทุนแฝง เฉลี่ยค่าใช้จ่ายเข้าสินค้า
- [[proc-sysproc-tools]] - ตรวจ `ic_trans`, คำนวณแต้มใหม่, นำเข้าที่อยู่จัดส่ง
- [[proc-change-code]] - เปลี่ยนรหัสหลัก สินค้า/ลูกหนี้/เจ้าหนี้/ผังบัญชี
- [[proc-province-load]] - โหลดจังหวัด/อำเภอ/ตำบลมาตรฐาน
- [[proc-workflow]] - กลุ่ม `workflow` (เมนูกระบวนการระบบ)
- [[proc-ai-copilot]] - ผู้ช่วย AI แบบกฎคำนวณ `ai-*` 6 ตัว

#### POS
- [[proc-pos-sync]] - ผูกเครื่อง ดึงส่วนต่างข้อมูล กู้คืน รูปภาพ
- [[proc-pos-bill]] - กล่องรับบิลขาย ประมวลผลเป็น flag 44, ยกเลิก, ตัดสต็อกเป็นชุด
- [[proc-pos-config-shift]] - ตั้งค่าร้าน/เครื่อง/โปรโมชัน และกะขาย รับ-ส่งเงิน

### ลำดับอ่านที่แนะนำ
- เข้าใจโครงก่อน: [[proc-dispatcher]] -> [[proc-permission-rights]]
- งานเอกสาร: [[proc-save-doc]] -> [[proc-doc-flow-numbering]] -> [[proc-doc-cancel-approve]] -> [[proc-grid-calc]]
- งานรายงาน: [[proc-report-engine]] -> [[proc-report-registry-conditions]] -> [[proc-report-hierarchy-pdf]]
- งาน POS: [[proc-pos-sync]] -> [[proc-pos-bill]] -> [[proc-pos-config-shift]]

### ขอบเขตที่ยังไม่ครอบคลุม (ยังไม่ยืนยัน)
- ไฟล์ `uat*` มีเฉพาะไฟล์ทดสอบ (`uat_s1_fixes_test.go`) จึงไม่มีโน้ต
- ตัวฟังก์ชัน `report_menu_*` และ `service.go` อ่านเฉพาะส่วนที่เกี่ยวกับโน้ตแต่ละเรื่อง ไม่ได้อ่านครบทุกบรรทัด
- ไฟล์ `docs.go` เขียนเฉพาะกลไก ส่วนรายละเอียดบัญชีของ `ap_ar_trans` / `gl_journal` ดู [[accounting-overview]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/router.go:40-57` - `ExtraHandlers` ของ process
- `backend/internal/adapter/inbound/http/router.go:127-209` - route group `/process` และ `/api/v1/process`
- `backend/internal/adapter/inbound/http/router.go:328-348` - route กลุ่ม POS
- `backend/internal/adapter/inbound/http/process/permission.go:20-24` - ตารางสิทธิ์ `routeRights`
- `backend/internal/application/process/menu_title.go:10` - ไฟล์เมนูที่ฝังในไบนารี

## ดูเพิ่ม
- [[index]]
- [[backend-overview]]
- [[accounting-overview]]
- [[frontend-overview]]
- [[standards-overview]]
