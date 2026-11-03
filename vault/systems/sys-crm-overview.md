---
title: "ระบบบริหารความสัมพันธ์ลูกค้า (sys-crm)"
tags: [systems, crm, sales, ar, dashboard]
aliases: ["CRM", "Smart CRM 360", "บริหารความสัมพันธ์ลูกค้า", "/crm", "Kanban ดีลการขาย", "Customer 360"]
sources: ["frontend/src/app/crm/page.tsx:6", "frontend/crm/CrmDashboard.tsx:57-64", "frontend/crm/CrmDashboard.tsx:145-180", "frontend/crm/CrmDashboard.tsx:347", "frontend/crm/CrmDashboard.tsx:611-644", "frontend/crm/CrmDashboard.tsx:930-960", "frontend/shared/layout/SystemPortalScreen.tsx:250-259", "frontend/shared/layout/PersistentWorkspaceHost.tsx:158", "backend/internal/adapter/inbound/http/router.go:260-268", "backend/internal/adapter/inbound/http/crm/handler.go:155-250", "backend/internal/adapter/inbound/http/crm/handler.go:340-402", "backend/internal/application/process/pos_bill.go:267"]
---
# ระบบบริหารความสัมพันธ์ลูกค้า (sys-crm)

ระบบ `/crm` เป็นแดชบอร์ดงานขายที่อ่านข้อมูลลูกค้าและเอกสารขายจริงจากฐานบัญชี มาแสดงเป็นกระดานดีล โปรไฟล์ลูกค้า 360 องศา ตารางโทรติดตาม การจัดเกรดลูกค้า และผลงานทีมขาย ชื่อหน้าใน metadata คือ "ระบบบริหารความสัมพันธ์ลูกค้า (Smart CRM 360°)"

## ใครใช้ และเปิดอย่างไร

- ทีมขายที่ล็อกอินและเลือกฐานข้อมูลแล้ว เปิดได้จากการ์ด "CRM (บริหารความสัมพันธ์ลูกค้า 360°)" ในกลุ่ม `growth` หรือพิมพ์ `/crm` ตรง ๆ ดู [[fe-app-shell-routing]]
- หน้าจอเลือกได้ 5 โมดูล (`CrmModuleId`): `kanban` กระดานดีลการขาย, `customer360` โปรไฟล์ลูกค้า 360 องศา, `followup` ตารางโทรติดตามและนัดหมาย, `rfm` จัดเกรดลูกค้า VIP และ `salesteam` ผลงานทีมขาย (`CrmDashboard.tsx:57-62`, `:930-960`)

## Endpoint

| Method / path | handler | ทำอะไร |
|---|---|---|
| `GET /api/v1/crm/overview` | `Overview` | KPI ดีล ลูกค้า และทีมขาย |
| `GET /api/v1/crm/activities` | `ListActivities` | ประวัติการติดต่อลูกค้า |
| `POST /api/v1/crm/activities` | `CreateActivity` | บันทึกการติดต่อพร้อมรูป |
| `POST /api/v1/crm/upload` | `UploadImage` | อัปโหลดรูปเข้า MinIO |
| `GET /api/v1/crm/image` | `ServeImage` | ส่งรูปหรือภาพย่อจาก MinIO |

ทั้งหมดอยู่หลัง middleware `Auth` (`router.go:260-268`) รายละเอียดการบันทึกกิจกรรมและรูปอยู่ที่ [[sys-crm-activity-images]]

## ข้อมูลที่ Overview อ่าน (`handler.go:155-250`)

