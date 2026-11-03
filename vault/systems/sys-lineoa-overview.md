---
title: "แชท LINE OA สำหรับลูกค้าและแอดมิน (sys-lineoa)"
tags: [systems, lineoa, chat, ai, sales]
aliases: ["LINE OA", "LINE Official Account", "แชท LINE OA", "/lineoa", "LineOaChatStudio", "น้องบีซี"]
sources: ["frontend/src/app/lineoa/page.tsx:5-16", "frontend/shared/layout/SystemPortalScreen.tsx:266-277", "frontend/shared/layout/PersistentWorkspaceHost.tsx:54", "frontend/shared/layout/PersistentWorkspaceHost.tsx:166", "frontend/shared/layout/PersistentWorkspaceHost.tsx:562", "frontend/lineoa/LineOaChatStudio.tsx:650-651", "frontend/lineoa/LineOaChatStudio.tsx:754-757", "frontend/lineoa/LineOaChatStudio.tsx:1906-1923", "frontend/src/app/api/lineoa/route.ts:111-215", "frontend/src/app/api/lineoa/route.ts:228-275", "frontend/src/app/api/lineoa/route.ts:276-358", "frontend/src/app/api/lineoa/route.ts:369-378", "frontend/src/app/api/lineoa/route.ts:391-400", "frontend/src/app/api/lineoa/route.ts:526-570", "frontend/src/app/api/lineoa/route.ts:573-594", "frontend/src/proxy.ts:10-25", "frontend/src/proxy.ts:66-70", "frontend/src/lib/session.ts:215-218"]
---
# แชท LINE OA สำหรับลูกค้าและแอดมิน (sys-lineoa)

ระบบ `/lineoa` เป็นหน้าจอห้องแชทแบบ LINE Official Account ใช้จำลองการคุยกับลูกค้าและให้แอดมินใช้ AI ช่วยตอบ คำอธิบายใน metadata ระบุว่าเป็น "ระบบจำลองและบริหารแชทลูกค้า" ที่ต่อกับ DeepSeek AI และฐานข้อมูล (`page.tsx:5-13`) งานแชท AI และปุ่มเปิดบิลอยู่ที่ [[sys-lineoa-chat-ai]] ส่วนการผูกบัญชี LINE กับอีเมลพนักงานอยู่ที่ [[sys-lineoa-line-binding]]

> ข้อสังเกตจากโค้ด: ค้นใน `backend/` และ `frontend/` แล้วไม่พบการเรียก LINE Messaging API, webhook หรือการตรวจลายเซ็นของ LINE ข้อความทั้งหมดเกิดในหน้าจอนี้และส่งผ่าน `/api/lineoa` เท่านั้น ยังไม่มีการรับ-ส่งข้อความกับ LINE จริง

## ใครใช้ และเปิดอย่างไร

- ถ้ายังไม่มี session หน้า `/lineoa` จะส่งไป `/login` และถ้ายังไม่เลือกฐานจะส่งไป `/select-database` (`page.tsx:15-16`)
- เปิดจากการ์ด "แชท LINE OA (ศูนย์รวมแชทลูกค้า LINE)" รหัส `SYS-11` ในกลุ่ม `growth` (`SystemPortalScreen.tsx:266-277`) ตัวหน้าจอคือ `LineOaChatStudio` ที่ workspace host โหลดเมื่อ path ขึ้นต้นด้วย `/lineoa` (`PersistentWorkspaceHost.tsx:54`, `:166`, `:562`) ดู [[fe-app-shell-routing]]
- โดเมนสาธิตเปิด `/lineoa` ได้โดยไม่ต้องล็อกอิน เพราะ path นี้อยู่ใน `BCDEMO_ALLOWED_PATHS` (`proxy.ts:10-25`) และ `getSession` สร้าง session สาธิตให้เมื่อคำขอมาจากโดเมนสาธิต (`frontend/src/lib/session.ts:215-218`)
- หน้าจอมี 2 มุมมอง (`perspective`): `CUSTOMER_SIMULATOR` ให้ผู้ใช้พิมพ์แทนลูกค้า และ `ADMIN_COPILOT` ให้แอดมินสั่งงาน AI ค่าเริ่มต้นคือมุมมองลูกค้า (`LineOaChatStudio.tsx:650-651`, `:1906-1923`)

## Endpoint ฝั่ง Next (`/api/lineoa`)

| Method / action | ทำอะไร |
|---|---|
| `GET` | ดึงข้อมูลจริงจากฐานมาแสดงในห้องแชท และอ่านการผูก LINE ของผู้ใช้ |
| `POST` `CHAT` | ส่งข้อความให้ AI ตอบ ดู [[sys-lineoa-chat-ai]] |
| `POST` `CREATE_LINE_ORDER` | ปุ่มยืนยันเปิดบิลจาก Flex card ดู [[sys-lineoa-chat-ai]] |
| `POST` `BIND_LINE_EMAIL` / `UNBIND_LINE_EMAIL` | ผูกหรือยกเลิกผูก LINE User ID กับอีเมล ดู [[sys-lineoa-line-binding]] |

