---
title: "การตรวจสิทธิ์เมนูของ route process (Process route rights)"
tags: [process, permission, rights, security, middleware]
aliases: ["routeRights", "RequiredRight", "RequireRight", "peekJSON", "สิทธิ์เมนู", "Admin โดยปริยาย"]
sources: ["backend/internal/adapter/inbound/http/process/permission.go:23", "backend/internal/adapter/inbound/http/process/permission.go:57", "backend/internal/adapter/inbound/http/process/permission.go:231", "backend/internal/adapter/inbound/http/middleware/permission.go:14", "backend/internal/adapter/inbound/http/middleware/permission.go:62"]
---

# การตรวจสิทธิ์เมนูของ route process (Process route rights)

ทุกคำขอใต้ `/process` และ `/api/v1/process` ผ่าน `middleware.RequireRight` ซึ่งถามฟังก์ชัน `processhttp.RequiredRight(r)` ว่า "route นี้ต้องใช้สิทธิ์อะไร" แล้วเทียบกับ `MenuRights` ของผู้ใช้ใน session ถ้าไม่ครอบคลุมตอบ 403 พร้อมข้อความไทย

## ทำงานอย่างไร

### ชนิดสิทธิ์ (`middleware.Right`)
| ค่า | ความหมาย (ตามคอมเมนต์ในโค้ด) | `Allows` ตรวจกับ |
|---|---|---|
| `RightRead` | C# `_isRead` | `rights.Read` |
| `RightWrite` | C# `_isAdd` หรือ `_isEdit` (save/cancel/approve) | `Add \|\| Edit` |
| `RightDelete` | C# `_isDelete` | `rights.Delete` |
| `RightAdmin` | ประมวลผลทั้งฐานข้อมูล: Admin เท่านั้น | ไม่มี case => false (ผ่านเฉพาะ `rights.Admin`) |
| `RightAdd` | C# `_isAdd` อย่างเดียว (master data: เพิ่มใหม่) | `rights.Add` |
| `RightEdit` | C# `_isEdit` อย่างเดียว (master data: แก้ไข) | `rights.Edit` |

- `rights.Admin == true` ผ่านทุกกรณี (`Allows` คืน true ก่อน switch)
- ข้อความปฏิเสธเป็นภาษาไทยแยกตามชนิดสิทธิ์ใน `deniedMessages`
- `RequireRight` ต้องอยู่หลัง `Auth` (ถ้าไม่มี claims ตอบ Unauthorized)

### ตัวตัดสิน `RequiredRight`
1. route ที่ขึ้นกับ body ใช้ `peekJSON` (อ่าน body ไม่เกิน 1 MB แล้วคืน body กลับให้ handler):
   - `report/run`, `report/pdf`: ถ้ามี `customSql` ไม่ว่าง => `admin`, ไม่งั้น `read` (ดู [[proc-report-custom-sql-template]])
   - `stock/rebuild`: ส่ง `ItemCodes` => `write`, ไม่ส่ง => `admin`
   - `gl/rebuild`: ส่ง `DocNo` => `write`, ไม่ส่ง => `admin`
   - `itemmaster/save`, `trans/save`, `doc/save`, `stocktools/pointdocsave`, `stocktools/stockbeginningsave`: `IsNew=true` => `RightAdd`, ไม่งั้น `RightEdit`
   - `master/datalistget`, `master/datalistsave`: ถ้า `UserCode` ว่างหรือตรงกับ `claims.Username` => `read`, ถ้าเป็นของคนอื่น => `admin`
   - `workflow/check-ic-trans`: `Apply=false` => `read`, ไม่งั้น `admin`
   - `barcode/format`: `Action=save` => `RightAdd`, `delete` => `del`, อื่น ๆ => `read`
   - `workflow/fa-depreciation`: `Delete=false` => `write` ไม่งั้น `del`
   - `workflow/asset-sale`: `Op=preview` => `read`, `delete` => `del`, อื่น ๆ => `write`
2. อื่น ๆ ค้นตาราง `routeRights` (key = `"<กลุ่ม>/<action>"`):
   - read: เช่น `report/run`, `report/pdf`, `doc/flow`, `lookup/*`, `barcode/item`, `transgrid/*`, `docpicture/get`, `itemdetail/get`, `modifyprice/preview`, `stocktools/formats`, `workflow/journal-list`
   - write: เช่น `doc/save`, `doc/cancel`, `doc/approve`, `barcode/save`, `modifyprice/apply`, `master-detail/save`, `stocktools/hiddencostsave`, `workflow/journal-pass`
   - delete: เช่น `trans/delete`, `doc/delete`, `master-detail/delete`, `itemmaster/delete`
   - admin: `cheque/rebuild`, `tax/rebuild`, `workflow/gl-close`, `workflow/change-code`, `workflow/audit-list`
3. **ไม่อยู่ในตาราง => `admin`** (คอมเมนต์ในโค้ด: route ใหม่ถูกล็อกไว้จนกว่าจะมีคนจัดประเภท)

### กรณีเฉพาะที่ควรรู้
- action `workflow/ai-*` (เช่น `ai-report-sql`, `ai-audit-copilot`) ไม่ปรากฏใน `routeRights` => ตกเป็น Admin ตามกฎข้อ 2
- `QueryRequiredRight` เป็นตัวตัดสินสิทธิ์ของ `/query/exec`, `/query/execBatch`, `/blob/insert` (นอก process)
- สิทธิ์ที่นี่เป็นสิทธิ์ระดับเมนู/route คนละเรื่องกับสิทธิ์คลัง/ที่เก็บ ดู [[proc-wh-shelf-permission]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/middleware/permission.go:14-23` - ชนิด `Right` และความหมายตาม C#
- `backend/internal/adapter/inbound/http/middleware/permission.go:40-60` - `Allows`
- `backend/internal/adapter/inbound/http/middleware/permission.go:62` - `RequireRight` (403 + ข้อความไทย)
- `backend/internal/adapter/inbound/http/process/permission.go:23-55` - ตาราง `routeRights`
- `backend/internal/adapter/inbound/http/process/permission.go:57-132` - `RequiredRight` (สวิตช์ตาม body และ fallback เป็น admin ที่บรรทัด 132)
- `backend/internal/adapter/inbound/http/process/permission.go:231` - `peekJSON`

## ดูเพิ่ม
- [[proc-dispatcher]]
- [[proc-wh-shelf-permission]]
- [[proc-report-custom-sql-template]]
- [[proc-ai-copilot]]
- [[process-overview]]
