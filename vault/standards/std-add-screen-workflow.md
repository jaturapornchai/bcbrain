---
title: "ขั้นตอนเพิ่มหน้าจอใน BC: bcMenu.json -> screenRegistry -> Schema -> Backend (Add Screen Workflow)"
tags: [standards, frontend, backend, menu, schema, workflow]
aliases: ["เพิ่มหน้าจอใหม่", "screenRegistry", "bcMenu.json", "IC_MASTER_CONFIGS", "MASTER_DETAIL_CONFIGS", "TRANS_MENU_MAP", "buildDynamicScreen", "registerAllMenus", "โฟลว์สืบค้นเมนูและหน้าจอ", "menuKey", "mdSpecs", "add screen"]
sources: ["AGENTS.md:43", "AGENTS.md:44", "AGENTS.md:49", "AGENTS.md:51", "AGENTS.md:56", "docs/kms/KMS_AGENTS_RULES_FULL.md:29-31", ".agents/skills/bc-screen-schema-deep-inspect/SKILL.md:11-13", ".agents/skills/bc-screen-schema-deep-inspect/SKILL.md:28", "frontend/src/config/bcMenu.json:25", "frontend/src/config/bcMenu.ts:12", "frontend/src/config/bcMenu.ts:36", "frontend/src/config/bcMenu.ts:44", "frontend/src/config/bcMenu.ts:101", "frontend/src/config/bcMenu.ts:111", "frontend/src/config/bcMenu.ts:182", "frontend/src/config/bcMenu.ts:315", "frontend/account/tabs/screenRegistry.tsx:152-164", "frontend/account/tabs/screenRegistry.tsx:191", "frontend/account/tabs/screenRegistry.tsx:1013", "frontend/account/tabs/screenRegistry.tsx:1025", "frontend/account/tabs/screenRegistry.tsx:1067", "frontend/account/tabs/screenRegistry.tsx:1075", "frontend/account/tabs/screenRegistry.tsx:1382", "frontend/account/tabs/screenRegistry.tsx:1421", "frontend/account/tabs/screenRegistry.tsx:1423", "frontend/account/tabs/transMenuMap.ts:1", "frontend/src/config/schemas/icMasterSchemas.ts:4", "frontend/src/config/schemas/icMasterSchemas.ts:13", "frontend/src/config/schemas/icMasterSchemas.ts:18", "frontend/src/config/schemas/icMasterSchemas.ts:1416", "frontend/src/config/schemas/masterDetailSchemas.ts:335", "frontend/tsconfig.json:46", "frontend/tsconfig.json:47", "backend/internal/application/process/menu_title.go:10", "backend/internal/application/process/report_pdf.go:879", "backend/internal/application/process/master_detail_specs.go:144", "backend/internal/application/process/master_detail.go:135", "backend/internal/adapter/inbound/http/router.go:90-103", "backend/internal/adapter/inbound/http/router.go:136", "backend/internal/adapter/inbound/http/router.go:154", "backend/internal/adapter/inbound/http/router.go:163"]
---

# ขั้นตอนเพิ่มหน้าจอใน BC

กฎข้อ 5 ของ `AGENTS.md:43` บอกว่าการหาหน้าจอไล่จาก `bcMenu.json` ไป `screenRegistry.tsx` แล้วถึง Schema/Component คู่กับ `backend/internal/application/process/` — โน้ตนี้ไล่ตามโค้ดจริงว่าแต่ละขั้นทำอะไร และจอแต่ละชนิดต้องแก้ไฟล์ไหนบ้าง

## แผนผังเส้นทาง
```
bcMenu.json (menuKey = "name")
   -> frontend/src/config/bcMenu.ts (กรองรุ่น, ใส่รหัสเมนู)
   -> frontend/account/tabs/screenRegistry.tsx (SCREENS[menuKey])
        ├─ IC_MASTER_CONFIGS        -> StandardMasterScreen / MasterDetailScreen
        ├─ TRANS_MENU_MAP           -> UniversalTransScreen (mode doc | cancel | approve)
        ├─ createReportScreen(...)  -> UniversalReportScreen
        └─ จอเฉพาะ (process/POS ฯลฯ) -> component ตรง
   -> backend/internal/application/process/ (บันทึก/ตรวจกฎจริง)
```

