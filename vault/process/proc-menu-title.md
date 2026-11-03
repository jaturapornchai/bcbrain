---
title: "ชื่อเมนูจากไฟล์เมนู BC ฝังในไบนารี (Menu Title / bcMenu.json)"
tags: [process, menu, bcMenu, report-title, embedded]
aliases: ["bcMenu.json", "getMenuTextByName", "menu_title.go", "legacyMenuAliases", "removeMenuByVersion", "filterVisibleMenuNodes", "menuVersionTag", "MenuKey", "ชื่อเมนู", "หัวรายงานจากเมนู"]
sources: ["backend/internal/application/process/menu_title.go:11", "backend/internal/application/process/menu_title.go:20", "backend/internal/application/process/menu_title.go:28", "backend/internal/application/process/menu_title.go:46", "backend/internal/application/process/menu_title.go:67", "backend/internal/application/process/menu_title.go:91", "backend/internal/application/process/menu_title.go:105", "backend/internal/application/process/menu_title.go:125", "backend/internal/application/process/report_pdf.go:870", "backend/internal/application/process/bcMenu.json:1"]
---

# ชื่อเมนูจากไฟล์เมนู BC ฝังในไบนารี (Menu Title)

ไฟล์ `bcMenu.json` (ต้นไม้เมนูของ BC Account) ถูกฝังในไบนารีของ backend ด้วย `//go:embed` และมีฟังก์ชันเดียวที่ใช้งานจริงคือ `getMenuTextByName(menuKey)` ที่แปลงรหัสเมนู (เช่น `menu_ic_hidden_cost_process`) เป็นชื่อภาษาไทย ปัจจุบันใช้เติม "หัวรายงาน" ตอนสร้าง PDF เมื่อผู้เรียกไม่ส่งชื่อมา ดู [[proc-report-hierarchy-pdf]]

## ทำงานอย่างไร

### โครงไฟล์ `bcMenu.json`
- ต้นไม้ 9 กลุ่มบนสุด: `menu_setup` (เริ่มต้น), `menu_ic` (สินค้า), `menu_po` (ซื้อ), `menu_so` (ขาย), `menu_ap` (เจ้าหนี้), `menu_ar` (ลูกหนี้), `menu_cash_and_bank` (เงินสด/ธนาคาร), `menu_asset` (ค่าเสื่อม), `menu_general_ledger_main` (บัญชี) -- นับจากไฟล์จริง: 791 โหนด (709 ใบ), ชื่อ `name` ไม่ซ้ำกัน
- แต่ละโหนดมีฟิลด์ `name`, `text`, `icon`, `tag`, `owner`, `projects[]`, `children[]` (และฟิลด์อื่นอีกเล็กน้อย) และบางโหนดมี `section` แต่ struct ฝั่ง Go (`bcMenuNode` :13) อ่านเพียง `name`, `text`, `tag`, `children` ฟิลด์อื่นไม่ถูกใช้ในโค้ดส่วนนี้
- `tag` เป็นสตริงตัวกรองเวอร์ชัน/ชนิด เช่น `&1&&2&&12&&13&&3&` (ทั่วไป) หรือ `&fastreport&...`, `&gl&...`; มี `&hide&` เป็นโหนดซ่อน (3 โหนด: `menu_setup_other_income`, `Node9`, `Node10`)

