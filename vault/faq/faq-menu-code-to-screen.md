---
title: "รหัสเมนู (เช่น 2.1.7 หรือ 4013) คือหน้าจอไหน และระบบเปิดหน้าจอจากรหัสยังไง"
tags: [faq, menu, screen, navigation]
aliases: ["รหัสเมนู", "2.1.7 คืออะไร", "เมนู 4.13", "เมนู 1.1.12", "menu code", "legacyCode", "ป้ายเลขบนแท็บ", "เลขเมนูไม่ตรงกับคู่มือ", "bcMenu.json", "screenRegistry", "getMenuCodeByName", "หาหน้าจอจากเลขเมนู"]
sources: ["frontend/src/config/bcMenu.ts:44", "frontend/src/config/bcMenu.ts:101", "frontend/src/config/bcMenu.ts:182", "frontend/src/config/bcMenu.ts:276", "frontend/account/tabs/screenRegistry.tsx:1057", "frontend/account/tabs/screenRegistry.tsx:1067", "frontend/account/tabs/screenRegistry.tsx:1382", "frontend/account/tabs/TabWorkspace.tsx:1378", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:54", "frontend/src/config/schemas/masterDetailSchemas.ts:337"]
---
# รหัสเมนู (เช่น 2.1.7 หรือ 4013) คือหน้าจอไหน

**ตอบสั้น:** ทุกเมนูใบ (หน้าจอ) มีรหัส 2 แบบที่ระบบคำนวณจากไฟล์ `bcMenu.json` ตอนเริ่มโปรแกรม: รหัส 4 หลัก (`code`, เช่น 2007) และรหัสแบบจุด (`legacyCode`, เช่น 2.1.7) ทั้งคู่คือหน้าเดียวกัน — 2.1.7 = 2007 = "สินค้าชุด" (`menu_ic_item_set`) รหัสไม่ได้ตายตัว ถ้ามีเมนูถูกซ่อน/เพิ่ม เลขจะเลื่อน

## รายละเอียด
- หลักแรกของรหัส 4 หลักคือหมวดหลัก (1 เริ่มต้น, 2 สินค้า, 3 ซื้อ, 4 ขาย, 5 เจ้าหนี้, 6 ลูกหนี้, 7 เงินสด/ธนาคาร, 8 ค่าเสื่อม, 9 บัญชี) ส่วน 3 หลักท้ายคือลำดับเมนูใบภายในหมวดนั้น นับต่อเนื่องข้ามโฟลเดอร์ย่อย (`bcMenu.ts:101-124`); รหัสแบบจุดคือตำแหน่งในต้นไม้เมนู ส่วนโฟลเดอร์มีรหัสเป็นช่วง เช่น 1106-1109 (`:112-119`)
- ก่อนนับ ระบบตัดเมนูที่ไม่อยู่ในเวอร์ชัน (`tag` ไม่มี `&13&`) และเมนูที่ติด `&hide&` ออกก่อน แล้วค่อยนับใหม่ (`bcMenu.ts:44-71`, `:140-168`, `:182-184`) จึงเลขขึ้นกับเมนูที่มองเห็นจริง ส่วนเมนูที่ติด `&hide&` ไม่อยู่ในแถบเมนู แต่ยังค้นด้วยชื่อได้และมีรหัสจากการนับก่อนซ่อน (`bcMenu.ts:178-180`, `:197-198`)
- ตัวอย่างที่คำนวณได้ตามเมนูปัจจุบัน:

| จุด | รหัส 4 หลัก | หน้าจอ (`name`) |
|---|---|---|
| 1.1.1 / 1.1.2 | 1001 / 1002 | กำหนดรายละเอียดบริษัท / กำหนดข้อเลือกพิเศษต่างๆ (`menu_company_profile` / `menu_option`) |
| 1.1.12 | 1012 | กำหนดรูปแบบเลขที่เอกสาร (`menu_setup_doc_format`) |
| 1.9 / 1.10 | 1093 / 1094 | สร้าง/แก้ไขแบบฟอร์ม / ออกแบบรายงาน |
| 1.12.1 | 1106 | เปลี่ยนรหัสสินค้า (`menu_change_code_item`) |
| 2.1.1 / 2.1.7 | 2001 / 2007 | ข้อมูลสินค้า / สินค้าชุด |
| 3.1 / 3.3 / 3.11 | 3001 / 3003 / 3011 | ใบเสนอซื้อ (PR) / ใบสั่งซื้อ (PO) / ซื้อสินค้า-ตั้งหนี้ซื้อ |
| 4.1 / 4.13 / 4.14 | 4001 / 4013 / 4014 | ใบเสนอราคาขาย / ขายสินค้า-บริการ / รับคืน-ลดหนี้ขาย |
| 6.1.1 / 6.9 | 6001 / 6019 | กำหนดลูกหนี้ / รับชำระหนี้-ออกใบเสร็จ |
| 9.1.1 | 9001 | รายละเอียดผังบัญชี (`menu_chart_of_account`) |

- จากชื่อเมนู (`name`) ไปเป็นหน้าจอ: `registerAllMenus` เดินเมนูใบทุกตัวแล้วสร้างหน้าจอ (`screenRegistry.tsx:1382-1402`) โดยเลือกตามลำดับ — หน้าจอที่ลงทะเบียนเองใน `BASE_SCREENS` → หน้าจอข้อมูลหลัก (`IC_MASTER_CONFIGS`, `:1012-1019`) → เอกสารใน `TRANS_MENU_MAP` (`frontend/account/tabs/transMenuMap.ts`) (`:1025`, `:1076`) → หน้าจอประมวลผล (`:1105`+) → ที่เหลือตกไปเป็นหน้ารายงานตามหมวด (`:1330-1372`)
- เมนูกระบวนการที่ยังไม่มีหน้าจอจะตกไปหน้า placeholder (`screenRegistry.tsx:1115-1118`) แต่รายการเมนูที่ใช้หน้านี้ใน `SystemProcessWorkbenchScreen.tsx:54` ตอนนี้ว่าง จึงไม่มีเมนูใดตกมาหน้านี้
- เลขเมนูปรากฏเป็นป้ายบนแท็บ (`TabWorkspace.tsx:1378-1388`) และหัวหน้าจอเอกสาร (`UniversalTransScreen.tsx:3182-3184`) ใช้ `getMenuCodeByName(name, fallback)` (`bcMenu.ts:276`)
- ตัวอย่างหน้าจอ 2007: ข้อมูลสินค้าชุดอยู่ที่ `ic_inventory` เงื่อนไข `item_type = 3` (`masterDetailSchemas.ts:337-346`)

## ข้อควรระวัง
- รหัสฝังเก่าในโค้ดไม่ตรงรหัสที่คำนวณ: schema สินค้าชุดเขียน `menuCode: "2.1.17"` (`masterDetailSchemas.ts:339`) และ `BASE_SCREENS` ใส่ "1.12"/"1.13" ให้แบบฟอร์ม/ออกแบบรายงาน (`screenRegistry.tsx:192-212`) แต่ถูกทับด้วยรหัสที่คำนวณ (`:1057-1060`) — เลขในตำราเก่าจึงอาจไม่ตรง ให้ยึดเลขที่เห็นบนแท็บ
- อย่าฝังเลขเมนูไว้ในเอกสาร/สคริปต์ ให้อ้างด้วยชื่อ `name`

## ดูเพิ่ม
- [[fe-screen-registry-menu]]
- [[fe-tabs-workspace]]
- [[proc-menu-title]]
- [[faq-print-document-form]]
- [[faq-doc-number-format]]
- [[faq-new-company-setup]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.ts:44-71`, `:101-124`, `:140-168`, `:178-184`, `:276-278`
- `frontend/src/config/bcMenu.json` (ชื่อ/ลำดับเมนู)
- `frontend/account/tabs/screenRegistry.tsx:1012-1019`, `:1057-1060`, `:1067-1076`, `:1115-1118`, `:1330-1372`, `:1382-1402`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:54` รายการเมนูที่ใช้หน้า placeholder (ว่าง)
- `frontend/account/tabs/TabWorkspace.tsx:1378-1388`
- `frontend/account/transaction/UniversalTransScreen.tsx:3182-3184`
- `frontend/src/config/schemas/masterDetailSchemas.ts:337-346`