## ขั้น 1 — เพิ่มเมนูใน `bcMenu.json`
- ไฟล์หลักคือ `frontend/src/config/bcMenu.json` แต่ละโหนดมี `name` (เป็น `menuKey` เช่น `menu_company_profile`), `text` (ชื่อไทย), `tag`, `children` และ `section` (หัวข้อกลุ่มเมนู ดู [[std-menu-workflow-cancel-lookup]]); ชนิดของโหนดประกาศที่ `bcMenu.ts:12`
- โหนดที่ไม่มี `children` คือ "หน้าจอ" (leaf)
- `removeByVersion` (`bcMenu.ts:44`) ทิ้งโหนดที่มี `tag` ไม่ว่างแต่ไม่มี `&13&` (`MENU_VERSION_TAG`, `:36`) และไม่ใช่ `&hide&` จอที่เพิ่มจึงควรไม่มี `tag` หรือมี `&13&`
- รหัสเมนู **ไม่ต้องกรอกเอง**: `assignMenuCodes` (`bcMenu.ts:101`) ให้เลขสี่หลัก = หลักแรกคือลำดับหมวดหลัก + เลขลำดับ leaf สามหลักในหมวดนั้น (`:111`) ดังนั้นการแทรกเมนูกลางหมวดทำให้รหัสของ leaf ที่ตามหลังเลื่อนไป
- มีสำเนาที่สองที่ `backend/internal/application/process/bcMenu.json` ฝังเข้า binary (`menu_title.go:10`) เพื่อแปลง `menuKey` เป็นชื่อหัวรายงาน PDF (`report_pdf.go:879`) — จอที่ออกรายงานต้องเพิ่มสองที่ ตอนตรวจ (นับ leaf) สำเนาฝั่ง frontend มี `menu_setup_Allocate` เกินมา 1 รายการ แปลว่าสองไฟล์ไม่ได้ซิงค์กันอัตโนมัติ
- เมนูที่จำกัดเฉพาะผู้ดูแลต้องเพิ่มชื่อใน `ADMIN_ONLY_MENU_SET` (`bcMenu.ts:315`)

## ขั้น 2 — ลงทะเบียนใน `tabs/screenRegistry.tsx`
- `BASE_SCREENS` (`:191`) เริ่มจากจอเฉพาะที่เขียนมือ แล้วเติมตามลำดับ: ทุกคีย์ของ `IC_MASTER_CONFIGS` (`:1013`) → ทุกคีย์ของ `TRANS_MENU_MAP` (`:1025`)
- `registerAllMenus` (`:1382`, เรียกที่ `:1421`) เดินทุก leaf ของเมนู ถ้า `menuKey` ยังไม่อยู่ใน `BASE_SCREENS` จะเรียก `buildDynamicScreen` (`:1067`) ซึ่งเช็ก `TRANS_MENU_MAP` ก่อนเสมอ (`:1075`) แล้วตามด้วยเงื่อนไขของจอกระบวนการ/เครื่องมือ และท้ายสุดจัดเป็นจอรายงานตามหมวดหลัก
- ผลลัพธ์ส่งออกเป็น `SCREENS` (`:1423`) และ `hasScreen(menuName)`
- เมนูกระบวนการบางตัวที่ยังไม่มีหน้าจอจริงจะได้หน้าแจ้งสถานะ ไม่ใช่จอผิดตัว (`NOT_PORTED_PROCESS_MENUS` ใน `buildDynamicScreen`) — เพิ่มจอจริงแล้วต้องเอา `menuKey` ออกจากชุดนี้

## ขั้น 3 — เลือก Schema ตามชนิดจอ
| ชนิดจอ | ที่ประกาศ | Component |
|---|---|---|
| Master เดี่ยว (ตารางเดียว) | `IC_MASTER_CONFIGS[menuKey]` ใน `frontend/src/config/schemas/icMasterSchemas.ts` — ชนิด `MasterScreenConfig` (`:18`) และช่อง `MasterFieldDef` (`:4`: `name`, `label`, `type`, `colSpan` 6/12, `lookupTable`, ...) | `StandardMasterScreen` |
| Master + ตารางย่อย | `MASTER_DETAIL_CONFIGS` ใน `masterDetailSchemas.ts:335` (ถูก spread เข้า `IC_MASTER_CONFIGS` ที่ `icMasterSchemas.ts:1416`) ใส่ `detail` | `MasterDetailScreen` |
| ธุรกรรมเอกสาร | `TRANS_MENU_MAP[menuKey]` ใน `frontend/account/tabs/transMenuMap.ts` (`mode: "doc" \| "cancel" \| "approve"`, `:1`) | `UniversalTransScreen` (cancel/approve ส่งต่อ `UniversalCancelConfirmScreen`) |
| รายงาน | `UniversalWorkbenchConfig` ผ่าน `createReportScreen` — ดู [[std-report-engine-standard]] | `UniversalReportScreen` |
- การวางช่อง: `colSpan: 12` เต็มบรรทัด, `6` ครึ่งบรรทัด (`icMasterSchemas.ts:13`); โครงหัวจอ/Toolbar ดู [[std-screen-header-toolbar-theme]] ชนิดช่องกรอกดู [[std-input-controls-and-labels]]
- alias ของ import: `@/components/*` ชี้ `./account/*` (`tsconfig.json:46`) และ `@/*` ชี้ `./src/*` (`:47`) — `@/config/schemas/...` จึงเป็น `frontend/src/config/schemas/...` ส่วน `@/components/master/StandardMasterScreen` เป็น `frontend/account/master/StandardMasterScreen.tsx`

