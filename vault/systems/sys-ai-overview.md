---
title: "ระบบ AI Copilot ภาพรวม (AI System Overview)"
tags: [systems, ai, deepseek, copilot]
aliases: ["AI Copilot", "BC AI Copilot", "ถามตอบ AI", "หน้า /ai", "DeepSeek", "/api/v1/ai/chat", "AiChatWorkspace"]
sources: ["backend/internal/adapter/inbound/http/ai/handler.go:1", "backend/internal/adapter/inbound/http/router.go:270", "backend/internal/di/container.go:111", "frontend/src/app/ai/page.tsx:9", "frontend/shared/layout/Header.tsx:124", "backend/internal/adapter/inbound/http/ai/context_sales_ar_test.go:16", "frontend/src/app/api/ai/chat/route.ts:130", "frontend/src/app/api/ai/context/route.ts:17", "frontend/ai/AiChatWorkspace.tsx:486", "frontend/shared/layout/PersistentWorkspaceHost.tsx:165"]
---
# ระบบ AI Copilot ภาพรวม

BC AI Account มี "ผู้ช่วย AI" สองส่วนที่ทำงานต่างกัน อย่าสับสน

| ส่วน | ทำอะไร | อยู่ที่ไหน | อ่านต่อ |
|---|---|---|---|
| ตัวช่วยแบบกฎ (rule-based) | ตรวจ SQL แบบอ่านอย่างเดียว, แปลงคำสั่งภาษาไทยเป็น SQL, วิเคราะห์รายงานตามกฎ | `backend/internal/application/process/ai_copilot.go` | [[proc-ai-copilot]] |
| แชท AI (DeepSeek) | คุยถามตอบภาษาไทยโดยใช้ข้อมูลจริงของกิจการเป็นบริบท | หน้า `/ai` + `backend/.../http/ai/handler.go` | บันทึกนี้และ 2 บันทึกลูก |

บันทึกนี้อธิบายเฉพาะ "แชท AI" ที่เรียกโมเดล DeepSeek

## เส้นทางของคำถามหนึ่งข้อ

```
ผู้ใช้พิมพ์ในหน้า /ai  (AiChatWorkspace.tsx)
  -> POST /api/ai/chat          (Next.js route handler, ตรวจ session)
     -> POST /api/v1/ai/chat    (Go backend, ตรวจ access token)
        -> ดึงสรุปข้อมูลจริงจากฐานข้อมูลกิจการ (batch SQL อ่านอย่างเดียว)
        -> ถามสมอง BC (tool ask_brain) เพื่อแนบความรู้โครงสร้างตาราง/กฎบัญชี
        -> POST api.deepseek.com/chat/completions
     <- { content, reasoning, model, availableModels, usage }
  ถ้า Go ตอบไม่สำเร็จ: Next เรียก DeepSeek เองโดยตรง (fallback ไม่มีข้อมูลสมอง BC)
```

- หน้า `/ai` เป็น server page ที่ตรวจ session แล้วเปิด workspace กลาง (ถ้าไม่ได้ล็อกอินไป `/login`, ถ้ายังไม่เลือกฐานข้อมูลไป `/select-database`)
- ตัวหน้าจอจริงคือ `AiChatWorkspace` โหลดแบบ dynamic ใน `PersistentWorkspaceHost` เมื่อ path ขึ้นต้นด้วย `/ai`
- เมนู "ระบบ ถามตอบ AI" อยู่ที่ `Header.tsx` ชี้ไป `/ai`
- Go ลงทะเบียน 2 เส้นทางใต้ `/api/v1/ai` (ทั้งสองต้องมี access token): `GET /context` และ `POST /chat`

## ค่าตั้งต้นที่ต้องมี

| ชื่อ | ใช้ทำอะไร |
|---|---|
| env `DEEPSEEK_API_KEY` | คีย์เรียก DeepSeek (ค่าอยู่ใน env ไม่เขียนลงโค้ดหรือเอกสาร) ถ้าไม่มี Go ตอบ error ว่ายังไม่ได้ตั้งค่า |
| env `BCBRAIN_MCP_URL` | ที่อยู่ MCP ของสมอง BC สำหรับ tool `ask_brain` (ไม่ตั้งก็มีค่า default ในโค้ด) |
| env `AI_TEST_PG_DSN` | ใช้เฉพาะ test ที่ต่อฐานข้อมูลจริง ดู [[sys-tests-overview]] |

รายละเอียดการอ่านคีย์ (ลำดับ env แล้วไฟล์ `.env*`) อยู่ใน [[sys-ai-chat-backend-deepseek]]

## ข้อควรรู้เรื่องข้อมูล

- สรุปข้อมูลกิจการ (ยอดขาย สต็อก ลูกค้าสูงสุด เอกสารล่าสุด ลูกหนี้เกินกำหนด ฯลฯ) ถูกประกอบเป็นข้อความแล้วส่งไปให้ DeepSeek เป็น system prompt ทุกครั้งที่เปิดโหมดใช้ข้อมูลจริง ผู้ดูแลต้องรู้ว่าข้อมูลกิจการออกไปยังผู้ให้บริการภายนอก
- SQL ที่ใช้ดึงบริบททั้งหมดเป็น SELECT/WITH ผ่าน query gateway ที่ปฏิเสธคำสั่งอื่น ดู [[be-query-gateway]]
- ตัวเลขยอดขายรายเดือนและลูกหนี้เกินกำหนดถูกส่งกลับเป็น `NUMERIC::text` เพื่อไม่ผ่าน float

## ผู้เรียก DeepSeek อื่นในโค้ด (ไม่ใช่แชทหลัก)

- ตัวออกแบบฟอร์มเอกสาร (AI Form Designer) ใน `GlobalDocFormPrintModal.tsx` เรียก `/api/ai/chat` ตัวเดียวกัน ดู [[sys-ai-chat-workspace-frontend]]
- `/api/lineoa` และ `/api/fraudwarning` มีโค้ดเรียก DeepSeek ของตัวเอง (route แยก)
- สคริปต์ที่ปรึกษาสำหรับนักพัฒนา `scripts/ask_deepseek.mjs` ดู [[sys-scripts-overview]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/ai/handler.go:1` คำอธิบายแพ็กเกจ และ handler ทั้งหมดของแชท
- `backend/internal/adapter/inbound/http/router.go:270-275` ลงทะเบียน `/api/v1/ai/context` และ `/api/v1/ai/chat` หลัง middleware ตรวจ token
- `backend/internal/di/container.go:111` สร้าง handler จาก query service
- `frontend/src/app/ai/page.tsx:9-14` หน้า `/ai` ตรวจ session แล้วเปิด workspace
- `frontend/src/app/api/ai/chat/route.ts:130` Next proxy ไป Go พร้อม fallback
- `frontend/src/app/api/ai/context/route.ts:17` proxy ขอสรุปบริบท
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:165` map path `/ai` เป็นโมดูล `ai`
- ดูเพิ่ม: [[sys-ai-chat-backend-deepseek]] · [[sys-ai-chat-workspace-frontend]] · [[proc-ai-copilot]] · [[fe-api-proxy-routes]] · [[scr-report-print-modal]]
