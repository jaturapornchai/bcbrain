---
title: "ประเภทรายการ เงินสด/เงินเชื่อ (inquiry type / inquiry_type)"
tags: [glossary, document, purchase, sale]
aliases: ["inquiry_type", "inquiryType", "inquiryTypeDefault", "ประเภทรายการ", "ซื้อเชื่อ", "ซื้อสด", "ขายเชื่อ", "ขายสด", "เงินเชื่อ", "เงินสด", "เครดิต", "ประเภทการส่งคืน", "ประเภทการรับคืน", "ประเภทการเพิ่มหนี้", "ราคาผิด", "ลดสินค้า", "สินค้าบริการ"]
sources: ["frontend/account/transaction/transLayouts.ts:17", "frontend/account/transaction/transLayouts.ts:35", "frontend/account/transaction/transLayouts.ts:42", "backend/internal/application/process/trans.go:114", "backend/internal/application/process/report_menu_ap_ar.go:384", "frontend/account/tabs/transMenuMap.ts:19"]
---

# ประเภทรายการ (inquiry_type)

## ในระบบนี้คืออะไร
`inquiry_type` เป็นตัวเลขที่หัวเอกสาร (`ic_trans.inquiry_type`) และในบรรทัดรายการ (`ic_trans_detail.inquiry_type`) ใช้บอกว่าเอกสารนั้นเป็นเงินเชื่อหรือเงินสด และเป็นสินค้าหรือบริการ สำหรับเอกสารคืนและเพิ่มหนี้ ค่านี้บอกชนิดของการคืนหรือเพิ่มหนี้ด้วย
ป้ายบนจอเปลี่ยนตาม flag ได้แก่ "ประเภทรายการ", "ประเภทการส่งคืน", "ประเภทการรับคืน", "ประเภทการเพิ่มหนี้" (`INQUIRY_BY_FLAG` ที่ `transLayouts.ts:42-50`) ค่าเริ่มต้นของแต่ละเมนูมาจาก `inquiryTypeDefault` ใน `TransMenuConfig` (`transMenuMap.ts:19`)

## ค่าที่เป็นไปได้ (จากโค้ด)
- ค่าทั่วไป (`getInquiryTypeOptions`): ซื้อมี 0 ซื้อเชื่อ (เครดิต) และ 1 ซื้อสด ขายมี 0 ขายเชื่อ (เครดิต) และ 1 ขายสด (`transLayouts.ts:17-28`)
- ค่าเฉพาะ flag (`transLayouts.ts:35-50`):

| รายการ | ใช้กับ flag | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|
| `PO_INQUIRY` | 2, 6 | ซื้อสินค้าเงินเชื่อ | ซื้อสินค้าเงินสด | ซื้อสินค้าเงินสด (สินค้าบริการ) | ซื้อสินค้าเงินเชื่อ (สินค้าบริการ) | | |
| `PURCHASE_INQUIRY` | 12, 315 | ซื้อสินค้าเงินเชื่อ | ซื้อสินค้าเงินสด | ซื้อสินค้าเงินเชื่อ (สินค้าบริการ) | ซื้อสินค้าเงินสด (สินค้าบริการ) | | |
| `RETURN_TYPE` | 16, 317 | ลดหนี้เจ้าหนี้, ลดสินค้า | ลดหนี้เจ้าหนี้, ราคาผิด (ไม่มีผลกับสต๊อกสินค้า) | ส่งคืนเงินสด | ราคาผิดเงินสด (ไม่มีผลกับสต๊อกสินค้า) | | |
| `PARTIAL_RETURN_TYPE` | 311 | ส่งคืนสินค้า | ราคาผิด (ไม่มีผลกับสต๊อกสินค้า) | | | | |
| `ADD_DEBT_TYPE` | 14, 316 | เพิ่มหนี้เจ้าหนี้, เพิ่มสินค้า | เพิ่มหนี้เจ้าหนี้, ราคาผิด (ไม่มีผลกับสต๊อกสินค้า) | | | | |
| `SALE_RETURN_TYPE` | 48 | รับคืนจากขายเงินเชื่อ | รับคืนจากขายเงินสด | ลดหนี้จากขายเงินเชื่อ (ไม่กระทบสต๊อก) | ลดหนี้จากขายเงินสด (ไม่กระทบสต๊อก) | รับคืนจากขายสินค้าเงินเชื่อ (สินค้าบริการ) | รับคืนจากขายสินค้าเงินสด (สินค้าบริการ) |
| `SALE_ADD_DEBT_TYPE` | 46 | เพิ่มหนี้จากการขายเงินเชื่อ | เพิ่มหนี้จากการขายเงินเชื่อ (ไม่กระทบสต๊อก) | เพิ่มหนี้จากการขายสินค้าเงินเชื่อ (สินค้าบริการ) | | | |

## ใช้ทำอะไรในโค้ด
- รายงานสถิติเจ้าหนี้/ลูกหนี้นับยอดตั้งหนี้ตาม inquiry_type เช่น ฝั่ง AP: flag 12/315/260 นับเมื่อ inquiry 0 หรือ 2 แต่ flag 11 นับเมื่อ inquiry 1 ฝั่ง AR: flag 48 นับลดหนี้เมื่อ inquiry 0/2/4 (`report_menu_ap_ar.go:384-394`)
- ใน `SaveTransInput.InquiryType` (`trans.go:114`)

## ข้อควรระวัง
- เลขเดียวกันมีความหมายต่างกันในแต่ละ flag ต้องดู flag ประกอบเสมอ ห้ามแปลว่า 1 = เงินสด ทุกกรณี
- ค่า 2 และ 3 ของ `PO_INQUIRY` (ใบเสนอซื้อ/ใบสั่งซื้อ) สลับกับ `PURCHASE_INQUIRY` (ซื้อ/ตั้งหนี้) ตามที่ประกาศไว้ใน `transLayouts.ts:35-36` ต้องใช้ตารางของ flag นั้นๆ ไม่นำไปสลับกัน
- รายงานลูกหนี้นับ flag 48 เป็นลดหนี้เมื่อ inquiry_type เป็น 0, 2 หรือ 4 คือรายการเงินเชื่อ ส่วนคืนเงินสด (1, 3, 5) ไม่นับ (`report_menu_ap_ar.go:393`)

## ลิงก์
[[term-trans-flag]] · [[term-ap-ar-balance]] · [[term-pay-tenders]] · [[tbl-ic-trans]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/transLayouts.ts:17-28`, `:35-41`, `:42-50`
- `backend/internal/application/process/trans.go:114`
- `backend/internal/application/process/report_menu_ap_ar.go:384-394` (`aparStatFlags`)
- `frontend/account/tabs/transMenuMap.ts:11-30` (`TransMenuConfig`, `inquiryTypeDefault` ที่บรรทัด 19)
