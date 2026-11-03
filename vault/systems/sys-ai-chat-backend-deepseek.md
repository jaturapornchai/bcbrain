---
title: "แชท AI ฝั่ง Go: เรียก DeepSeek พร้อมบริบทข้อมูลจริง (AI chat handler)"
tags: [systems, ai, deepseek, backend, go]
aliases: ["ai handler", "aihttp.Handler", "buildDbContext", "discoverDeepSeekModels", "fetchBcBrainKnowledge", "ask_brain", "resolveDeepSeekKey", "BC AI Copilot system prompt"]
sources: ["backend/internal/adapter/inbound/http/ai/handler.go:29", "backend/internal/adapter/inbound/http/ai/handler.go:111", "backend/internal/adapter/inbound/http/ai/handler.go:409", "backend/internal/adapter/inbound/http/ai/handler.go:598", "backend/internal/adapter/inbound/http/ai/handler.go:669", "backend/internal/adapter/inbound/http/ai/handler.go:776", "backend/internal/adapter/inbound/http/ai/handler.go:881", "backend/internal/di/container.go:121", "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:12", "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:20", "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:38", "backend/internal/adapter/inbound/http/ai/context_sales_ar_test.go:18", "backend/internal/adapter/inbound/http/ai/context_sales_ar_test.go:58"]
---
# แชท AI ฝั่ง Go: เรียก DeepSeek พร้อมบริบทข้อมูลจริง

แพ็กเกจ `backend/internal/adapter/inbound/http/ai` มี handler เดียว (`Handler`) กับ 2 endpoint ใต้ `/api/v1/ai` ภาพรวมของทั้งระบบอยู่ที่ [[sys-ai-overview]] บันทึกนี้ลงรายละเอียดฝั่ง Go

## endpoint

| เมธอด | path | หน้าที่ |
|---|---|---|
| GET | `/api/v1/ai/context` | สร้างสรุปข้อมูลจริง (`summaryText` + ตัวเลข KPI) และรายชื่อโมเดลล่าสุด |
| POST | `/api/v1/ai/chat` | รับบทสนทนา ประกอบ system prompt แล้วเรียก DeepSeek |

ทั้งสองต้องมี access token (อ่าน claims จาก middleware) ถ้าไม่มีตอบ `KindUnauthorized` และก่อนสร้างบริบทจะเรียก `ensureSeeded` ที่ DI ตั้งไว้ ซึ่งสั่ง `EnsureSeeded` ของโมดูล CRM, WMS, จัดซื้อ, TMS, e-Tax, ตลาด และAutoCare ตามลำดับ เพื่อให้ตารางที่ SQL อ้างถึงมีอยู่ก่อน

## บริบทข้อมูลจริง (`buildDbContext`)

ส่ง SQL ชุดเดียว 12 คำสั่งผ่าน `BatchUseCase.Batch` (อ่านอย่างเดียว) ในฐานข้อมูลของกิจการที่ล็อกอินอยู่:

| # | เนื้อหา |
|---|---|
| 1 | KPI รวม: ยอดขาย (`trans_flag = 44`) จำนวนบิล มูลค่าสต็อก จำนวนสินค้า ลูกค้า ผู้จำหน่าย |
| 2 | สินค้ามูลค่าคงคลังสูงสุด 5 อันดับ |
| 3 | ลูกค้ายอดซื้อสะสมสูงสุด 5 อันดับ (บิลขาย 44 และ 36) |
| 4 | เอกสารธุรกรรมล่าสุด 5 รายการ |
| 5 | ช่องเก็บคลัง WMS (`wms_stock_bin`) 5 แถว |
| 6 | ใบงานคลัง WMS (`wms_fulfillment_order`) 5 แถว |
| 7 | กิจกรรมลูกค้า CRM ล่าสุด 4 แถว |
| 8 | ใบคุมรถ TMS ล่าสุด 4 แถว |
| 9 | ใบสั่งซื้อระบบจัดซื้อล่าสุด 4 แถว |
| 10 | ทะเบียนเอกสาร e-Tax ล่าสุด 4 แถว |
| 11 | ยอดขายเดือนนี้ตามสินค้า (ขาย 44 หักรับคืน/ลดหนี้ 48) 5 อันดับ |
| 12 | ลูกหนี้ค้างชำระเกินกำหนด ณ วันนี้ 8 ราย |

