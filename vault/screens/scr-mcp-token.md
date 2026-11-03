---
title: "จัดการ MCP Token เชื่อมต่อ AI ภายนอก แบบอ่านอย่างเดียว (McpTokenScreen)"
tags: [screens, admin]
aliases: ["McpTokenScreen", "1023", "menu_mcp_tokens", "MCP Token", "จัดการ MCP Token", "AI Read-Only", "bcmcp_ro", "/admin/mcp-tokens", "/mcp-tokens"]
sources: ["frontend/account/tabs/screenRegistry.tsx:273", "frontend/account/admin/screens/McpTokenScreen.tsx:91", "frontend/account/admin/screens/McpTokenScreen.tsx:215", "frontend/account/admin/screens/McpTokenScreen.tsx:264", "frontend/account/admin/screens/McpTokenScreen.tsx:340", "frontend/account/admin/screens/McpTokenScreen.tsx:1021", "frontend/src/app/(admin)/admin/mcp-tokens/page.tsx:1", "frontend/src/app/mcp-tokens/page.tsx:4"]
---
# จัดการ MCP Token เชื่อมต่อ AI ภายนอก (McpTokenScreen)

จอสร้างและควบคุม "กุญแจ" (token) ให้โปรแกรม AI ภายนอก (Claude Desktop, Claude Code, Cursor ฯลฯ) เชื่อมมาอ่านข้อมูลบัญชีของกิจการผ่าน endpoint `/api/mcp` แบบ **อ่านอย่างเดียวเท่านั้น** (`mode: "readonly"`) จอเดียวทำครบ: ดูรายการ token, สร้างใหม่, เพิกถอน, คัดลอกโค้ดตั้งค่า และทดสอบเรียกเครื่องมือสด

## วิธีเปิด
- เมนู ERP **เริ่มต้น > ตั้งค่าองค์กร พนักงาน และเอกสาร > จัดการ MCP Token เชื่อมต่อ AI (Read-Only)** รหัส `1023` (`menu_mcp_tokens`) ผูกที่ `screenRegistry.tsx:273-283` ชื่อแสดง "จัดการ MCP Token เชื่อมต่อ AI (Read-Only)"
- เปิดจากเพจแยกได้อีก 2 ทาง: `/admin/mcp-tokens` ในพื้นที่ผู้ดูแล ([[scr-admin-console]], การ์ดกลุ่ม "ระบบและการเชื่อมต่อ AI ภายนอก (เฉพาะเว็บ)" ใน `adminMenu.ts:142-156`) และ `/mcp-tokens` (`src/app/mcp-tokens/page.tsx`)
- กลไกเมนู/รหัสดู [[fe-screen-registry-menu]]

## โครงหน้าจอ (`McpTokenScreen.tsx`)
หน้าจอแบ่งซ้าย-ขวาแบบจอ master-detail ของ ERP
1. **ซ้าย "รายการ MCP Token (N)"**: ช่องค้นหา "ค้นหาชื่อการเชื่อมต่อ / ฐานข้อมูล..." แล้วรายการ token แต่ละแถวแสดงชื่อ, ป้าย "ใช้งานได้"/"หมดอายุ", รหัสอ้างอิง `tokenPrefix`, `readonly` และ "ฐานข้อมูล: ..." (`:449-540`) ถ้ายังไม่มีเลยขึ้น "ยังไม่มีรายการ MCP Token" ด้านล่างมีปุ่ม **+ เพิ่ม MCP Token ใหม่ (Read-Only)** (`:544`)
2. **ขวา** มี 2 สถานะ
   - **ฟอร์มสร้างใหม่** "กำหนดรายละเอียดการสร้าง MCP Token ใหม่ (Read-Only)" (`:729-800`)
   - **รายละเอียด / ทดสอบ MCP** ของ token ที่เลือก (`:849-1170`)
3. **แถบปุ่มล่าง** ตามกติกาหน้าจอบันทึก/จัดการ: เพิ่มใหม่, ลบ / เพิกถอน Token, โหลดใหม่, ปิดหน้าจอ, และปุ่ม **บันทึก / สร้าง Token** เมื่ออยู่โหมดสร้าง (`:587-641`) คีย์ลัดไม่มี (ไม่ใช้ `ScreenHeader`)

