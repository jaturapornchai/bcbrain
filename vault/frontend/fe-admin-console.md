---
title: "หน้าจอผู้ดูแลระบบส่วนกลาง (Admin Console)"
tags: [frontend, admin, provider, permission, mcp]
aliases: ["admin console", "จัดการระบบ", "หน้า admin", "ผู้ดูแลระบบ", "จัดการ Provider", "กำหนดสิทธิ์กลุ่ม", "MCP token", "เปลี่ยนรหัสผ่าน"]
sources: ["frontend/src/app/(admin)/layout.tsx:18", "frontend/src/config/adminMenu.ts:39", "frontend/src/app/api/admin/main-query/route.ts:10", "frontend/account/admin/screens/ExtraAdminScreens.tsx:33", "frontend/account/admin/screens/McpTokenScreen.tsx:91"]
---

# หน้าจอผู้ดูแลระบบส่วนกลาง (Admin Console)

โซน `/admin/*` สำหรับผู้ดูแลระบบ (session `mode === "admin"`) ใช้จัดการ Provider, ฐานข้อมูล, ผู้ใช้, กลุ่ม, สิทธิ์เมนู และ MCP Token แยกจากแอปบัญชีหลัก (`(app)`)
ทุกหน้าเป็นหน้าบางๆ ที่ส่ง `currentProvider` ให้ component ใน `account/admin/screens/` แล้วเรียก `/api/admin/*` (proxy ไป backend `/api/v1/admin/*`).

## ทำงานอย่างไร

**1) ประตูเข้า (layout)**
- `(admin)/layout.tsx:18-21`: ไม่มี session → `/login`; ไม่ใช่ `mode==="admin"` และไม่ใช่ผู้ชมสาธิต (`isDemoCentralViewer`) → `/home`.
- ผ่านแล้วห่อด้วย `AdminShell` (`shared/layout/AdminShell.tsx`) โดย `readOnly={demoViewer}`; โหมดอ่านอย่างเดียวขึ้นแถบเหลือง `admin-demo-readonly-banner` (`AdminShell.tsx:80-87`). ปุ่มออกจากระบบเรียก `POST /api/auth/logout` แล้ว `router.replace("/login")` (`AdminShell.tsx:31-35`).
- หน้าแรก `/admin` (`(admin)/admin/page.tsx`) วาดการ์ดเมนูจาก `adminMenuGroups` + ปุ่ม `MockResetButton` (`POST /api/admin/reset`, ใช้ได้เฉพาะโหมดข้อมูลจำลอง `reset/route.ts:11-12`).

**2) เมนู 3 กลุ่ม (`src/config/adminMenu.ts`, `adminMenuGroups` เริ่มบรรทัด 39)** ทุกรายการ `status:"ready"` (ค่า `"todo"` มีในชนิดข้อมูล บรรทัด 31)

| กลุ่ม | เมนู (ไทย) | หน้า `/admin/...` | Component |
|---|---|---|---|
| User Manage (Provider) | กำหนดผู้ใช้และกลุ่มผู้ใช้ | `users` | `UsersScreen` → `UsersTab` |
| | จัดกลุ่มผู้ใช้ | `user-groups` | `UserGroupsScreen` |
| | เปลี่ยนข้อความในระบบ | `system-text` | `SystemTextScreen` |
| | เปลี่ยนรหัสผ่าน | `change-password` | `ChangePasswordScreen` |
| | กำหนดสิทธิ์กลุ่มใช้งาน | `group-permission` | `GroupPermissionScreen` |
| | กำหนดผู้มีสิทธิ์เข้าใช้ข้อมูล | `data-access` | `DataAccessScreen` |
| Database Manage (Provider) | กำหนดกลุ่มข้อมูล | `data-groups` | `DataGroupsScreen` |
| | สร้างฐานข้อมูลใหม่ | `create-database` | `CreateDatabaseScreen` |
| | เชื่อมฐานข้อมูล | `databases` | `DatabasesScreen` → `DatabasesTab` |
| | กำหนดการเข้าถึงข้อมูล | `data-permission` | `DataPermissionScreen` |
| | ตรวจสอบฐานข้อมูล | `check-database` | `CheckDatabaseScreen` |
| | Database Information | `database-info` | `DatabaseInfoScreen` |
| | โอนข้อมูล | `transfer` | `TransferDataScreen` |
| ระบบและการเชื่อมต่อ AI ภายนอก (เฉพาะเว็บ) | จัดการ Provider | `providers` | `ProvidersScreen` → `ProvidersTab` |
| | จัดการ MCP Token (AI Read-Only) | `mcp-tokens` | `McpTokenScreen` |

ไฟล์ component อยู่ใน `account/admin/screens/` (alias `@/components/admin/screens/X`); `ExtraAdminScreens.tsx` รวม 7 จอ: user-groups (33), system-text (256), group-permission (379), data-permission (391), create-database (620), check-database (700), transfer (815).