กติกาที่ควรรู้:
- ข้อ 11-12 อยู่ในไฟล์ `context_sales_ar.go` และส่งเงินกลับเป็น `NUMERIC::text` เพื่อไม่ผ่าน float64 ส่วนข้อ 1-10 ยังอ่านเป็นตัวเลขทศนิยมแล้วจัดรูปข้อความ
- ข้อ 12 คิดยอดค้างจากเอกสารหนี้ (flag 44 ขายเชื่อ, 46, 93, 95, 99, 101, 250) หักรับคืน/ลดหนี้ (48, 97, 103) แล้วหักรายการรับชำระ (flag 239) วันครบกำหนดใช้ `credit_date` ถ้าไม่มีใช้ `doc_date + credit_day`
- ถ้า gateway ปฏิเสธ SQL ข้อใดข้อหนึ่ง `Batch` จะล้มทั้งชุด (ตามคอมเมนต์ใน test) ใน `Chat` ถ้าสร้างบริบทไม่สำเร็จจะตอบต่อโดยไม่มีสรุปข้อมูล ส่วน `GET /context` จะคืน error
- คำเตือนภาษีคงที่ `vatTaxPointFact` ถูกแทรกใน system prompt: การขายสินค้าอ้าง ม.78(1) การให้บริการอ้าง ม.78/1(1) ห้ามอ้าง ม.78/1 กับการขายสินค้า (เพราะโมเดลเคยอ้างผิด)

## การประกอบคำสั่งถาม (`Chat`)

1. อ่านคีย์ด้วย `resolveDeepSeekKey` ถ้าว่างตอบ error ทันที
2. เลือกโมเดลจากชื่อที่ขอ: ว่าง/`auto`/`latest`/`flash` ใช้รุ่น flash ล่าสุด, `pro`/`deepseek-chat` ใช้รุ่น pro, `reasoner` ใช้รุ่น reasoner, ชื่ออื่นต้องตรงกับรายชื่อโมเดลที่ DeepSeek ประกาศ
3. โหมดผลลัพธ์ `outputMode` ว่างให้ถือเป็น `pdf` (ที่เหลือ `standard`, `html`, `table`) แต่ละโหมดมีข้อความกำกับรูปแบบคำตอบต่างกัน เช่น `pdf` บังคับโครงรายงานทางการ A4, `table` บังคับตาราง Markdown
4. ตัดประวัติเหลือ 20 ข้อความท้าย เฉพาะ role `user`/`assistant` ที่ไม่ว่าง และตัดแต่ละข้อความไม่เกิน 16,000 ตัวอักษร
5. ถ้า client ไม่ส่ง `dbContextSummary` มา จะสร้างบริบทใหม่เองด้วย `buildDbContext`
6. ไฟล์แนบรับไม่เกิน 5 ไฟล์ ข้อความที่สกัดแล้วตัดไม่เกิน 5,000 ตัวอักษรต่อไฟล์ ภาพส่งเป็นคำบรรยาย (ชื่อ ขนาด สีโดยรวม ข้อความจากภาพ) ไม่ได้ส่งภาพจริงให้โมเดล และต่อท้ายข้อความผู้ใช้ล่าสุด
7. ถามสมอง BC ด้วยคำถามผู้ใช้ล่าสุด (ดูหัวข้อถัดไป) แล้วใส่ผลใน system prompt
8. system prompt ประกอบด้วย บทบาท "BC AI Copilot", ข้อเท็จจริงภาษีคงที่, ชื่อห้องแชทและบทบาทเฉพาะห้อง, ชื่อฐานข้อมูลกับผู้ให้บริการของกิจการ, สรุปข้อมูลจริง, ความรู้จากสมอง BC, คำสั่งรูปแบบผลลัพธ์
9. เรียก `POST https://api.deepseek.com/chat/completions` ด้วย `max_tokens` 6000, `stream: false` และถ้าโมเดลไม่ใช่ `deepseek-reasoner` จะตั้ง `temperature` 0.4 กับปิดโหมดคิด (`thinking` เป็น `disabled`)
10. HTTP client ของ handler หมดเวลาใน 55 วินาที ตอบกลับ `content`, `reasoning`, `model` (ชื่อที่ DeepSeek ตอบจริง และจำไว้เป็น `runtimeModel`), `requestedModel`, รายชื่อโมเดล และ `usage`

## ค้นหาโมเดลล่าสุดอัตโนมัติ (`discoverDeepSeekModels`)