## ฟอร์มสร้าง token และการตรวจ (`handleCreateToken`, `:215-262`)
| ช่อง | ข้อกำหนด |
|---|---|
| ชื่อการเชื่อมต่อ AI | ต้องไม่ว่าง (ค่าเริ่มต้น "Claude / Cursor AI ผู้ช่วยตรวจสอบบัญชี" `:109`) |
| สิทธิ์การเข้าถึง | ล็อกเป็น `readonly (อ่านข้อมูลอย่างเดียว 100%)` เลือกไม่ได้ (`:753-757`) |
| อายุการใช้งาน (วัน) | จำนวนเต็ม 1-365 ค่าเริ่มต้น 90 (`:225-228`) |
| ฐานข้อมูลบริษัทที่อนุญาต | ต้องเลือกอย่างน้อย 1 ฐาน มีปุ่มสลับ "เลือกทุกฐานข้อมูลที่มีสิทธิ์" / "เลือกเฉพาะฐานแรก" เมื่อมีมากกว่า 1 ฐาน (`:782-798`) |

ข้อความผิดพลาด: "กรุณาระบุชื่อการเชื่อมต่อ AI", "กรุณาระบุอายุการใช้งาน Token ระหว่าง 1 ถึง 365 วัน", "กรุณาเลือกฐานข้อมูลบริษัทที่อนุญาตอย่างน้อย 1 ฐานข้อมูล" (`:222-231`)
- ส่ง `POST /api/mcp/tokens` ด้วย `{name, mode: "readonly", databaseCodes, days}` (`:235-242`) ได้ `{token, metadata}` กลับมา
- **ค่า token เต็มแสดงให้เห็นเพียงครั้งเดียว** ในกล่อง "MCP Token ของคุณพร้อมใช้งานแล้ว" พร้อมปุ่ม **คัดลอก MCP Token** (`:687-703`) ข้อความระบุว่าระบบเก็บเฉพาะค่า SHA-256 hash ลงฐานข้อมูล PostgreSQL (`:717`) ถ้าคัดลอกอัตโนมัติไม่ได้ ขึ้น "ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคลุมดำแล้วคัดลอกด้วยตนเอง" (`:300`)
- รูปแบบ token ขึ้นต้น `bcmcp_ro_...` (ข้อความช่วยใน `:307`)

## เพิกถอน token (`handleRevokeToken`, `:264-290`)
ส่ง `POST /api/mcp/tokens` ด้วย `{action: "revoke", id}` สำเร็จแล้วลบออกจากรายการ ขึ้น `เพิกถอน MCP Token "<ชื่อ>" เรียบร้อยแล้ว` และถ้าไม่เหลือ token แล้วสลับไปโหมดสร้างใหม่ทันที (`:285-292`) สถานะที่จอคำนวณเองจาก metadata ได้ 3 ค่า `active` / `expired` / `revoked` (`getTokenStatus`, `:71-76`) แต่ป้ายในรายการแสดงแค่ "ใช้งานได้" กับ "หมดอายุ"

## ส่วนรายละเอียด token (`:849-1010`)
- รหัสอ้างอิง, ID, สถานะ ("ใช้งานได้ปกติ"/"หมดอายุ"), ผู้สร้าง Token, วันที่สร้าง, วันหมดอายุ, ใช้งานล่าสุดเมื่อ (รูปแบบวันเวลาไทย `formatThaiDateTime`, `:77`)
- "ฐานข้อมูลบริษัทที่อนุญาตให้อ่าน (N ฐาน)"
- ส่วน "การตั้งค่าเชื่อมต่อกับ AI ภายนอก (Claude / Cursor / Antigravity / OpenAI MCP)" (`:910`) แสดง URL ของ endpoint `/api/mcp` (สร้างจาก origin ของหน้าปัจจุบัน `:136`) พร้อมปุ่ม **คัดลอก URL** และโค้ดตั้งค่า 3 แท็บ: `mcp_config.json`, **Claude Code CLI**, **cURL (JSON-RPC 2.0)** (`snippetTab`, `:916-945`) พร้อมปุ่ม **คัดลอกโค้ด** ในโค้ดตัวอย่างที่ยังไม่มี token จะแสดงตัวแทน `bcmcp_ro_<วาง_TOKEN_ของคุณที่นี่>` (`:405`)

