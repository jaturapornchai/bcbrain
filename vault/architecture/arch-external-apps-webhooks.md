---
title: "คู่มือพัฒนาแอปภายนอก, POS Sync, LINE OA Bot & Webhooks บน BC Ai Account"
audience: dev
tags: [architecture, webhooks, lineoa, pos-sync, integration, bff]
aliases: ["ต่อยอดแอปภายนอก BC", "POS Sync Cursor", "LINE OA Webhook BC", "Public Bill Pay Flow", "MinIO Media Proxy"]
sources: ["backend/internal/application/process/pos_sync.go:30-175", "backend/internal/application/process/pos_bill.go:25-180", "backend/internal/application/process/sme_thai_pack.go:488-1050", "backend/internal/application/process/public_bill_pay.go:20-175", "backend/internal/adapter/inbound/http/wms/handler.go:1828-1880"]
---

เอกสารนี้เป็นพิมพ์เขียวสำหรับนักพัฒนาที่ต้องการสร้างแอปพลิเคชันภายนอก (LINE OA Bot, เว็บสั่งซื้อ B2B, เครื่อง POS หน้าร้าน, BI Dashboard หรือ Webhook Receiver) มาเชื่อมต่อกับ **BC Ai Account**

---

## 1. รูปแบบการเชื่อมต่อ 5 รูปแบบตามประเภทแอป

### Pattern A: AI Copilot / Chatbot / Internal Analyst
- **ใช้**: **MCP Gateway** (`/mcp`, `/api/v1/mcp`) ด้วย Read-Only Token (`bcmcp_ro_*`)
- **ข้อดี**: ไม่ต้องเขียนโค้ด SQL Wrapper เอง ได้ `compact` format ประหยัด token 55–75%, รองรับ Multi-DB พร้อมกันสูงสุด 20 บริษัท และมั่นใจว่าอ่านได้อย่างเดียว 100% — ดู [[api-mcp-gateway]]

### Pattern B: Offline-First POS & Mobile Catalog Sync (`xid8` Cursor)
สำหรับเครื่อง POS หน้าร้านหรือแอปแคตตาล็อกมือถือที่ต้องการซิงค์ข้อมูลสินค้า ราคา โปรโมชั่น และสมาชิกแบบเบาที่สุด:
- **กลไก Server (`pos_sync.go:30-175`)**:
  - PostgreSQL Triggers บนตาราง Master (`pos_sync_log()`) บันทึกรหัสคีย์ที่เปลี่ยนแปลงลงตาราง `pos_sync_change(entity, entity_key, xid xid8)`
  - เครื่องที่จับคู่ไว้แล้วเรียก `GET /api/v1/pos/sync?cursor=<last_xid>` (`DeviceOnly` Token) เพื่อรับเฉพาะ Delta ของรายการที่เปลี่ยนตั้งแต่ Cursor นั้น (ถ้าคีย์ไหนไม่มีแถวกลับมา = ถูกลบ)
- **Idempotent Bill Ingestion (`pos_bill.go`)**:
  - เครื่อง POS ส่งบิลเข้า `POST /api/v1/pos/bills` โดยกำหนด `bill_guid` (UUID) ที่สร้างจากเครื่องปลายทาง
  - Backend เก็บ Payload ดิบไว้ใน `pos_bill_inbox` ก่อน แล้วแปลงลง `ic_trans`/`ic_trans_detail`/แต้มสะสม และส่งรหัสสินค้าเข้า `pos_stock_queue` เพื่อประมวลผลต้นทุนแบบ Batch (หากส่งซ้ำด้วย `bill_guid` เดิมจะไม่เกิดบิลซ้ำ)

### Pattern C: LINE OA Webhook & กล่องรับสลิป/บิลอัตโนมัติ (`cb_line_expense_inbox`)
สำหรับเชื่อมต่อ LINE Messaging API เพื่อส่งรูปสลิปโอนเงินหรือบิลค่าใช้จ่ายเข้าฝ่ายบัญชี:
1. ตรวจสอบลายเซ็น Webhook ด้วย `VerifyLineWebhookSignature` (`sme_thai_pack.go:513`) หรือส่ง Header `X-Line-Signature` ผ่าน `POST /process/workflow/line-expense-inbox` (`workflow_handler.go:476`)
2. Backend ตรวจ HMAC-SHA256 กับ Channel Secret และบันทึกข้อมูลใน `cb_line_expense_inbox` (เก็บ `slip_image_sha256` กันสลิปซ้ำ, `qr_payload`, `trans_ref`, `sending_bank_code` และส่งแฟล็ก `hasSlipImage`/`canVerifySlip` ใน response เพื่อตรวจความพร้อมก่อนส่งตรวจสลิป)
3. ผูกบัญชี LINE User กับพนักงาน BC ผ่าน `/api/v1/admin/workspace/line-binding`
4. เมื่อตรวจสอบแล้ว กดแปลงรายการใน Inbox เป็นใบเบิกค่าใช้จ่าย (`EXPENSE_CLAIM`) หรือรายการตรวจสลิป (`SLIP_LOG`) ได้ใน Transaction เดียวพร้อมล็อกแถว `FOR UPDATE` (`convertLineExpenseInboxTx`, idempotent หากแปลงแล้ว)
5. รายการที่สถานะ `CONVERTED` แล้วจะถูกล็อกไม่ให้ลบตรงผ่าน `deleteLineExpenseInboxTx` (คืน Conflict) และหากลบเอกสารปลายทาง (`deleteExpenseClaimTx` / `deleteSlipVerificationTx`) ระบบจะรีเซ็ตแถวต้นทางใน `cb_line_expense_inbox` กลับเป็น `PENDING` ให้อัตโนมัติ

### Pattern D: Online Billing & Customer Slip Verification Portal
สำหรับสร้างลิงก์ส่งให้ลูกค้าปลายทางทาง LINE/Email เพื่อสแกน PromptPay QR และอัปโหลดสลิปกลับมาตัดหนี้:
1. ระบบหลังบ้านเรียก `POST /process/workflow/public-bill-link` (`op: "create"`) -> ได้ URL ที่มี HMAC-SHA256 Signed Token
2. ลูกค้าเปิดผ่าน `GET /public/bill-pay/{token}` (ไม่ต้องล็อกอิน) แล้วอัปโหลดสลิปผ่าน `POST /public/bill-pay/{token}` (จำกัด PNG/JPG/WEBP <= 2.5 MB พร้อมตรวจ Magic Bytes)
3. รายการจะเด้งแจ้งเตือนเข้า Morning Briefing (`PENDING_APPROVAL`) และเมื่อบัญชีอนุมัติ (`confirm-slip`) จะออกใบรับชำระหนี้ใน `ap_ar_trans` (`trans_flag = 239`) ตัดบิลให้อัตโนมัติ

### Pattern E: Operational Workflows & MinIO Evidence Media
- ระบบคลัง WMS, ขนส่ง TMS, จัดซื้อ Procure, e-Tax, CRM และ AutoCare รองรับการอัปโหลดรูปหลักฐานแบบ `multipart/form-data` (ฟิลด์ `photos` / `photo`) ซึ่ง Backend จะบีบอัดเป็น JPEG + Thumbnail เก็บใน MinIO แล้วส่ง URL Proxy (`/api/v1/crm/image?...`, `/api/v1/pos/image?...`) กลับมาใช้งานข้ามระบบได้อย่างปลอดภัยโดยไม่เปิด Public Bucket MinIO ออกนอกเครือข่าย