- เรียก `GET /models` ของ DeepSeek (timeout 6 วินาที) เรียงจากใหม่สุด แล้วจัดกลุ่มตามชื่อ: มี `reasoner`/`-r1`/`-r2` = reasoner, มี `flash`/`lite`/`mini` = flash, มี `pro`/`chat`/`deepseek-v` = pro
- ผลถูก cache 30 นาทีในหน่วยความจำ ถ้าไม่มีคีย์หรือเรียกไม่สำเร็จใช้ค่า default: `deepseek-flash`, `deepseek-v4-pro`, `deepseek-reasoner`
- โหมด "อัตโนมัติ" จึงเลือกรุ่น flash (ถูกสุด) เสมอ

## อ่านคีย์ DeepSeek (`resolveDeepSeekKey`)

ลำดับ: env `DEEPSEEK_API_KEY` ก่อน ถ้าไม่มีอ่านบรรทัด `DEEPSEEK_API_KEY=` จากไฟล์ `.env.deepseek` / `.env.local` ในโฟลเดอร์ทำงาน, โฟลเดอร์แม่, `../frontend/.env.local` และไฟล์คู่เดียวกันใต้โฟลเดอร์เว็บของเซิร์ฟเวอร์ คีย์ห้ามเขียนลง git ค่าจริงอยู่ในเครื่อง/เซิร์ฟเวอร์เท่านั้น

## ความรู้จากสมอง BC (`fetchBcBrainKnowledge`)

- ส่ง JSON-RPC `tools/call` ชื่อ tool `ask_brain` ไปยัง MCP ของสมอง BC (ที่อยู่จาก env `BCBRAIN_MCP_URL`, ไม่ตั้งใช้ค่า default ในโค้ด) ด้วยคำถามผู้ใช้ล่าสุด (ตัดไม่เกิน 400 ตัวอักษร ต้องยาวอย่างน้อย 2)
- timeout 4 วินาที ถ้าเรียกไม่ได้หรือไม่ใช่ 2xx คืนข้อความว่างและแชทยังตอบต่อได้ตามปกติ
- ข้อความที่ได้ตัดไม่เกิน 2,800 ตัวอักษร แล้วใส่เป็นหัวข้อ "ความรู้โครงสร้างตาราง กฎบัญชี และพิกัดโค้ดจริง" ใน system prompt
- เส้นทาง fallback ของ Next (เมื่อ Go ล้ม) ไม่มีขั้นตอนนี้ ดู [[sys-ai-chat-workspace-frontend]]

## การทดสอบ

- `TestSalesAndArSQLPassGatewayValidation` ตรวจว่า SQL ยอดขาย/ลูกหนี้ผ่านตัวตรวจ SELECT/WITH ของ gateway (รันได้โดยไม่ต้องมีฐานข้อมูล)
- `TestBuildDbContextLiveSalesAndAr` ต่อฐานข้อมูลจริง ต้องตั้ง env `AI_TEST_PG_DSN` ไม่ตั้งจะข้าม
- วิธีรัน test ทั้งหมดอยู่ที่ [[sys-tests-overview]]

## ที่มาในโค้ด
- `handler.go:29-59` struct `Handler` และ `NewHandler` (client 55 วินาที, ชื่อโมเดล default)
- `handler.go:111-378` `buildDbContext` (SQL 12 คำสั่งและการจัดข้อความสรุป)
- `handler.go:409-664` `Chat` ทั้งกระบวนการ (เลือกโมเดล 428-445, ตัดประวัติ 451-464, ไฟล์แนบ 501-529, system prompt 545, payload 586-595, URL 598)
- `handler.go:669-770` `discoverDeepSeekModels` (cache 30 นาทีที่ 671)
- `handler.go:776-803` `resolveDeepSeekKey`
- `handler.go:881-941` `fetchBcBrainKnowledge`
- `context_sales_ar.go:12` ข้อเท็จจริงภาษี, `:20-31` SQL ยอดขายรายเดือน, `:38-67` SQL ลูกหนี้เกินกำหนด
- `backend/internal/di/container.go:121-129` ตั้ง `ensureSeeded` ให้ handler นี้
- `context_sales_ar_test.go:18` และ `:58` test ของ SQL ชุดนี้
- ดูเพิ่ม: [[sys-ai-overview]] · [[sys-ai-chat-workspace-frontend]] · [[be-query-gateway]] · [[be-config-env]] · [[proc-ai-copilot]]
