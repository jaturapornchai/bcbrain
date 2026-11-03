---
title: "แชท AI เอกสารขายในแชท และปุ่มเปิดบิลจาก LINE OA (sys-lineoa-chat-ai)"
tags: [systems, lineoa, ai, deepseek, sales, vat]
aliases: ["CHAT LINE OA", "CREATE_LINE_ORDER", "buildSmartBcdemoLineReply", "recalcDraftDoc", "เอกสารขายในแชท", "Flex card เปิดบิล", "DEEPSEEK_API_KEY"]
sources: ["frontend/lineoa/LineOaChatStudio.tsx:129-133", "frontend/lineoa/LineOaChatStudio.tsx:721", "frontend/lineoa/LineOaChatStudio.tsx:969-996", "frontend/lineoa/LineOaChatStudio.tsx:1092-1142", "frontend/lineoa/LineOaChatStudio.tsx:1173-1188", "frontend/lineoa/LineOaChatStudio.tsx:1195-1253", "frontend/lineoa/LineOaChatStudio.tsx:1587-1640", "frontend/lineoa/LineOaChatStudio.tsx:1749-1790", "frontend/lineoa/LineOaChatStudio.tsx:3596-3620", "frontend/shared/components/GlobalDocFormPrintModal.tsx:113-160", "frontend/src/app/api/lineoa/route.ts:22-60", "frontend/src/app/api/lineoa/route.ts:671-752", "frontend/src/app/api/lineoa/route.ts:754-772", "frontend/src/app/api/lineoa/route.ts:774-813", "frontend/src/app/api/lineoa/route.ts:815-865", "frontend/src/app/api/lineoa/route.ts:867-884", "backend/internal/adapter/inbound/http/ai/handler.go:555-556", "backend/internal/adapter/inbound/http/market/handler.go:285", "backend/internal/adapter/inbound/http/market/handler.go:301", "backend/internal/adapter/inbound/http/market/handler.go:797-802", "backend/internal/adapter/inbound/http/crm/handler.go:494-505", "backend/internal/adapter/inbound/http/crm/handler.go:529-531"]
---
# แชท AI เอกสารขายในแชท และปุ่มเปิดบิลจาก LINE OA (sys-lineoa-chat-ai)

โน้ตนี้อธิบายสิ่งที่เกิดเมื่อพิมพ์ข้อความในห้องแชท `/lineoa` และเมื่อกดปุ่มยืนยันเปิดบิลบน Flex card ภาพรวมของระบบอยู่ที่ [[sys-lineoa-overview]]

## ส่งข้อความ (`sendLineMessage`)

1. หน้าจอตรวจข้อความก่อนว่าเป็นคำสั่งแก้เอกสารขายในแชทหรือไม่ (`applyConversationalDocCommand`) ถ้าใช่จะอัปเดตเอกสารร่างของลูกค้าคนนั้น (`LineOaChatStudio.tsx:1587-1600`)
2. ส่ง `POST /api/lineoa` ด้วย `action: "CHAT"`, `model`, `perspective`, ข้อมูลลูกค้า, `dbContextSummary` ต่อท้ายด้วยสถานะเอกสารร่าง และข้อความล่าสุด 12 ข้อความ (`:1629-1640`)

## ลำดับการหาคำตอบใน route (`route.ts`)

| ลำดับ | ทางที่ใช้ | เงื่อนไข |
|---|---|---|
| - | ไม่มีข้อความเลย ตอบ 400 | (`:754-760`) |
| 1 | `POST /api/v1/ai/chat` ของ backend พร้อม `roomPrompt` ตามมุมมอง | มี token ใช้คำตอบนี้เมื่อมี `content` (`:774-813`) |
| 2 | เรียก DeepSeek โดยตรง | มี env `DEEPSEEK_API_KEY` (`:815-865`) |
| 3 | `buildSmartBcdemoLineReply` สร้างคำตอบจาก `dbContextSummary` ในโค้ด | ทางสุดท้ายเมื่อสองทางแรกไม่ได้คำตอบ (`:867-884`) |

