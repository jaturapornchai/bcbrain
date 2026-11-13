---
title: "สเปก Query & Blob Gateway (/query/*, /blob/*)"
audience: dev
tags: [api, query, sql, blob, security]
aliases: ["Query Gateway", "/query/limit", "/query/list", "/query/exec", "/query/batch", "/blob/insert", "WritePolicy"]
sources: ["backend/internal/adapter/inbound/http/router.go:92-114", "backend/internal/adapter/inbound/http/query/handler.go:1-446", "backend/internal/adapter/inbound/http/blob/handler.go:1-207", "backend/internal/domain/query/query.go:1-521", "backend/internal/domain/query/write_policy.go:1-103"]
---

**Query Gateway** และ **Blob Gateway** เป็นทางผ่านสำหรับ Client ภายใน (เช่น `BcDataList`, Lookup, ฟอร์มตั้งค่า Master และ BFF Proxy) ที่ต้องการส่งคำสั่ง SQL แบบมีตัวควบคุมความปลอดภัย

---

## 1. Query Gateway Endpoints (`router.go:92-105`)

> [!NOTE]
> ใน Go Router เส้นทาง mount อยู่ที่ `/query/*` (ส่วนใน Next.js Frontend BFF จะ Proxy ผ่าน `/api/query/*`) ทุกเส้นทางบังคับผ่าน `Auth` JWT Bearer เสมอ

| Endpoint | HTTP | Guard | Limits (`domain/query/query.go`) | การใช้งาน |
| :--- | :--- | :--- | :--- | :--- |
| `/query/list` | `POST` | Read-Only (`NewStatement`) | `MaxListRows = 50,000` | ดึงรายการตาราง/Lookup เต็มรายการ |
| `/query/limit` | `POST` | Read-Only (`NewStatement`) | `MaxLimit = 1,000` | ดึงข้อมูลแบ่งหน้า (`page`/`size` หรือ `limit`) |
| `/query/batch` | `POST` | Read-Only (`NewStatement`) | `MaxBatchStatements = 20` | รันชุดคำสั่งอ่านหลายตารางพร้อมกัน |
| `/query/exec` | `POST` | `queryWriteGuard` + `WritePolicy` | 1 DML statement | รันคำสั่งเขียน 1 คำสั่ง (เฉพาะตารางที่อนุญาต) |
| `/query/execBatch` | `POST` | `queryWriteGuard` + `WritePolicy` | `MaxExecBatchStatements = 1,000`, `MaxExecBatchBytes = 2 MiB` | รันชุดคำสั่งเขียนแบบ Atomic Transaction |

---

## 2. กฎความปลอดภัยของ SQL Validator (`domain/query/query.go`)

### โหมดอ่าน (`NewStatement`)
- รับเฉพาะ **Single SQL Statement** ที่ขึ้นต้นด้วย `SELECT` หรือ `WITH` (CTE)
- ปฏิเสธทันทีถ้าพบคำสั่งหลายชุดคั่นด้วย `;`, `SELECT ... INTO`, `COPY`, `DDL` (`CREATE`/`ALTER`/`DROP`/`TRUNCATE`), `MERGE`, Unicode escape `U&"..."` หรือฟังก์ชันระบบอันตรายของ PostgreSQL
- ตรวจสอบระดับสิทธิ์ผู้ใช้ (`ValidateUserLevel`): การเข้าถึงข้อมูลการตั้งค่าหลักเช่น `erp_option` และตารางระบบบางรายการต้องมี `user_level >= 9`

### โหมดเขียน (`NewWriteStatement` & `WritePolicy`)
ไฟล์ `backend/internal/domain/query/write_policy.go:1-103` กำหนดกฎป้องกันการทำลายความถูกต้องทางบัญชีอย่างเข้มงวด:
1. อนุญาตเฉพาะ `INSERT`, `UPDATE`, `DELETE` หรือ `WITH` ที่มี DML เท่านั้น (บล็อก DDL และ `MERGE`)
2. **`ErrMoneyTableViaExec`**: ปฏิเสธการเขียนตรงเข้าตารางการเงิน สต็อก บัญชี ภาษี เช็ค สินทรัพย์ ที่ตรงกับ `moneyTablePattern` หรือการแก้คอลัมน์ยอดคงเหลือของสินค้า (`inventoryBalanceColumns` บน `ic_inventory`) — งานเหล่านี้ **ต้องส่งผ่าน Process Engine (`/process/trans/save`, `/process/doc/save`) เท่านั้น**
3. **`ErrAdminOnlyWrite`**: การเขียนเข้าตารางตั้งค่าระบบบังคับผู้ใช้ระดับ Admin (`user_level >= 9`) เว้นแต่เป็นตารางใน allow-list เฉพาะทางของระบบเดิม
4. **Audit Logging & Company Brain Sync (`query/handler.go:123`)**:
   - คำสั่งที่ส่งผ่าน Query Gateway จะถูก Mask literal (`maskSQLLiterals`) และบันทึก SHA-256 hash ใน Log
   - เมื่อเขียนลงตาราง Master ทั้ง 12 ตารางใน `brainMasterTables` สำเร็จ ระบบจะยิง `maybeNudgeMasterWrite` แจ้งเตือน Sidecar ของ [[arch-company-brain-ai]] อัปเดตกราฟความสัมพันธ์โดยอัตโนมัติ

---

## 3. Blob Gateway (`POST /blob/insert`, `blob/handler.go:1-207`)

ใช้สำหรับบันทึกข้อมูลพร้อมอัปโหลดไฟล์รูปภาพ/เอกสารแนบแบบ `multipart/form-data`:
- ตรวจสอบสิทธิ์ `queryWriteGuard` และ `ValidateClientInsert` (`write_policy.go`) เช่นเดียวกับ Query Write
- บีบอัด/จัดเก็บไฟล์แนบลง MinIO Object Storage (`zipValuesToMinIO`) แล้วนำพาธ/คีย์ที่ได้ไปบันทึกในตารางเป้าหมายของฐานบริษัทแบบ Atomic
- ตรวจ Image Header ที่ปลอดภัยผ่าน `readImagePart` ป้องกันการอัปโหลดไฟล์อันตราย