ชนิดของ action และ body อยู่ที่ `route.ts:573-594` หน้าจอเรียก `GET /api/lineoa` ตอนเปิด (`LineOaChatStudio.tsx:754-757`)

## ข้อมูลที่ GET อ่าน

route ส่ง SQL 8 ชุดไปที่ `/query/batch` ของ backend ในคำขอเดียว (`route.ts:276-358`, `:369-378`) ดู [[api-query-gateway]]

| ชุด | แหล่งข้อมูล |
|---|---|
| 0 KPI | จำนวนลูกค้าใน `ar_customer`, ผู้ซื้อที่มีเอกสารธง 40/36/44, จำนวนและยอดธง 44 และ 36 ใน `ic_trans`, มูลค่าสต็อก Σ `balance_qty × average_cost` และจำนวนสินค้าใน `ic_inventory` |
| 1 ลูกค้า | `ar_customer` + `ar_customer_detail` + ยอดซื้อจาก `ic_trans` ไม่เกิน 18 ราย ถ้าบางช่องว่างจะใส่ค่าตั้งต้นในโค้ด (ไม่คัดลอกมาที่นี่) |
| 2 สินค้า | `ic_inventory` เรียงตามมูลค่าคงเหลือ ไม่เกิน 18 รายการ |
| 3 เอกสารขายล่าสุด | `ic_trans` ธง 40/36/44 ไม่เกิน 24 ใบ |
| 4-5 คลัง | `wms_stock_bin` และ `wms_fulfillment_order` อย่างละไม่เกิน 12 แถว |
| 6 ขนส่ง | `tms_trip_manifest` ไม่เกิน 10 เที่ยว |
| 7 e-Tax | `etax_document_log` ไม่เกิน 10 แถว ดู [[sys-etax-overview]] |

- ถ้าเป็นฐาน `bcdemo` และ KPI ไม่มีค่า จะใช้ตัวเลขสาธิตแทน ส่วนฐานอื่นใช้ 0 (`route.ts:391-400`)
- คำตอบมี `dbContextSummary` ซึ่งเป็นข้อความสรุปข้อมูลข้างต้นสำหรับส่งต่อให้ AI (`:526-552`) ถ้าเรียก backend ไม่ได้จะตอบ `ok: true` พร้อมข้อความ "ใช้ข้อมูลเริ่มต้นชั่วคราว" (`:555-570`)
- ก่อนดึงข้อมูล route อ่านการผูก LINE ผ่าน admin endpoint เมื่อมีกุญแจใน env `ADMIN_API_KEY` (`:228-275`)

ความหมายของธงดูที่ [[acc-trans-flag-map]]

## Session และบัญชีสาธิต

`resolveDemoOrSessionToken` ใช้ token จาก session ก่อน ถ้าไม่มี session จะล็อกอิน backend อัตโนมัติด้วยบัญชีสาธิตที่กำหนดในโค้ด (ไม่คัดลอกค่ามาที่นี่) แล้วใช้ฐานสาธิตแทน (`route.ts:111-215`)


## ความสัมพันธ์กับระบบบัญชี

- GET อ่านอย่างเดียวจาก [[tbl-ic-trans]], [[tbl-ar-customer]], [[tbl-ar-customer-detail]] และ [[tbl-ic-inventory]]
- การเปิดบิลจากแชทเรียก [[sys-market-overview]] และ [[sys-crm-overview]] ต่อ แต่ไม่ได้เขียน `ic_trans` เอง ดู [[sys-lineoa-chat-ai]]

## ที่มาในโค้ด

- `frontend/src/app/lineoa/page.tsx:5-16` metadata และ redirect
- `frontend/shared/layout/SystemPortalScreen.tsx:266-277` การ์ดระบบ, `frontend/shared/layout/PersistentWorkspaceHost.tsx:54`, `:166`, `:562` โหลดหน้าจอ
- `frontend/lineoa/LineOaChatStudio.tsx:650-651`, `:1906-1923` มุมมองหน้าจอ, `:754-757` เรียก GET
- `frontend/src/app/api/lineoa/route.ts:111-215` เลือก token และบัญชีสาธิต
- `frontend/src/app/api/lineoa/route.ts:228-275` อ่านการผูก LINE, `:276-358` SQL 8 ชุด, `:369-378` ส่งเข้า `/query/batch`
- `frontend/src/app/api/lineoa/route.ts:391-400` ค่า KPI สาธิต, `:526-570` รูปคำตอบ, `:573-594` ชนิดของ action
- `frontend/src/proxy.ts:10-25` path ที่โดเมนสาธิตเปิดได้, `:66-70` `matcher`
- `frontend/src/lib/session.ts:215-218` session สาธิตตามโดเมน
- ดูเพิ่ม: [[sys-lineoa-chat-ai]] · [[sys-lineoa-line-binding]] · [[proc-ai-copilot]] · [[api-business-modules]]