## ขั้น 4 — ฝั่ง Backend (กฎข้อ 10: Frontend เป็น thin client)
- `AGENTS.md:51`: Go backend คุม validation, transaction, เงิน/ภาษี/สต็อก/ต้นทุน/GL ส่วน Frontend แสดงผลและเรียก API
- Master + ตารางย่อย: `POST …/master-detail/{action}` (`router.go:154`) ต้องมี `menuKey` ใน `mdSpecs` (`master_detail_specs.go:144`) ถ้าไม่มี `MasterDetailSave` (`master_detail.go:135`) ตอบ error "ไม่รู้จักเมนู" — เพิ่ม Schema ฝั่ง frontend อย่างเดียวไม่พอ
- ธุรกรรมเอกสาร: `POST …/doc/save` (`router.go:136`) และ `…/doc/cancel` / `…/doc/approve` ดู [[std-menu-workflow-cancel-lookup]]
- Master ที่ใช้ช่วยออกรหัส/ตรวจรหัส: `POST …/master/{action}` (`router.go:163`) เช่น `nextcode`, `codeleave`
- Master เดี่ยวใน `StandardMasterScreen` อ่าน/เขียนผ่าน `/query/list|limit|exec|execBatch` (`router.go:90-103`) โดยกลุ่ม `exec`/`execBatch` ผ่านตัวกันสิทธิ์เขียน (`queryWriteGuard`) — เรื่องสิทธิ์/ความปลอดภัยของช่องทางนี้ดู [[std-security-authz-and-web-vulns]]

## เช็กลิสต์ก่อนบอกว่าเสร็จ
1. หน้าจอธุรกรรมต้องครบส่วนหัว ตารางสินค้า GL ภาษี การชำระเงิน ข้อมูลเพิ่มเติม ตามคอลัมน์ใน `information_schema.columns` ของ `bcdemo` (กฎข้อ 8, `AGENTS.md:49`) ชื่อตาราง/คอลัมน์ใหม่ต้องตามกฎใน [[std-pgsql-naming-convention]]
2. ห้ามยุบตารางหลายตัวเป็นแท็บเอง/ห้ามเปลี่ยนผังเดิม (กฎข้อ 6, `AGENTS.md:44`)
3. เพิ่มคอลัมน์/ตารางด้วย `ALTER TABLE … ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` (`SKILL.md:28` ของ `bc-screen-schema-deep-inspect`) และอ่านเขียนข้อความไทยตามขั้นตอนใน [[std-thai-safe-db-write]]
4. ตรวจไฟล์/DB/Build จริงแล้วส่ง UAT ซ้ำเสมอ (กฎข้อ 15 `AGENTS.md:56`, ดู [[std-uat-issuemate-workflow]])

## เอกสารที่ชี้ path ผิด (ตรวจแล้ว)
- `AGENTS.md:43`, `KMS_AGENTS_RULES_FULL.md:30` และ `bc-screen-schema-deep-inspect/SKILL.md:13` เขียน `frontend/account/screenRegistry.tsx` — ไฟล์ที่มีจริงคือ `frontend/account/tabs/screenRegistry.tsx`
- `KMS_INDEX` และ `AGENTS.md:21` อ้างเอกสารมาตรฐานหน้าจอแยกอีกไฟล์ ซึ่งมีเนื้อหาแค่ข้อ UAT และ Workspace Isolation ไม่ใช่ขั้นตอนเพิ่มหน้าจอ จึงไม่ใช้เป็นแหล่งอ้างอิงในโน้ตนี้

## ที่มา
- `AGENTS.md:43`, `:44`, `:49`, `:51`, `:56` กฎข้อ 5, 6, 8, 10, 15
- `docs/kms/KMS_AGENTS_RULES_FULL.md:29-31` ข้อ 5
- `.agents/skills/bc-screen-schema-deep-inspect/SKILL.md:11-13`, `:28`
- โค้ดตามรายการ `sources` (ตรวจแล้วมีจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-screen-header-toolbar-theme]] · [[std-menu-workflow-cancel-lookup]] · [[std-input-controls-and-labels]] · [[std-report-engine-standard]] · [[frontend-overview]] · [[process-overview]]
