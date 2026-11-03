---
title: "หน้าแชท AI /ai: ห้องสนทนา โหมดผลลัพธ์ ไฟล์แนบ และตัวออกแบบฟอร์ม (AiChatWorkspace)"
tags: [systems, ai, frontend, deepseek]
aliases: ["AiChatWorkspace", "หน้า /ai", "ห้องแชท AI", "bc_ai_rooms_v1", "โหมดผลลัพธ์ PDF HTML CSV", "AI Form Designer", "/api/ai/chat fallback"]
sources: ["frontend/ai/AiChatWorkspace.tsx:87", "frontend/ai/AiChatWorkspace.tsx:175", "frontend/ai/AiChatWorkspace.tsx:419", "frontend/ai/AiChatWorkspace.tsx:486", "frontend/ai/AiChatWorkspace.tsx:542", "frontend/ai/AiChatWorkspace.tsx:582", "frontend/ai/AiChatWorkspace.tsx:769", "frontend/ai/AiChatWorkspace.tsx:861", "frontend/ai/AiChatWorkspace.tsx:966", "frontend/ai/AiChatWorkspace.tsx:995", "frontend/ai/AiChatWorkspace.tsx:1668", "frontend/src/app/api/ai/chat/route.ts:130", "frontend/src/app/api/ai/chat/route.ts:161", "frontend/shared/components/GlobalDocFormPrintModal.tsx:3754"]
---
# หน้าแชท AI /ai

ฝั่งหน้าจอของ [[sys-ai-overview]] ทั้งหมดอยู่ในคอมโพเนนต์ `AiChatWorkspace` (ไฟล์เดียว) ส่วนฝั่งเซิร์ฟเวอร์ที่รับคำถามอยู่ใน [[sys-ai-chat-backend-deepseek]]

## ห้องสนทนา

- มีห้องตั้งต้น 4 ห้อง: วิเคราะห์ผู้บริหารและงบการเงิน, วางแผนจัดซื้อและสต็อกสินค้า, กลยุทธ์การขายและดูแลลูกค้า CRM, ที่ปรึกษาบัญชีและภาษีอากรไทย แต่ละห้องมี `systemHint` (บทบาทเฉพาะห้อง) ส่งไปเป็น `roomPrompt`
- สร้างห้องใหม่ เปลี่ยนชื่อ ลบห้อง และล้างบทสนทนาของห้องปัจจุบันได้
- ห้องและข้อความเก็บใน `localStorage` ของเบราว์เซอร์ key `bc_ai_rooms_v1` เก็บเฉพาะ 30 ข้อความท้ายของแต่ละห้อง (ภาพตัวอย่างขนาดใหญ่ไม่เก็บเพื่อกัน quota เต็ม) จึงไม่ข้ามเครื่องและไม่ข้ามผู้ใช้
- มีปุ่มคำถามลัด 4 ปุ่ม (รายงาน HTML, รายงานผู้บริหาร A4, ตารางวิเคราะห์สินค้า, ตัวอย่างลงบัญชีขายพร้อม VAT 7% และหัก ณ ที่จ่าย) ที่กดแล้วส่งคำถามพร้อมสลับโหมดผลลัพธ์ให้

## ตัวเลือกก่อนส่ง

| ตัวเลือก | ค่า | ผลต่อคำขอ |
|---|---|---|
| รุ่นโมเดล | Auto (ค่าเริ่มต้น), Flash, Pro (ส่ง `deepseek-chat`), Reasoner (`deepseek-reasoner`) | ฟิลด์ `model` ชื่อรุ่นจริงแสดงจากข้อมูลที่ backend ค้นหาให้ |
| รูปแบบคำตอบ | PDF A4 (ค่าเริ่มต้น), ข้อความและตาราง, รายงาน HTML, ตาราง CSV/Excel | ฟิลด์ `outputMode` |
| ใช้ข้อมูลจริง | เปิด (ค่าเริ่มต้น) / ปิด | เปิด = ส่งสรุปข้อมูลกิจการไปใน `dbContextSummary` ปิด = ไม่ส่ง |

## โหลดบริบทข้อมูลจริง

เมื่อเปิดหน้า จะเรียก `GET /api/ai/context` (ไปที่ Go) เพื่อได้ `summaryText` กับรายชื่อรุ่นโมเดลล่าสุด ถ้าเรียกไม่สำเร็จ หน้าจอจะประกอบสรุปเองจาก SQL 3 คำสั่งผ่านตัวส่ง query กลาง (ยอดขาย/ใบเสนอราคา/ใบสั่งขาย/สต็อก/ลูกค้า/เจ้าหนี้, สินค้ามูลค่าสูงสุด, ลูกค้ายอดซื้อสูงสุด) ซึ่งสั้นกว่าชุดของ Go (12 คำสั่ง)

## ไฟล์แนบ

- ปุ่มแนบรูป รับ `image/*` ปุ่มแนบไฟล์ รับ `.csv .txt .json .md .sql` และรูป แต่ละครั้งเลือกได้ไม่เกิน 4 ไฟล์ และวางรูปด้วย Ctrl+V ในช่องพิมพ์ได้
- ไฟล์ข้อความ: อ่านเนื้อหาแล้วตัดที่ 8,000 ตัวอักษรฝั่งหน้าจอ (Go ตัดต่อเหลือ 5,000 ต่อไฟล์ และรับไม่เกิน 5 ไฟล์)
- รูปภาพ: ไม่ได้ส่งภาพให้โมเดล หน้าจอย่อภาพเป็น 24x24 พิกเซลเพื่อหาสีเฉลี่ย แล้วส่งเป็นข้อความบรรยาย (ชื่อ ขนาด ชนิดไฟล์ โทนสว่าง/เข้มพร้อมค่า RGB) ไปกับคำถาม

