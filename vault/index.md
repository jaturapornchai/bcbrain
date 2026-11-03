---
title: "สมอง BC — หน้าแรก (Map of Content)"
tags: [index, moc]
aliases: ["สารบัญ", "เริ่มที่นี่", "start here"]
sources: ["AGENTS.md", "backend/README.md", "frontend/account/", "frontend/shared/layout/SystemPortalScreen.tsx:91"]
---
# สมอง BC — เริ่มที่นี่

คลังความรู้ของระบบ **BC Ai Account** (`d:\bcaiaccount`) สกัดจากซอร์สโค้ดจริงแบบอ่านอย่างเดียว ทุกโน้ตมีส่วน "ที่มาในโค้ด" อ้าง `path:line` (relative จาก root ของ repo) ให้ตามไปตรวจได้

## แผนที่สมอง

| กลุ่ม | เริ่มที่ | ครอบคลุม |
|---|---|---|
| หลังบ้าน Go | [[backend-overview]] | โครง hexagonal, identity/tenant, query gateway, blob, route HTTP, config, deploy |
| การตัดสินใจ | [[adr-index]] | ADR ของ backend ว่าเลือกอะไรเพราะอะไร |
| ตรรกะบัญชี | [[accounting-overview]] | บันทึกเอกสาร, ภาษี, GL, สต็อก/ต้นทุน, เจ้าหนี้-ลูกหนี้, เช็ค, สินทรัพย์ |
| Process Engine | [[process-overview]] | dispatcher, รายงาน, พิมพ์เอกสาร, master/lookup, สิทธิ์, เมนู |
| หน้าจอ Next.js | [[frontend-overview]] | หน้าจอ BC Ai Account, การเรียก API, auth/session, grid/form |
| มาตรฐาน & กฎ | [[standards-overview]] | กฎการทำงานกับ repo, UX, grid, รายงาน, security, UAT |
| ชนิดเอกสาร | [[doctypes-overview]] | การ์ดเอกสารทีละชนิด: trans_flag, สต็อก, VAT, Dr/Cr, เอกสารต้นทาง-ปลายทาง |
| เส้นทางงานธุรกิจ | [[flows-overview]] | จัดซื้อถึงจ่ายเงิน, ขายถึงรับเงิน, สต็อก, เช็ค, สินทรัพย์, ปิดงวด |
| ตารางข้อมูล | [[tables-overview]] | data dictionary: ตาราง, คอลัมน์, ความสัมพันธ์ |
| API & Process actions | [[api-overview]] | endpoint HTTP และ action ของ process engine ทุกตัว |
| หน้าจอทีละจอ | [[screens-overview]] | เมนู → หน้าจอ → ช่องข้อมูล, คีย์ลัด, popup |
| คำศัพท์ไทย ↔ โค้ด | [[glossary-overview]] | คำที่คนบัญชีพูด → identifier/ตาราง/คอลัมน์ในโค้ด |
| ประวัติ & บทเรียน | [[history-overview]] | บทเรียนที่โค้ดปัจจุบันกันไว้แล้ว, ข้อจำกัดที่ยังค้าง |
| ถาม-ตอบ | [[faq-overview]] | คำถามที่พบบ่อยพร้อมคำตอบอ้างอิงโน้ต |
| ระบบงานในชุด BC | [[systems-overview]] | POS, AutoCare, e-Tax, Procure, WMS, TMS, Market, Dashboard, CRM, LINE OA, AI, MonitorMap, WorkMonitor, FraudWarning, UAT/tests/scripts/video |

## วิธีใช้
- คน: เปิดโฟลเดอร์ `vault/` ด้วย Obsidian ได้ทันที หรืออ่านบนเว็บ `https://brain.bcsmethai.com/n`
- AI: เชื่อม MCP `https://brain.bcsmethai.com/mcp` (สาธารณะ ไม่ต้องใช้ key) แล้วเรียก `ask_brain` / `search_brain` / `read_note`
- โน้ตเป็น "ภาพถ่าย" ของโค้ด ณ วันที่สกัด — ถ้าขัดกับโค้ดปัจจุบัน ให้เชื่อโค้ด

## ขอบเขต
สกัดจากโฟลเดอร์ `d:\bcaiaccount` ทั้งหมดเป็นแหล่งเดียว: ระบบบัญชีหลัก (`backend/`, `frontend/account/`, `docs/kms/`, `.agents/skills/`) และทุกระบบในชุด (`frontend/<ระบบ>/`, `frontend/src/app/<ระบบ>`, `backend/internal/adapter/inbound/http/<ระบบ>`) รวมถึง `uat/`, `tests/`, `scripts/`, `video-*` — ไม่อ้างโค้ดหรือโปรแกรมภายนอก repo นี้