**3) โครงร่วมของจอ**
- `AdminScreenFrame` (`AdminScreenFrame.tsx:13`) = หัวเรื่อง + note + ลิงก์กลับ `/admin`.
- `ProviderScopedScreen` (`ProviderScopedScreen.tsx:17`) ใช้ `useProviders(currentProvider)` + `ProviderPicker` ให้เลือก Provider แล้วส่งค่าให้ลูกเป็น `(provider) => ...`. จอ users/databases/data-access/ฯลฯ จึงสลับ Provider ได้โดยไม่ผูกกับ session.

**4) จอที่เรียก `/api/admin/*` ตรงๆ (CRUD)**

| จอ | Endpoint ที่เรียก |
|---|---|
| `UsersTab` | `GET /api/admin/users` + `/databases`; บันทึก `POST`/`PATCH /api/admin/users`; ลบ `DELETE ...users?provider=&user=` (`UsersTab.tsx:52-53,75-76,95-96`) |
| `DatabasesTab` | `GET/POST/PATCH /api/admin/databases`; ลบ `DELETE ...databases?provider=&database=` (`DatabasesTab.tsx:39,57-58,77-78`) |
| `ProvidersTab` | `POST`/`PATCH /api/admin/providers`; ลบ `DELETE ...providers?code=` (`ProvidersTab.tsx:53-54,73-74`) |
| `DataAccessScreen` (note "ผูกผู้ใช้กับฐานข้อมูลที่เข้าได้") | `GET users+databases`, `PATCH /api/admin/users` (`DataAccessScreen.tsx:26-27,74`) |
| `DataGroupsScreen` (note "กลุ่มข้อมูล ที่ผู้ใช้ต้องกรอกตอน login") | `GET databases`, `PATCH /api/admin/databases` เปลี่ยนชื่อกลุ่ม (`DataGroupsScreen.tsx:23-24,58`) |
| `DatabaseInfoScreen` | `GET /api/admin/database-info?provider=` (`DatabaseInfoScreen.tsx:16-17`) |
| `CreateDatabaseScreen` | `POST /api/admin/databases` (`ExtraAdminScreens.tsx:648`) |
| `ChangePasswordScreen` โหมดผู้ดูแล | `PATCH /api/admin/users` ส่ง `user_password` |

**5) จอที่ยิง SQL ผ่าน `main-query` (SQL สร้างในเบราว์เซอร์)**
- `UserGroupsInner` (`ExtraAdminScreens.tsx:45`): อ่าน/เขียนตาราง `bc_group_list` และ `bc_user_and_group` ด้วย `POST /api/admin/main-query` (บรรทัด 60,65,92,112,119,124).
- `CheckDatabaseInner` (บรรทัด 712-735): นับคอลัมน์ต่อตารางจาก `information_schema.columns` (schema `public`) และส่ง `database: targetDb` ไปด้วย แต่ route ปฏิเสธถ้า `database` ต่างจาก `session.database` และไม่ส่ง `database` ต่อให้ backend (`main-query/route.ts:29-40`).
- ตัว route (`main-query/route.ts:10-45`): ต้องผ่าน `requireSystemAdmin`; ถ้า body `provider` ไม่ตรง session → ปฏิเสธ "ไม่อนุญาตให้รันคำสั่งข้าม Provider ของเซสชันปัจจุบัน" (บรรทัด 24-26); ถ้า `database` ไม่ตรง session → ปฏิเสธ (บรรทัด 29-31); ส่งต่อไป backend เฉพาะ `provider` (จาก session), `sql`, `mode` (`"query"` เป็นค่าเริ่มต้น หรือ `"exec"`).

**6) เมทริกซ์สิทธิ์เมนู (`PermissionMatrixInner`, `ExtraAdminScreens.tsx:416`)**
- `mode="group"` = `GroupPermissionScreen` (เลือกกลุ่มจาก `main-query`); `mode="user"` = `DataPermissionScreen` (เลือกผู้ใช้จาก `GET /api/admin/users`) (บรรทัด 429,440).
- โหลดสิทธิ์ `GET /api/admin/menu-permissions?kind=<group|user>&code=<เป้าหมาย>` (บรรทัด 456) และบันทึก `PUT /api/admin/menu-permissions` (บรรทัด 485) — สิทธิ์ต่อเมนูเป็น อ่าน/เพิ่ม/แก้ไข/ลบ (ตาม note ของจอ).
- `SystemTextScreen` ใช้ endpoint เดียวกันด้วย `kind=tooltip&code=ALL` (GET บรรทัด 279, PUT บรรทัด 293) เพื่อแก้ข้อความ tooltip ของระบบ.