- `rolePrompt` มี 2 แบบ คือบอทตอบลูกค้าสำหรับ `CUSTOMER_SIMULATOR` และผู้ช่วยแอดมินสำหรับ `ADMIN_COPILOT` (`:762-772`) backend ใส่ข้อความนี้เป็น "บทบาทเฉพาะของห้องนี้" (`ai/handler.go:555-556`) ดู [[proc-ai-copilot]]
- ทางที่ 2 ส่ง system prompt + ข้อความล่าสุด 16 ข้อความ ตัดแต่ละข้อความไม่เกิน 12,000 ตัวอักษร ตั้ง `max_tokens` 2500 และ `temperature` 0.35 (ยกเว้นรุ่น reasoner) (`:821-846`)
- รายชื่อรุ่นของ DeepSeek ดึงจาก API แล้วเก็บไว้ในหน่วยความจำ 30 นาที (`resolveLatestDeepSeekModel`, `:22-60`)
- ค่ากุญแจอยู่ใน env `DEEPSEEK_API_KEY` เท่านั้น ไม่มีการเก็บในฐานหรือส่งให้เบราว์เซอร์ในโค้ดส่วนนี้

## เอกสารขายในแชท

ชนิดเอกสาร (`SalesDocLiveType`, `:129-133`) และปุ่มเลือกชนิด (`:3596-3620`)

| ชนิด | เลขเอกสารที่สร้าง | คำที่ทำให้เปลี่ยนเป็นชนิดนี้ |
|---|---|---|
| `QUOTATION` | `QT-6910-…` | คำสั่งออกใบเสนอราคาพร้อมชื่อรายการและราคา (`:1092-1142`) |
| `BILLING_NOTE` | `BL-6910-…` | "ใบแจ้งหนี้", "ใบวางบิล" (`:1195-1205`) |
| `TAX_INVOICE` | `INV-6910-…` | "ใบเสร็จ", "ใบกำกับภาษี", "โอนเงินแล้ว", "ชำระแล้ว" (`:1207-1221`) |
| `TOURIST_VRT` | `VRT-6910-…` | "ภ.พ.10", "นักท่องเที่ยว", "ขอคืนภาษี", "passport" ถ้าหาเลขพาสปอร์ตในข้อความไม่พบจะใส่ค่าตั้งต้นในโค้ด (`:1223-1243`) |

- คำว่า "ลดราคา" หรือ "ส่วนลด" ตั้งส่วนลดเป็นเปอร์เซ็นต์หรือจำนวนเงิน ถ้าอ่านตัวเลขไม่ได้ใช้ 1,500 (`:1173-1188`)
- `recalcDraftDoc` คิดยอดใหม่ทุกครั้ง (`:969-996`): ยอดรวมบรรทัดปัด 2 ตำแหน่ง, ส่วนลดไม่ติดลบและไม่เกินยอดรวม, ฐานภาษี = ยอดรวม − ส่วนลด, VAT = `Math.round(ฐาน × 0.07 × 100) / 100`, ยอดสุทธิ = ฐาน + VAT
- ยอดคืนภาษีนักท่องเที่ยวคำนวณด้วย `calculateThaiTouristVatRefund` (`GlobalDocFormPrintModal.tsx:113-160`) ซึ่งมีเกณฑ์ยอดขั้นต่ำและตารางขั้นบันไดในโค้ด **นี่คือสูตรในโค้ด ยังไม่ได้ตรวจเทียบประกาศ** จึงไม่สรุปตัวเลขไว้ที่นี่
- เอกสารร่างอยู่ใน state ของ React (`draftDocsByCustomer`, `:721`) ไม่ถูกบันทึกลงฐาน และคำนวณด้วย JS `number` ดู [[acc-rounding-decimal]]

## ปุ่มยืนยันเปิดบิล (`CREATE_LINE_ORDER`)

