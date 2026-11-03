---
title: "รับยางและอะไหล่เข้าคลังแบบไม่เห็นราคาทุน และการลงเป็นบิลซื้อ (sys-autocare-blind-receiving)"
tags: [systems, autocare, purchase, inventory, cost-masking]
aliases: ["Blind Receiving", "รับของปิดราคาทุน", "postBlindReceivingToBCAccount", "PU-AC", "API Cost Masking"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1387-1451"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1453-1474"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2338-2491"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:137-166"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:312-330"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:232-250"
---

# รับของเข้าคลังแบบไม่เห็นราคาทุน (Blind Receiving)

พนักงานคลังรับยางหรืออะไหล่จากผู้จำหน่าย โดยบันทึกแค่จำนวนและล็อต DOT ไม่เห็นราคาทุน ฝ่ายบัญชีจึงค่อยแปลงใบรับนี้เป็นเอกสารซื้อใน BC Account (trans_flag 12) ภายหลัง

## Cost Masking
- ตาราง `autocare_blind_receiving` ไม่มีคอลัมน์ราคาทุนเลย มีแค่ผู้จำหน่าย เลขใบส่งของ ผู้รับ คลังและที่เก็บ จำนวน สรุปรายการ ล็อต DOT รูปหลักฐาน `cost_masked` และสถานะ (seed.go:232-250)
- โครงสร้างแคตตาล็อกยาง `TireCatalogItem` ที่ส่งไปหน้าร้านก็ไม่มีฟิลด์ทุน มีแค่ `sale_price` และ `promo_price` (handler.go:137-166)

## 1. บันทึกใบรับ `create_blind_receiving` (handler.go:1387-1451)
- ถ้าไม่ได้ส่ง `recv_no` มาจะถือเป็นใบใหม่ เลขใบเป็น `"BLIND-"` ต่อด้วย 9 ตัวแรกของ Stamp ถ้าส่งมาจะถือเป็นการแก้ไข โดย upsert ด้วย `ON CONFLICT (recv_no)`
- สถานะเริ่มต้นคือ `PENDING_ACCOUNTING_COST` และ `cost_masked = TRUE`
- ถ้าเป็นใบใหม่ ระบบบวก `qty_on_hand` ใน `autocare_tire_dot_stock` ของ `item_code` และ `dot_code` นั้น ถ้ายังไม่มีแถวคู่นั้นในตาราง จะไม่มีการบวก เพราะเป็นคำสั่ง UPDATE อย่างเดียว
- ฟิลด์ที่ไม่ได้ส่งมาจะใช้ค่าเดโม เช่น ผู้จำหน่าย `AP-MICH` จำนวน 16

## 2. ลงบัญชี `post_blind_receiving_account` (handler.go:1453-1474)
ต้องส่ง `recv_no` แล้วระบบจะเรียก `postBlindReceivingToBCAccount` และตอบกลับเลขเอกสารซื้อพร้อม `trans_flag: 12`

## 3. `postBlindReceivingToBCAccount` (handler.go:2338-2491)
1. **เลขเอกสาร**: ใช้ `fixedDocNo` ถ้าส่งมา ถ้าไม่มีให้ใช้ `bc_purchase_doc_no` เดิม ถ้าไม่มีทั้งสองอย่างจะสร้างเลขเป็น `"PU-AC"` ต่อด้วย 8 ตัวแรกของ Stamp (handler.go:2387-2399)
2. **ล็อต**: ตัดข้อความ `dot_batches` ที่ช่องว่างแรก วงเล็บ หรือจุลภาค และเก็บไม่เกิน 15 ตัวอักษร (handler.go:2365-2385) ถ้าค่าคลังหรือที่เก็บมีรูปแบบ `CODE~ชื่อ` จะใช้เฉพาะส่วนรหัส
3. **สินค้าและราคาทุน**: ระบบไม่ได้อ่านทุนจากข้อมูลจริง แต่เลือกจากรหัสผู้จำหน่ายด้วยค่าตายตัว (handler.go:2401-2415)

   | รหัสผู้จำหน่ายมีคำว่า | SKU | หน่วย | ทุนต่อหน่วย |
   |---|---|---|---|
   | (ค่าเริ่มต้น) | `TIRE-MI-2055516` | เส้น | 3150.00 |
   | `BRID` | `TIRE-BS-2155517` | เส้น | 3680.00 |
   | `PROF` | `PART-SHK-PROF-4` | ชุด | 24500.00 |
   | `3M` | `CARE-TINT-3M-FULL` | คัน | 8900.00 |

   มูลค่าคือ `qty × ทุนต่อหน่วย` คำนวณด้วย big.Rat (handler.go:2417-2420)
4. **หัวเอกสาร**: `DocFormatCode "PU"`, `TransType 1`, `TransFlag 12`, `InquiryType 0`, `VatType 0`, `VatRate "7"`, `TaxDocNo` เท่ากับเลขใบส่งของ, `DocRef` เท่ากับเลขใบรับ, `Confirmed true` และรหัสผู้จำหน่ายใส่ใน `CustCode` (handler.go:2443-2471)
5. เรียก `SaveTrans` ถ้าล้มเหลวจะลองใหม่แบบแก้ไข ถ้ายังล้มเหลวจะ log warning แล้วคืน error (handler.go:2472-2480) ถ้าสำเร็จจะตั้งใบรับเป็น `POSTED_TO_IC_TRANS` และบันทึก `bc_purchase_doc_no` (handler.go:2482-2490)

## ข้อควรรู้
- ทุนต่อหน่วยในเอกสารซื้อเป็นค่าที่เขียนไว้ในโค้ด (handler.go:2401-2415) ไม่ได้มาจากใบแจ้งหนี้จริงของผู้จำหน่าย ใช้กับข้อมูลเดโมได้ แต่ทุนจะไม่ตรงกับสินค้าจริงตัวอื่น
- ทุก Rebuild จะโพสต์ใบรับเดโม `BLIND-2610-03` และ `BLIND-2610-04` ซ้ำด้วยเลขตายตัว ดู [[sys-autocare-seed-demo]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/handler.go:1387-1474`: action สร้างใบรับและลงบัญชี
- `backend/internal/adapter/inbound/http/autocare/handler.go:2338-2491`: postBlindReceivingToBCAccount
- `backend/internal/adapter/inbound/http/autocare/seed.go:232-250`: DDL `autocare_blind_receiving`

ดูเพิ่ม: [[doc-purchase-invoice]] · [[faq-purchase-invoice-gl-posting]] · [[tbl-ap-supplier]] · [[sys-autocare-flutter-app]] · [[sys-autocare-overview]]
