---
title: "เพิ่มจอข้อมูลหลัก (master) ใหม่ต้องแก้ที่ไหนบ้าง และทำไมผู้ใช้ทั่วไปบันทึกไม่ได้"
tags: [faq, master, screen, dev, frontend, backend, troubleshooting]
aliases: ["เพิ่มจอ master", "เพิ่มข้อมูลหลักใหม่", "IC_MASTER_CONFIGS", "MasterScreenConfig", "StandardMasterScreen config", "MASTER_DETAIL_CONFIGS", "mdSpecs", "legacyClientWritable เพิ่มตาราง", "master-detail/save", "เพิ่มจอตั้งค่า"]
sources: ["frontend/src/config/schemas/icMasterSchemas.ts:18", "frontend/src/config/schemas/icMasterSchemas.ts:118", "frontend/account/tabs/screenRegistry.tsx:152", "frontend/account/tabs/screenRegistry.tsx:1013", "frontend/account/master/StandardMasterScreen.tsx:653", "backend/internal/application/process/master_detail_specs.go:144"]
---
# เพิ่มจอข้อมูลหลัก (master) ใหม่ต้องแก้ที่ไหนบ้าง และทำไมผู้ใช้ทั่วไปบันทึกไม่ได้

**ตอบสั้น:** จอข้อมูลหลักแบบตารางเดียว (รหัส + ชื่อ + ช่องเสริม) ไม่ต้องเขียน component — เพิ่ม config 1 ก้อนใน `IC_MASTER_CONFIGS` แล้ว `StandardMasterScreen` วาดให้ แต่จอนี้เขียน DB ด้วย SQL ผ่าน `/query/exec` จึงต้องเพิ่มชื่อตารางใน allow-list `legacyClientWritable` ของ backend ด้วย มิฉะนั้นผู้ใช้ level ต่ำกว่า 9 จะได้ 403 ส่วนจอหัว-รายการหลายตารางต้องมี spec ฝั่ง Go (`mdSpecs`) เพราะบันทึกผ่าน `/process/master-detail/save`

## รายละเอียด
**แบบ A — ตารางเดียว (`StandardMasterScreen`):**
1. เพิ่มรายการใน `IC_MASTER_CONFIGS` (`icMasterSchemas.ts:118`) key = ชื่อเมนู (`menuKey`) ฟิลด์หลักของ `MasterScreenConfig` (`:18`): `tableName`, `idKey` (ค่าเริ่ม `code`), `nameKey` (ค่าเริ่ม `name_1`), `noName2` (ตารางไม่มี `name_2`), `showStatus`/`hideStatus`, `extraFields`, `parentFilter` (ต้องเลือกกลุ่มแม่ก่อน), `fixedValues` (ตารางใช้ร่วมกัน เช่น แยกลูกหนี้/เจ้าหนี้ด้วยคอลัมน์ชนิด), `rowKey` (กรณีรหัสซ้ำได้), `fkChecks` (นับการใช้งานก่อนลบ)
2. `screenRegistry.tsx:1013` วนทุก key ใน `IC_MASTER_CONFIGS` ลงทะเบียนจออัตโนมัติ (`createMasterScreen` `:152` เลือก `MasterDetailScreen` ถ้ามี `detail` ไม่งั้น `StandardMasterScreen`) ชื่อและรหัสเมนูถูกทับด้วยค่าใน `bcMenu.json` (`getMenuTextByName/getMenuCodeByName`) ถ้าต้องการให้เปิดจากเมนู ให้มีใบเมนูที่ `name` ตรง `menuKey`
3. **เพิ่มชื่อตารางใน `legacyClientWritable`** — `StandardMasterScreen` ทำ `insert`/`update` ด้วย `queryExec` (`StandardMasterScreen.tsx:653`, `:681`) ผ่าน `/query/exec` ซึ่งตาม ADR-0011 ผู้ใช้ level < 9 เขียนได้เฉพาะตารางในรายการนี้ ([[faq-query-exec-write-blocked]]) ตารางเงิน/สต็อก/GL ห้ามใส่ — ต้องทำ endpoint ใน `/process` แทน
4. **สิทธิ์** — ไม่ต้องเพิ่มอะไร: `QueryRequiredRight` แปลงคำกริยา SQL เป็น Add/Edit/Delete ให้เอง ([[faq-menu-permission-denied]])