### ขั้นตอนสร้างตารางชื่อ (`initMenuTextMap` :105, รันครั้งเดียวด้วย `sync.Once`)
1. แกะ JSON ฝัง (ผิดรูป = ตารางว่าง ไม่ error)
2. `removeMenuByVersion` (:46): ตัดโหนด `menu_singha_warehouse` และ `menu_so_pos` ทิ้ง; ตัดโหนดที่มี `tag` แต่ไม่มี `&13&` (ค่าคงที่ `menuVersionTag` :20) และไม่ใช่ `&hide&`; โหนดที่ `tag` ว่างคงไว้ -- ผลคือชุด "มีซ่อน" (`withHidden`)
3. `filterVisibleMenuNodes` (:67): จากชุดข้างบน ตัดโหนด `&hide&` และตัดกลุ่มที่ลูกทั้งหมดถูกซ่อนจนไม่เหลือ -- ผลคือชุด "มองเห็น"
4. `indexMenuText` (:91) ใส่ `name -> text` (trim ทั้งคู่) จากชุดมองเห็นก่อน แล้วชุดมีซ่อน โดยคีย์ที่มีแล้วไม่ถูกเขียนทับ (ชื่อจากชุดมองเห็นมาก่อน) โหนดซ่อนจึงยังหาชื่อเจอ
5. `legacyMenuAliases` (:28): ถ้ารหัสเมนูเก่ายังไม่มีในตาราง ให้ใช้ชื่อของรหัสใหม่ที่ map ไว้ 15 คู่ เช่น `menu_ic_weight_cost` -> `menu_ic_hidden_cost_process`, `menu_gl_balance` -> `menu_financial_statement`, `menu_setup_province_auto`/`menu_setup_ampher`/`menu_setup_tambon` -> `menu_setup_province`, `menu_ic_inventory` -> `menu_ic_item_detail`, `menu_ar_customer` -> `menu_ar_detail`, `menu_ap_supplier` -> `menu_ap_detail` (คอมเมนต์ :27 ระบุว่าสะท้อน `LEGACY_MENU_ALIASES` ใน `frontend/src/config/bcMenu.ts:201-217`)

### การค้นหา `getMenuTextByName` (:125)
trim รหัส; ว่าง = สตริงว่าง; หาแบบตรงตัวก่อน ไม่เจอลองตัวพิมพ์เล็ก ไม่เจอ = สตริงว่าง (คอมเมนต์ :124 ระบุว่าสะท้อน `getMenuTextByName` ใน `frontend/src/config/bcMenu.ts:242`)

### ใช้ที่ไหน
- `report_pdf.go:870`: ลำดับหัวรายงาน = `CustomTitle` -> `Title` -> ชื่อเมนูจาก `MenuKey` (หรือ `res.MenuKey`) -> ค่าตั้งต้น "รายงานระบบบัญชีและคลังสินค้า BC Account" แล้วแก้ข้อความ "รายงาน ภาษี" เป็น "รายงานภาษี"
- ค้นแล้วไม่พบผู้เรียกอื่นนอกไฟล์ทดสอบในโฟลเดอร์ `application/process` (ไม่ได้ค้นทั้ง repo นอกโฟลเดอร์นี้)

### ข้อควรระวัง
- เพิ่มเมนูใหม่แล้วชื่อไม่ขึ้นในหัวรายงาน: ตรวจว่าโหนดมี `&13&` ใน `tag` (ไม่งั้นถูก `removeMenuByVersion` ตัดทิ้ง) และต้อง build ใหม่เพราะไฟล์ฝังในไบนารี
- ไฟล์นี้ไม่ได้ควบคุมสิทธิ์เมนู (สิทธิ์จริงดู [[proc-permission-rights]])

## ที่มาในโค้ด
- `backend/internal/application/process/menu_title.go:10-20` - `go:embed`, `bcMenuNode`, `menuVersionTag`
- `backend/internal/application/process/menu_title.go:28-44` - `legacyMenuAliases`
- `backend/internal/application/process/menu_title.go:46-133` - ตัวกรอง, ตัวสร้างดัชนี, `getMenuTextByName`
- `backend/internal/application/process/report_pdf.go:870-884` - ใช้เป็นชื่อหัวรายงาน
- `backend/internal/application/process/bcMenu.json` - ต้นไม้เมนู

## ดูเพิ่ม
- [[proc-report-hierarchy-pdf]]
- [[proc-report-registry-conditions]]
- [[proc-permission-rights]]
- [[process-overview]]