## ผลลัพธ์และการส่งออก

- ข้อความตอบจะค่อยๆ พิมพ์ขึ้นทีละส่วน (typing effect) และแสดงเหตุผลการคิด (`reasoning`) เมื่อรุ่น Reasoner ส่งมา
- ตาราง Markdown ในคำตอบมีปุ่มดาวน์โหลด `.csv` (UTF-8 พร้อม BOM เพื่อให้ Excel อ่านไทยถูก)
- บล็อก ```html ในคำตอบแสดงเป็นตัวอย่างใน iframe แบบ `sandbox="allow-same-origin"` (สคริปต์ในรายงานจึงไม่ทำงาน) และมีปุ่มดาวน์โหลด `.html`
- ปุ่มส่งออก PDF เปิดหน้าต่างใหม่ในรูปเอกสาร A4 (หัวเอกสาร ตาราง ช่องลงนาม) ให้กดพิมพ์/บันทึกเป็น PDF ด้วย `window.print()` ของเบราว์เซอร์ ไม่ได้สร้าง PDF บนเซิร์ฟเวอร์

## Next route: proxy และ fallback

`POST /api/ai/chat` ใน Next ตรวจ session ก่อน แล้วส่งต่อไป Go (`/api/v1/ai/chat`) พร้อม token ถ้าได้ผลสำเร็จคืนผลนั้นทันที ถ้า Go ล้มหรือไม่มี token จะทำเองในไฟล์เดียวกัน:
- อ่านคีย์จาก env `DEEPSEEK_API_KEY` เท่านั้น (ไม่อ่านไฟล์ `.env*` แบบฝั่ง Go) ถ้าไม่มีตอบ `MISSING_API_KEY`
- ค้นหาโมเดลล่าสุดและ cache 30 นาทีเหมือน Go, ตัดประวัติ 20 ข้อความ ข้อความละ 16,000 ตัวอักษร, ไฟล์แนบ 5 ไฟล์, `max_tokens` 6000, `temperature` 0.4 และปิดโหมดคิดเมื่อไม่ใช่ Reasoner
- ไม่มีขั้นตอนถามสมอง BC และไม่เรียก `ensureSeeded` และไม่มีข้อเท็จจริงภาษีคงที่ คำตอบจึงอาจต่างจากเส้นทางหลัก
- `GET /api/ai/context` ไม่มี fallback ถ้าไม่มี token ตอบ 401 (`NO_TOKEN`)

## ตัวออกแบบฟอร์มเอกสารด้วย AI (AI Form Designer)

หน้าจอออกแบบฟอร์มพิมพ์ใน `GlobalDocFormPrintModal.tsx` (ดู [[scr-report-print-modal]]) ใช้ `/api/ai/chat` ตัวเดียวกัน โดย:
- `outputMode` เป็น `standard`, `model` เป็น `auto`, `roomTitle` เป็น "AI Form Designer Studio"
- ส่งสถานะฟอร์มปัจจุบัน (เทมเพลต ธีม ขนาดกระดาษ ทิศทาง จำนวนแถวต่อหน้า การสลับซ้ายขวา ฯลฯ) เป็น JSON ผ่านช่อง `dbContextSummary` และส่งประวัติ 6 ข้อความท้ายสุด
- `roomPrompt` สั่งให้ AI ตอบสั้นเป็นภาษาไทยและแนบบล็อก ```json ท้ายคำตอบเมื่อต้องปรับฟอร์ม
- ฝั่งหน้าจอแกะบล็อก ```json แล้วนำค่าไปตั้ง state ของแบบฟอร์ม (เช่น `companyBelowLogo`, `layoutStyle`, `themeId`, `paperSize`, `rowsPerPage`, `footerOnLastPageOnly`, `saveLayout`)

## ที่มาในโค้ด
- `frontend/ai/AiChatWorkspace.tsx:87-173` key ใน localStorage และห้องตั้งต้น, `:175-207` คำถามลัด
- `frontend/ai/AiChatWorkspace.tsx:419-485` `inspectImageFile` (ย่อภาพ 24x24 หาสีเฉลี่ย)
- `frontend/ai/AiChatWorkspace.tsx:486-541` state ของ workspace (โมเดล โหมดผลลัพธ์ ใช้ข้อมูลจริง), `:542-578` โหลด/บันทึกห้อง (เก็บ 30 ข้อความท้าย)
- `frontend/ai/AiChatWorkspace.tsx:582-665` โหลดบริบทจาก `/api/ai/context` พร้อม SQL สำรอง
- `frontend/ai/AiChatWorkspace.tsx:769-818` แนบรูป/ไฟล์/วางรูป, `:861-880` ยิง `/api/ai/chat`
- `frontend/ai/AiChatWorkspace.tsx:966-1000` ดาวน์โหลด HTML/CSV, `:995-1122` ส่งออก PDF A4, `:1668` iframe sandbox
- `frontend/src/app/api/ai/chat/route.ts:130-160` proxy ไป Go, `:161-290` fallback โดยตรง
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:3713-3830` ตัวออกแบบฟอร์มเรียกแชท
- ดูเพิ่ม: [[sys-ai-overview]] · [[sys-ai-chat-backend-deepseek]] · [[fe-api-proxy-routes]] · [[scr-report-print-modal]]