**แบบ B — หัว + ตารางย่อย (`MasterDetailScreen`):**
1. ฝั่งเว็บ เพิ่ม config ใน `MASTER_DETAIL_CONFIGS` (`masterDetailSchemas.ts:334` ซึ่งถูก spread เข้า `IC_MASTER_CONFIGS` ที่ `icMasterSchemas.ts:1416`) ต้องมี `detail` มิฉะนั้นจอ throw
2. ฝั่ง Go เพิ่ม `mdSpec` ใน `mdSpecs` (`master_detail_specs.go:144`) ระบุตารางหัว คอลัมน์ที่อนุญาต ตารางย่อย (`mdGrid`) และการตรวจอ้างอิง — ชื่อ key/คอลัมน์ฝั่งเว็บต้องตรง whitelist นี้ เมนูที่ไม่อยู่ใน `mdSpecs` ได้ "ไม่รู้จักเมนู" (`master_detail.go:138`)
3. `master-detail/save` (write) และ `master-detail/delete` (del) อยู่ใน `routeRights` แล้ว และ proxy Next รองรับ `save`/`delete` แล้ว (`master-detail/[action]/route.ts:12`) จึงไม่ต้องแก้สองจุดนี้ ([[faq-process-engine-dispatcher]])

**เมื่อผู้ใช้ level ต่ำบันทึกไม่ได้:** ดูข้อความ 403 — "ไม่มีสิทธิ์เพิ่ม/แก้ไข" คือสิทธิ์เมนู ส่วนข้อความตารางเงิน/สต็อก/GL หรือเฉพาะผู้ดูแลระบบคือ write policy ที่ตารางไม่อยู่ใน allow-list

## ข้อควรระวัง
- `StandardMasterScreen` ประกอบ SQL เป็นสตริงฝั่งเบราว์เซอร์ และ `tableName` มาจาก config ห้ามรับชื่อตารางจากข้อมูลผู้ใช้
- รหัสลูกหนี้/เจ้าหนี้อัตโนมัติและรหัสตามรูปแบบเอกสารมี endpoint แยก (`master/nextcode`, `master/codeleave`) ไม่ได้อยู่ใน config ([[faq-doc-number-format]])
- ถ้าตารางนั้นแปลงเป็น `/process` ภายหลัง ต้องลบชื่อออกจาก `legacyClientWritable` (คอมเมนต์ในไฟล์ระบุ "Remove a name the day its screen moves to Go")
- เปลี่ยนรหัสหลักที่ถูกอ้างอิงแล้วมีผลต่อเอกสารเก่า ดู [[faq-change-master-code]]

## ดูเพิ่ม
- [[fe-standard-master-screen]]
- [[fe-master-screens]]
- [[proc-master-data]]
- [[faq-query-exec-write-blocked]]
- [[faq-process-engine-dispatcher]]
- [[faq-menu-permission-denied]]

## ที่มาในโค้ด
- `frontend/src/config/schemas/icMasterSchemas.ts:18` `MasterScreenConfig` และ `:118` `IC_MASTER_CONFIGS` (spread `MASTER_DETAIL_CONFIGS` บรรทัด 1416)
- `frontend/account/tabs/screenRegistry.tsx:152` `createMasterScreen` และ `:1013` ลูปลงทะเบียน
- `frontend/account/master/StandardMasterScreen.tsx:653` `queryExec(insertSql)` (update ที่บรรทัด 681, `findFkUse` บรรทัด 698)
- `backend/internal/application/process/master_detail_specs.go:144` `mdSpecs` (spec ตัวอย่าง `menu_setup_user_group` บรรทัด 332)
- `backend/internal/application/process/master_detail.go:138` "ไม่รู้จักเมนู"
- `frontend/src/app/api/process/master-detail/[action]/route.ts:12` `ACTIONS = save, delete`
