---
title: "คู่มือ AI นักพัฒนา & สถาปัตยกรรมต่อยอดระบบ BC Ai Account"
audience: dev
tags: [dev-playbook, ai-guide, architecture, standards]
aliases: ["คู่มือนักพัฒนา BC", "Developer Playbook", "แนวทางพัฒนาต่อยอด BC Ai Account", "กฎพัฒนา BC", "กติกา dev และ AI"]
sources: ["AGENTS.md:1-66", "backend/internal/adapter/inbound/http/router.go:1-385", "backend/internal/domain/query/query.go:1-521", "backend/internal/domain/query/write_policy.go:1-103", "backend/internal/application/process/service.go:108-645"]
---

คู่มือฉบับนี้เป็นจุดเริ่มต้นสำหรับ **นักพัฒนา (Developer) และ AI Coding Agent** ที่ต้องการดึงข้อมูล สร้างรายงาน เขียนแอปพลิเคชันเสริม LINE Bot BI Dashboard หรือเชื่อมต่อระบบภายนอกกับ **BC Ai Account**

## 1. ขอบเขตความปลอดภัยสูงสุด (Security Boundary)

> [!CAUTION]
> **ข้อห้ามเด็ดขาดสำหรับนักพัฒนาและ AI Agent ทุกตัว:**
> - ห้ามสกัด เปิดเผย หรือค้นหาตารางระบบผู้ใช้งาน ตารางจัดเก็บโทเค็น MCP บัญชีเชื่อมโยงภายนอก และตารางระบบรหัสผ่าน/สิทธิ์ของ PostgreSQL โดยเด็ดขาด
> - ระบบยืนยันตัวตนและจัดการโทเค็น MCP แบบ Read-Only ถูกออกแบบให้บล็อกการคิวรีตารางระบบยืนยันตัวตน ตารางจัดเก็บโทเค็น และคอลัมน์รหัสผ่านโดยอัตโนมัติในระดับ Engine
> - ห้าม hardcode Token, API Key, Password หรือ Connection String ลงในโค้ด โน้ต หรือ Git เด็ดขาด

---

## 2. แผนที่ความรู้ฝั่งนักพัฒนา (Dev Knowledge Hubs)

| เรื่องที่ต้องการค้นหา | อ่านต่อได้ที่ |
| :--- | :--- |
| กฎเหล็กตัวเลขการเงิน `NUMERIC`, `last_status = 0`, BE/CE, `WritePolicy` | [[dev-rules-accounting-sql]] |
| ขั้นตอนเริ่มต้นต่อ API, Token, POS Pairing, Multi-Tenant & UAT | [[dev-integration-quickstart]] |
| ภาพรวม Data Dictionary & โครงสร้างตารางฐานข้อมูล | [[schema-overview]] |
| รหัสประเภทเอกสาร `trans_flag`, Document Flow & ผังบัญชี Dr/Cr | [[doctypes-overview]] |
| คลังคำสั่ง SQL `SELECT` / `WITH` พร้อมใช้งาน | [[sql-overview]] |
| ภาพรวม REST API, Query Gateway & Process Engine | [[api-overview]] |
| สเปก MCP Gateway 11 Read-Only Tools & Token Workflow | [[api-mcp-gateway]] |
| ภาพรวมสถาปัตยกรรม Clean Go Backend, Multi-Tenant & AI Sidecar | [[arch-overview]] |

---

## 3. กฎสถาปัตยกรรมหลักของ BC Ai Account (Backend-First & Zero Precision Loss)

อ้างอิงข้อกำหนดแกนกลางของโปรเจกต์ (`AGENTS.md:1-66`):

1. **100% Backend-First Business Logic**: กฎบัญชี ภาษี ต้นทุนสต็อก การคำนวณส่วนลดหลายชั้น การอนุมัติเอกสาร (`DocFlow`) และการออกรายงาน/PDF ทั้งหมดอยู่ที่ Go Backend (`/process/*` และ `/api/v1/process/*`) ไม่คำนวณ Business Logic เงิน/ภาษีซ้ำฝั่ง Frontend เพียงอย่างเดียว
2. **ห้ามใช้ Binary Float กับเงินและจำนวนสินค้า**:
   - Backend Go ใช้ `*math/big.Rat` และ `ParseDecimalRat` / `RoundHalfUp` (`backend/internal/application/process/service.go:108-180`)
   - Database PostgreSQL ใช้ `NUMERIC(p, s)` ห้ามใช้ `real` หรือ `double precision`
   - TypeScript/Frontend ใช้ `frontend/src/lib/numeric.ts` ห้ามใช้ `parseFloat()` หรือ `Number()` คำนวณเงิน