| ส่วน | แหล่งข้อมูล |
|---|---|
| KPI | `ic_trans` ธง 40 (ใบเสนอราคา), 36 (ใบสั่งขาย), 44 (ขาย), 48 (ลดหนี้) นับจำนวนและรวม `total_amount` ส่วน `ap_ar_trans` ธง 41 (วางบิล) และ 43 (รับชำระ) รวม `total_net_value` |
| กราฟ pipeline รายวัน | ยอดธง 40+36 เทียบกับยอดปิดการขายธง 44 |
| Customer 360 | `ar_customer` + `ar_customer_detail` + ยอดซื้อจาก `ic_trans` |
| ดีล | เอกสารธง 40/36/44 พร้อมรายการสินค้าจาก `ic_trans_detail` |
| ทีมขาย | `erp_user` ไม่เกิน 15 คน |

ความหมายของธงดูที่ [[acc-trans-flag-map]] และเอกสาร [[doc-sale-quotation]] · [[doc-sale-order]] · [[doc-sale-invoice]]

## กระดานดีลและเกรดลูกค้า

- ขั้นของดีลมาจากธงเอกสาร: 40 เป็น `qt`, 36 เป็น `so` และธงอื่นเป็น `won` ชื่อผู้ดูแลดีลวนตามรายชื่อทีมขาย (`handler.go:340-370`)
- ลูกค้าที่ยังไม่มีเอกสารเลยถูกสร้างเป็นการ์ด `lead` ไม่เกิน 6 ใบ ยอดดีลตั้งเป็น 1,850,000 + ลำดับ × 640,000 (`:376-402`)
- เกรดลูกค้าคิดในหน้าจอจากยอดซื้อรวม: ≥ 18,000,000 เป็น VIP Diamond, ≥ 9,000,000 เป็น Gold Loyal, > 0 เป็น Silver Active ต่ำกว่านั้นเป็นลูกค้ามุ่งหวัง (`CrmDashboard.tsx:145-180`)

> ข้อสังเกตจากโค้ด: ยอดของการ์ด `lead` เป็นตัวเลขสาธิต และการเลื่อนขั้นดีลหรือสร้างดีลใหม่บนกระดาน (`advanceDealStage`, `handleCreateNewDeal`) เปลี่ยนเฉพาะ state ในเบราว์เซอร์ ไม่มีการเรียก API (`CrmDashboard.tsx:611-644`)

## ความสัมพันธ์กับระบบบัญชี

- CRM อ่านอย่างเดียวจาก [[tbl-ic-trans]], [[tbl-ic-trans-detail]], [[tbl-ar-customer]], [[tbl-ar-customer-detail]], [[tbl-ap-ar-trans]] และ [[tbl-erp-user]] ไม่ได้เขียนเอกสารขาย
- ตารางที่ CRM เขียนเองคือ `crm_customer_activity` ระบบ POS และ Market ก็เขียนตารางนี้ตรงด้วย (`pos_bill.go:267`) ดู [[sys-market-checkout-sync]] ส่วน LINE OA เรียก `POST /api/v1/crm/activities` แต่ส่งชื่อฟิลด์ไม่ตรง ดู [[sys-lineoa-chat-ai]]
- วงจรขายของบัญชีอยู่ที่ [[flow-order-to-cash]]

## ที่มาในโค้ด

- `frontend/src/app/crm/page.tsx:6` metadata
- `frontend/crm/CrmDashboard.tsx:57-64` โมดูลและขั้นดีล, `:145-180` เกรดลูกค้า, `:347` ดึง overview, `:611-644` ปุ่มบนกระดาน, `:930-960` ป้ายโมดูล
- `frontend/shared/layout/SystemPortalScreen.tsx:250-259` การ์ดระบบ, `frontend/shared/layout/PersistentWorkspaceHost.tsx:158` จับคู่เส้นทาง
- `backend/internal/adapter/inbound/http/router.go:260-268` route `/api/v1/crm`
- `backend/internal/adapter/inbound/http/crm/handler.go:155-250` SQL ของ overview, `:340-402` ขั้นดีลและการ์ด `lead`
- ดูเพิ่ม: [[sys-crm-activity-images]] · [[api-business-modules]] · [[term-trans-flag]]