**7) จอพิเศษ**
- `ChangePasswordScreen` (`ChangePasswordScreen.tsx:412-430`): ถ้าส่ง `menuCode` มา = `SelfChangePasswordScreen` (ผู้ใช้เปลี่ยนรหัสตัวเอง ใช้ `GET`+`POST /api/auth/change-password` ที่บรรทัด 182,224; ผู้ใช้ Google ไม่แสดงฟอร์ม บรรทัด 196; โหมดสาธิตห้ามเปลี่ยน บรรทัด 201-202; รหัสใหม่ต้องไม่ซ้ำรหัสเดิม บรรทัด 217). ถ้าไม่ส่ง = โหมดผู้ดูแลตั้งรหัสให้ผู้ใช้ใน Provider. จอตัวเองถูกลงทะเบียนในแอปบัญชีที่ `menu_change_password` (`account/tabs/screenRegistry.tsx:430`) และ `menu_saletools_change_password` (บรรทัด 438).
- `McpTokenScreen` (`McpTokenScreen.tsx:91`, 1,190 บรรทัด): ดึงรายการ `GET /api/mcp/tokens` (บรรทัด 141), สร้าง token แบบ `mode:"readonly"` ระบุ `databaseCodes` + `days` (บรรทัด 238-244), เพิกถอนด้วย `POST` `action:"revoke"` (บรรทัด 270-273), สถานะ `active|expired|revoked` คำนวณจาก `revokedAt`/`expiresAt` (บรรทัด 71-73), ทดสอบเรียกเครื่องมือผ่าน JSON-RPC `tools/call` ที่ `/api/mcp` ด้วย Bearer token (บรรทัด 370-380). ถูกลงทะเบียนในแอปบัญชีที่ `menu_mcp_tokens` รหัส 1.1.21 (`screenRegistry.tsx:273-281`). (route `/api/mcp/*` อยู่นอกขอบเขตที่อ่าน)
- `TransferDataScreen` (`ExtraAdminScreens.tsx:827-899`): เลือกฐานต้นทาง/ปลายทางจาก `GET databases` และติ๊กชุดข้อมูล 7 รายการ (`ic_inventory`, `ic_unit`, `ic_warehouse`, `ar_customer`, `ap_supplier`, `gl_chart_of_account`, `erp_doc_format`; บรรทัด 837-845) แต่ปุ่ม "เริ่มโอนข้อมูล" แค่ `setDone(...)` แสดงข้อความ "เรียบร้อย" (บรรทัด 892) **ไม่มีการเรียก API โอนข้อมูลจริงในจอนี้** และ checkbox เป็น `defaultChecked` ไม่ถูกอ่านค่า.

## `/api/admin` routes

| Route | Method | ปลายทาง backend | สิทธิ์ |
|---|---|---|---|
| `database-info` | GET | `/api/v1/admin/database-info?provider=` | `requireSystemAdminView` + `demoSafe` (`route.ts:31-40`) |
| `databases` | GET/POST/PATCH/DELETE | `/api/v1/admin/databases` | GET = View; เขียน = `requireSystemAdmin` (`route.ts:33,51`) |
| `providers` | GET/POST/PATCH/DELETE | `/api/v1/admin/providers` | เช่นเดียวกัน (`route.ts:27,40`) |
| `users` | GET/POST/PATCH/DELETE | `/api/v1/admin/users` | เช่นเดียวกัน; `AdminUserView = Omit<BcUser,"user_password">` (`route.ts:20`) |
| `menu-permissions` | GET/PUT | `/api/v1/admin/menu-permissions` | GET = View + `demoSafe` (`route.ts:14-26`), PUT = `requireSystemAdmin` (`route.ts:29-34`) |
| `main-query` | POST | `/api/v1/admin/main-query` | `requireSystemAdmin` + บังคับ Provider/Database ตาม session |
| `reset` | POST | (ไม่มี — เฉพาะ mock) | `requireSystemAdmin`; ไม่ใช่ mock → 400 |

เส้นทาง `databases`/`providers`/`users`/`database-info` มีสาขา mock เมื่อ `USE_MOCK` (อ่านจาก `readDb()`), โหมดจริงส่งต่อด้วย `proxyToService`.

## ที่มาในโค้ด
- `frontend/src/app/(admin)/layout.tsx:18-26` — ด่านสิทธิ์ `mode==="admin"` / ผู้ชมสาธิต และ `AdminShell readOnly`.
- `frontend/src/config/adminMenu.ts:26-39,162` — ชนิดเมนู, `adminMenuGroups`, `findAdminMenu`.
- `frontend/shared/layout/AdminShell.tsx:31-35,80-87` — logout และแถบโหมดอ่านอย่างเดียว.
- `frontend/account/admin/ProviderScopedScreen.tsx:17-32`, `AdminScreenFrame.tsx:13` — โครงร่วมของจอ.
- `frontend/account/admin/UsersTab.tsx`, `DatabasesTab.tsx`, `ProvidersTab.tsx` — CRUD (cite ในตาราง).
- `frontend/account/admin/screens/ExtraAdminScreens.tsx:33,256,379,391,416,620,700,815` — จอที่ยิง `main-query` / `menu-permissions`.
- `frontend/account/admin/screens/ChangePasswordScreen.tsx:162,412-430` และ `McpTokenScreen.tsx:91,141,238,270,370` — จอพิเศษ.
- `frontend/src/app/api/admin/*/route.ts` — proxy ฝั่ง server (cite ในตาราง route).

## ดูเพิ่ม
[[fe-api-proxy-routes]] · [[fe-auth-session]] · [[fe-app-shell-routing]] · [[fe-login-select-database]] · [[fe-screen-registry-menu]] · [[fe-query-client-sql-builder]] · [[frontend-overview]] · [[backend-overview]]