3. **Read-Only MCP vs Protected Client Writes**:
   - ถ้างานคือ **วิเคราะห์ข้อมูล ตอบคำถาม AI หรือสร้างรายงาน BI**: ใช้ [[api-mcp-gateway]] (`bcmcp_ro_*`) หรือ [[api-query-gateway]] (`/query/list`, `/query/limit`)
   - ถ้างานคือ **สร้าง/แก้ไข/ยกเลิกเอกสารบัญชี สต็อก การเงิน**: ห้ามยิง `INSERT/UPDATE/DELETE` ผ่าน `/query/exec` เข้าตารางเงิน/สต็อก/บัญชีโดยตรง เพราะถูกบล็อกโดย `WritePolicy` (`write_policy.go`) — ต้องเรียกผ่าน [[api-process-engine]] (`/process/trans/save`, `/process/doc/save` ฯลฯ) เท่านั้น เพื่อให้ระบบรัน `DocFlow`, Stock Cost Rebuild และ GL Posting ครบวงจร
4. **มาตรฐานวันที่ & ตัวเลขบนหน้าจอ**:
   - ฐานข้อมูลเก็บวันที่แบบ Gregorian ISO `YYYY-MM-DD` เสมอ
   - การแสดงผลบน UI/PDF แปลงตาม `erp_option.year_type` (`0` = ค.ศ., `1` = พ.ศ.)
   - ค่าศูนย์ (`0`, `0.00`) ในช่องกรอกตัวเลขและคอลัมน์รายงานแสดงเป็นช่องว่าง (`""`) เพื่อความอ่านง่าย
5. **Dual Mount Paths & Next.js Proxy**:
   - Go Backend เปิดใช้ทั้ง `/process/*`, `/ai/*`, `/company-brain/*`, `/mcp`, `/public/bill-pay/{token}` และเวอร์ชัน `/api/v1/*` (`router.go:129-396`) สำหรับ Next.js BFF Proxy ผ่าน `/api/*` (`frontend/src/app/api/`)

---

## 4. ขั้นตอนทำงาน 5 ขั้นสำหรับ Dev & AI Agent

1. **ตรวจขอบเขตงาน & Edition Gate**: ตรวจว่าโมดูลนั้นเปิดให้ทุกแพ็กเกจหรือจำกัดเฉพาะ Pro Edition (`X-BC-Edition` guard ใน `edition_guard.go`) และเปิด/ปิดอยู่ใน [[arch-feature-switchboard]] หรือไม่
2. **สำรวจโครงสร้างตารางจริง**: ตรวจคอลัมน์และคีย์เชื่อมโยงใน [[schema-overview]] หรือใช้ MCP `bc_describe_table`
3. **เช็ก `trans_flag` และสถานะเอกสารก่อนเขียน SQL**: อ่าน [[dev-rules-accounting-sql]] และ [[doctypes-overview]] ทุกครั้งก่อนเขียนเงื่อนไข `WHERE` โดยเฉพาะเอกสารใช้ตารางร่วมกัน (`ic_trans_detail`, `ap_ar_trans_detail`, `cb_trans_detail`)
4. **ทดสอบ Read-Only Query ให้รัดกุม**: กรอง `COALESCE(last_status, 0) = 0`, กำหนด `LIMIT` และทดสอบกับฐานข้อมูลจำลอง/UAT แยกจากข้อมูลบริษัทจริง
5. **เขียนเอกสารและส่งต่ออย่างปลอดภัย**: ระบุพารามิเตอร์ ประเภทคอลัมน์ (`NUMERIC`/`DATE`) และหลีกเลี่ยงข้อมูลความลับทุกชนิด
- **สเปกเชิงลึกเพิ่มเติม**: HTTP Routes & 57 Workflow Actions ([[api-inbound-handlers-workflows]]), กลไกราคา 7 ขั้น & Subledger Reconcile ([[doc-price-engine-ref-import-calc]]), กฎ GL Marketplace / Payroll ม.33 / DBD / ภ.พ.10 / Print Audit ([[doc-marketplace-payroll-dbd-evrt]]), Flutter POS ObjectBox ([[arch-pos-flutter-objectbox-sync]]), Company Brain 5-Channel Fusion ([[arch-company-brain-fusion-pipeline]]), Schema Forms & i18n DOM ([[arch-i18n-field-help-schema-forms]]) และสคีมาสมุดเงินฝาก/ประวัติพิมพ์/ระบบกลาง ([[tbl-cb-bank-book-master]], [[tbl-auto-bill-and-print-audit]], [[tbl-tenant-workspace-governance]], [[sql-marketplace-payroll-subledger-audit]])