1. หน้าจอส่งเฉพาะบรรทัดแรกของ Flex card (รหัสลูกค้า ชื่อ สินค้า จำนวน ราคา ยอดรวม) ถ้าการ์ดไม่มีบรรทัดจะใช้สินค้าตัวแรกและค่าตั้งต้นในโค้ด (`LineOaChatStudio.tsx:1749-1778`)
2. route สร้างเลข `LINE-SO-<ปีเดือนวัน>-<สุ่ม 3 หลัก>` และเลข WMS/e-Tax จากเลขนั้นไว้ก่อน (`route.ts:671-680`)
3. เรียก `POST /api/v1/market/order` ด้วย body ที่มีฟิลด์ `action: "checkout_order"` และ `items` (`:682-706`) ถ้าคำตอบมี `order_no` จะใช้เลขนั้นแทน (`:707-716`)
4. เรียก `POST /api/v1/crm/activities` ด้วยฟิลด์ `activity_type`, `contact_channel`, `subject`, `description`, `owner_code`, `status` (`:722-737`)
5. error ของทั้งสองคำขอถูกกลืนเงียบ แล้ว route ตอบ `ok: true` พร้อมข้อความว่าบันทึกคำสั่งซื้อสำเร็จเสมอ (`:718-750`)

> ข้อสังเกตจากโค้ด (อ่านจากโค้ด ยังไม่ได้ทดสอบกับระบบจริง):
> - Market อ่านชื่อ action จากฟิลด์ `action_type` (`market/handler.go:285`, `:301`) แต่ LINE OA ส่ง `action` จึงไม่เข้า case ใดเลย handler ตอบ overview กลับด้วยสถานะ 200 (`:797-802`) จึงไม่มีคำสั่งซื้อ ไม่มีแถว WMS/TMS/e-Tax และหน้าจอแสดงเลข `LINE-SO-…` ที่ route สุ่มเอง
> - CRM ฝั่ง JSON รับฟิลด์ `note` (`crm/handler.go:494-505`) และบังคับว่าต้องมีค่า (`:529-531`) แต่ LINE OA ส่ง `description` จึงถูกปฏิเสธและไม่มีบันทึกกิจกรรม
> - ข้อความยืนยันในห้องแชทจึงไม่ตรงกับข้อมูลในฐาน ทางที่บันทึกคำสั่งซื้อได้จริงคือ `PLACE_B2B_ORDER` ของ [[sys-market-checkout-sync]]

## ความสัมพันธ์กับระบบบัญชี

- แชทและเอกสารร่างไม่เขียน `ic_trans`, `gl_journal` หรือทะเบียนภาษี เอกสารขายจริงต้องออกผ่าน [[doc-sale-quotation]] · [[doc-sale-invoice]] และวงจร [[flow-order-to-cash]]
- ข้อมูลที่ AI เห็นมาจาก `dbContextSummary` ที่ GET สร้างจากฐาน ดู [[sys-lineoa-overview]]

## ที่มาในโค้ด

- `frontend/lineoa/LineOaChatStudio.tsx:1587-1640` ส่งข้อความ, `:1092-1253` แปลคำสั่งในแชทเป็นเอกสาร, `:969-996` `recalcDraftDoc`, `:721` state เอกสารร่าง
- `frontend/lineoa/LineOaChatStudio.tsx:129-133`, `:3596-3620` ชนิดเอกสาร, `:1749-1790` ปุ่มยืนยันเปิดบิล
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:113-160` `calculateThaiTouristVatRefund`
- `frontend/src/app/api/lineoa/route.ts:22-60` เลือกรุ่น DeepSeek, `:754-884` ลำดับการหาคำตอบ, `:671-752` `CREATE_LINE_ORDER`
- `backend/internal/adapter/inbound/http/ai/handler.go:555-556` `roomPrompt`
- `backend/internal/adapter/inbound/http/market/handler.go:285`, `:301`, `:797-802` อ่าน `action_type` และคำตอบเมื่อไม่เข้า case
- `backend/internal/adapter/inbound/http/crm/handler.go:494-505`, `:529-531` ฟิลด์ JSON และการบังคับ `note`
- ดูเพิ่ม: [[sys-lineoa-overview]] · [[sys-market-overview]] · [[sys-crm-activity-images]] · [[sys-etax-vat-wht-summary]]
