---
title: "สภาที่ปรึกษา AI และการตรวจด้วยตาจากรูปจริง (กฎข้อ 27–28, Visual Self-Audit)"
tags: [standards, ai-advisors, visual-audit, ux, uat]
aliases: ["ask_deepseek", "deepseek-reasoner", "สภาที่ปรึกษา 3 สมอง", "Dual-Advisor Council", "Gemini Visual Self-Audit", "@GEMINI_IMAGE", "assets/generated", "เปิดดูรูปจริงก่อนบอกเสร็จ", "กฎข้อ 27", "กฎข้อ 28"]
sources: ["AGENTS.md:78-81", "AGENTS.md:82-84", "CLAUDE.md:15-17", "CLAUDE.md:21-22", "scripts/ask_deepseek.mjs:4-6", "scripts/ask_deepseek.mjs:11-29", "scripts/ask_deepseek.mjs:48", "scripts/ask_deepseek.mjs:81", ".gitignore:38-42", "frontend/src/app/login/page.tsx:547-551"]
---

# สภาที่ปรึกษา AI และการตรวจด้วยตาจากรูปจริง

สองกฎท้ายของ `AGENTS.md` (ข้อ 27 และ 28 จากทั้งหมด 28 ข้อ, `AGENTS.md:33`) กับข้อ 4 และข้อ 6 ของ `CLAUDE.md` กำหนดวิธีขอความเห็นที่สองและวิธีตรวจหน้าจอ/รายงาน/PDF ก่อนบอกว่างานเสร็จ

## กฎข้อ 27 สภาที่ปรึกษา 3 สมอง (`AGENTS.md:78-81`)
- สงสัยเรื่องระบบงาน ERP บัญชี ภาษี สต็อก หรือธุรกิจเอเชีย-ไทย → ถาม DeepSeek รุ่น `deepseek-reasoner` โหมด Thinking ผ่าน `node scripts/ask_deepseek.mjs "คำถาม…"` คู่กับการตรวจโค้ดจริงเสมอ
- งานยาก/สถาปัตยกรรม/UX-UI พรีเมียม → ใช้ที่ปรึกษาคู่ขนาน (Dual-Advisor Council) คือ Claude Code (`claude -p`) กับ `ask_deepseek.mjs` ระดมความเห็นก่อนลงมือ
- `CLAUDE.md:21-22` ย้ำกฎเดียวกันในส่วนของ Claude Code

### สคริปต์ `scripts/ask_deepseek.mjs` (ตรวจกับโค้ด)
- ตั้งโมเดลเป็น `deepseek-reasoner` ตายตัว (`:48`) และอ่านผลส่วน `reasoning_content` แยกจากคำตอบ (`:81`)
- หา `DEEPSEEK_API_KEY` จากไฟล์ `.env.local` ตามลำดับ: โฟลเดอร์ที่รัน, `uat/openhands-swarm/.env.local`, แล้วไฟล์ที่ path ตายตัวสองตำแหน่งของเครื่องพัฒนา — ถ้าไม่เจอจึงตกไปอ่านตัวแปรสภาพแวดล้อม `DEEPSEEK_API_KEY` (`:11-29`) ซึ่งกว้างกว่าที่ `AGENTS.md:81` เขียนว่า "จาก `.env.local` เท่านั้น"
- ไม่มี key → พิมพ์ `Missing DEEPSEEK_API_KEY in .env.local` (`:43`)
- ไฟล์ `.env*` ถูก ignore ทั้งหมด ยกเว้น `.env.example` (`.gitignore:38-42`) — key จึงต้องอยู่ใน `.env.local` เท่านั้น ห้ามใส่ในโค้ด แชท หรือ git (กฎข้อ 21)

### ข้อสังเกตประกอบการใช้ (อนุมานจากโค้ด ไม่ใช่ข้อความในกฎ)
- สคริปต์ส่งข้อความคำถามออกไปยัง API ภายนอก จึงไม่ควรใส่ข้อมูลลูกค้า ตัวเลขบัญชีจริง หรือ secret ลงในคำถาม
- ผลจากที่ปรึกษาเป็นความเห็น ไม่ใช่หลักฐาน — ยังต้องยืนยันกับโค้ดและฐานข้อมูลจริงตามกฎข้อ 15–16 (`AGENTS.md:56-57`)
- กฎข้อนี้เป็นกฎของ repo ผู้ใช้เครื่องมือ AI ตัวอื่นอาจมีนโยบายส่วนตัวจำกัดการส่งงานให้ AI ค่ายอื่น ให้ถามเจ้าของงานก่อนเรียก

## กฎข้อ 28 ตรวจด้วยตาจากรูปจริงเสมอ (`AGENTS.md:82-84`)
ทุกครั้งที่สร้างหรือแก้หน้าจอ เมนู ตาราง รายงาน หรือ PDF (รวมหลังรัน UAT ที่ `http://localhost:3050/`) ต้องแคปภาพหน้าจอจริง หรือดึงรูปจากผลรัน/รายงาน/PDF แล้ว**เปิดดูรูปด้วยเครื่องมืออ่านไฟล์ (`read_file`) ซ้ำอีกรอบ** ห้ามดูแค่ `status: passed` หรือ exit code

รายการที่ต้องดูด้วยตา (`AGENTS.md:84`):
1. ความอ่านง่ายทั้งโหมดสว่างและโหมดมืด
2. ระนาบ Baseline เดียวกันเป๊ะ
3. โครงสร้างต้นไม้/การเยื้อง
4. ตารางกว้าง 100% และไม่ปัดบรรทัดตัวเลข
5. ข้อมูลในรายงาน/PDF แสดงครบ ไม่เพี้ยน

ข้อกำหนดทางเทคนิคที่รองรับข้อนี้ดูที่ [[std-display-readability-rules]] (ความอ่านง่าย/ตารางกว้าง), [[std-report-pdf-thai-wrap-multilevel]] (PDF), [[std-uat-swarm-dsl-and-tester-rules]] (การเก็บภาพจาก BC Ai Tester)

## ภาพประกอบจากภายนอกตาม `CLAUDE.md` ข้อ 4 (`CLAUDE.md:15-17`)
เมื่อหน้าจอต้องการภาพประกอบ (Hero Banner, Empty State, 3D Icon, พื้นหลัง) ให้ชี้ path รูปไปที่ `/assets/generated/<ชื่อไฟล์>.png` และใส่คอมเมนต์ `// @GEMINI_IMAGE: <prompt อังกฤษ>` ที่จุดนั้นเพื่อให้ผู้สร้างภาพทำภาพจริงมาใส่ภายหลัง

ตัวอย่างในโค้ดจริง: คอมเมนต์ `@GEMINI_IMAGE` อยู่ที่ `frontend/src/app/login/page.tsx:547` และ `<img src>` ที่บรรทัด 551 ชี้ไปที่ `/assets/generated/login-hero-3d.png` ซึ่งมีไฟล์จริงที่ `frontend/public/assets/generated/login-hero-3d.png`

## ที่มา
- `AGENTS.md` กฎข้อ 27 และ 28
- `CLAUDE.md` ข้อ 4 และ 6
- `scripts/ask_deepseek.mjs` (อ่านโค้ดจริง)

## ดูเพิ่ม
[[standards-overview]] · [[std-repo-scope-rules]] · [[std-uat-swarm-dsl-and-tester-rules]] · [[std-display-readability-rules]]