## ตัวทดสอบเครื่องมือสด "Read-Only Tools" (`:1021-1170`)
- ช่อง "MCP Token สำหรับทดสอบ (Bearer)" (ถ้าเพิ่งสร้างจะเติมให้เอง `:257`) ถ้าว่างขึ้น "กรุณาวาง MCP Token (bcmcp_ro_...) หรือกดสร้าง Token ใหม่ก่อนทดสอบ" (`:307`)
- เลือกเครื่องมือได้ 9 ตัว: `bc_company_overview`, `bc_list_databases`, `bc_list_tables`, `bc_describe_table`, `bc_query_readonly`, `bc_batch_readonly`, `bc_document_lookup`, `bc_financial_summary`, `bc_run_report` (`:1051-1059`)
- รูปแบบผลตอบกลับ: `compact` (ประหยัด token สุด), `markdown`, `records` (`:1071-1073`)
- ช่องป้อนเฉพาะเครื่องมือ: SQL SELECT (คำสั่ง INSERT/UPDATE/DELETE จะถูกบล็อกตามข้อความ `:1094`), ชื่อตาราง (คั่นด้วยจุลภาค), เลขที่เอกสาร (ว่าง = ใบกำกับภาษีขายล่าสุด), ประเภทสรุปทางบัญชี 10 มิติ: `trial_balance`, `profit_loss`, `balance_sheet`, `ar_aging`, `ap_aging`, `vat_summary`, `stock_balance`, `top_products`, `cash_bank_flow`, `autocare_summary` (`:1138-1147`)
- ปุ่ม **ทดสอบเรียก MCP Tool** ส่ง `fetch("/api/mcp")` แบบ JSON-RPC 2.0 `tools/call` พร้อมหัว `Authorization: Bearer <token>` (`:370-392`) แสดงผล JSON, ขนาดผล (ตัวอักษร) และเวลา "เวลาประมวลผล N ms" (`:1156-1161`)
- ตัวอย่าง: `bc_document_lookup` ใช้ `transFlag: 44` (ใบกำกับภาษีขาย) ถ้าไม่ใส่เลขที่เอกสาร; `bc_run_report` ตัวอย่างเรียก `menu_gl_report_trial_balance` โหมด `report_gl` (`:353-366`)

## ข้อควรระวัง
- token เต็มดูซ้ำไม่ได้หลังปิดกล่องแสดง ถ้าหายต้องสร้างใหม่แล้วเพิกถอนอันเก่า
- สิทธิ์เป็นอ่านอย่างเดียวถูกบังคับที่ API (ข้อความหน้าจอยืนยัน "บังคับสิทธิ์ Read-Only 100%") ฝั่งจอไม่มีตัวเลือกอื่น
- ตัวทดสอบเรียก `/api/mcp` จากเบราว์เซอร์จริง ผลที่ได้คือข้อมูลบริษัทจริงของฐานที่ token อนุญาต

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:273-283` — ผูกเมนู
- `frontend/account/admin/screens/McpTokenScreen.tsx:31-89` — ชนิดข้อมูล token / ฐาน / เครื่องมือ; `:91-215` state; `:215-262` สร้าง; `:264-292` เพิกถอน; `:340-400` ทดสอบ; `:449-640` รายการและแถบปุ่ม; `:729-800` ฟอร์มสร้าง; `:849-1010` รายละเอียด; `:1021-1170` ตัวทดสอบ
- `frontend/src/config/adminMenu.ts:152-156` — การ์ดเมนูในพื้นที่ admin
- ดูเพิ่ม: [[scr-admin-console]] · [[scr-change-password]] · [[fe-screen-registry-menu]] · [[screens-overview]]
