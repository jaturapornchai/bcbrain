---
title: "ชนิดเอกสาร / รหัสเอกสาร (document type / trans_flag)"
tags: [glossary, document-type, ic, ap, ar, cb, gl]
aliases: ["trans_flag", "transFlag", "ชนิดเอกสาร", "ประเภทเอกสาร", "รหัสเอกสาร", "flag", "เลข flag", "trans_type", "transType", "calc_flag", "calcFlag", "ทิศทางสต็อก", "screen code", "screenCode", "รหัสจอ", "TransKind", "kind", "doc type"]
sources: ["backend/internal/application/process/transcalc.go:14", "backend/internal/application/process/stock_rebuild.go:18", "frontend/account/tabs/transMenuMap.ts:3", "frontend/account/tabs/transMenuMap.ts:11", "frontend/account/tabs/transMenuMap.ts:54", "frontend/account/tabs/transMenuMap.ts:541", "frontend/account/tabs/transMenuMap.ts:922", "frontend/account/tabs/transMenuMap.ts:827", "frontend/account/tabs/transMenuMap.ts:295", "frontend/account/tabs/transMenuMap.ts:1798", "frontend/account/tabs/transMenuMap.ts:1813", "backend/internal/application/process/trans.go:20", "backend/internal/application/process/service.go:1080"]
---

# ชนิดเอกสาร (trans_flag)

## ในระบบนี้คืออะไร
ทุกเอกสารซื้อ ขาย สต็อก หนี้ และเงิน เก็บ "ชนิดเอกสาร" เป็นเลขในคอลัมน์ `trans_flag` เช่น 44 = ขายสินค้า/บริการ (SI) และ 12 = ซื้อ/ตั้งหนี้ (PU)
เมนูแต่ละเมนูผูกกับ flag หนึ่งค่าผ่าน `TransMenuConfig` (`transMenuMap.ts:11`) ฟิลด์ที่ผูกไว้ได้แก่ `transType`, `transFlag`, `calcFlag`, `screenCode`, `docFormatCode`, `partyType` (ap/ar/none), `mode` (doc/cancel/approve) และ `origFlag`

## identifier / ตาราง / คอลัมน์
| คำที่ผู้ใช้พูด | identifier | ที่อยู่ |
|---|---|---|
| ชนิดเอกสาร | `trans_flag` | `ic_trans`, `ic_trans_detail`, `ap_ar_trans`, `cb_trans`, `gl_journal`, `gl_journal_vat_*`, `gl_wht_list` |
| กลุ่มระบบของเอกสาร | `trans_type` | `ic_trans.trans_type` และ `cb_trans.trans_type` |
| ทิศทางสต็อก (+ เข้า / − ออก) | `calc_flag` | `ic_trans_detail.calc_flag` |
| รหัสจอ / ตัวย่อเอกสาร | `screenCode` เช่น SI, PU, IM | `transMenuMap.ts` |
| ตารางที่เอกสารลง | `kind` / TransKind | `ic_trans`, `ap_ar_trans`, `cb_trans`, `cb_chq_list`, `gl_journal`, `pp_trans` (`transMenuMap.ts:3`) |

## ค่าที่เป็นไปได้
- `trans_type`: 1 = ซื้อ/เจ้าหนี้ (`transMenuMap.ts:54`), 2 = ขาย/ลูกหนี้ (`:541`), 3 = สินค้า/คลัง (`:922`)
- `calc_flag`: ยอดคงเหลือคำนวณจาก `SUM(qty * calc_flag * (stand_value/divide_value))` (`service.go:1078-1083`) ดังนั้น +1 = เข้า, −1 = ออก, 0 = ไม่กระทบสต็อก
  - backend คำนวณ `calc_flag` เองจาก `trans_flag` ไม่เชื่อค่าที่ client ส่งมา (`calcFlagByTransFlag`, `transcalc.go:14-27`) flag ที่ไม่อยู่ในรายการได้ 0
  - flag ที่ไม่ใช่เอกสารสต็อก เช่น 30/34/36 ก็มี `calc_flag = 1` ด้วย แต่ไม่กระทบยอด เพราะยอดคงเหลือนับเฉพาะ `trans_flag` ในรายการ `stockRowsSQL` (`stock_rebuild.go:18-22`) ดู [[term-stock-balance]]
- ตัวอย่าง flag ที่พบบ่อย (จาก `transMenuMap.ts`):
  - ซื้อ: 2 PR ใบเสนอซื้อ (`:56`), 6 PO ใบสั่งซื้อ (`:99`), 12 PU ซื้อ/ตั้งหนี้ (`:295`), 16 PT ส่งคืน/ลดหนี้ซื้อ (`:388`), 14 PA เพิ่มหนี้ซื้อ (`:479`)
  - ขาย: 30 SO ใบเสนอราคา (`:543`), 34 SR สั่งจอง (`:586`), 36 SS สั่งขาย (`:631`), 44 SI ขาย (`:827`), 48 ST รับคืน/ลดหนี้ (`:859`), 46 SA เพิ่มหนี้ (`:890`)
  - สต็อก: 54 IB ยกมา (`:924`), 56 IO เบิก (`:996`), 58 IR รับคืนจากเบิก (`:1027`), 72 IM โอนออก (`:1073`), 66 IA ปรับปรุงเพิ่ม (`:1149`), 68 IS ปรับปรุงลด (`:1163`)
  - หนี้: 19 DE จ่ายชำระหนี้ (`:1374`), 239 EE รับชำระหนี้ (`:1573`), 213 DD ใบรับวางบิล (`:1345`), 235 ED ใบวางบิล (`:1544`)
  - เงิน: 401 DM ฝาก (`:1887`), 402 WM ถอน (`:1902`), 422 TM โอนเงิน (`:1917`), 0 JV ข้อมูลรายวัน (`:2368`)
- ค่าคงที่ฝั่ง backend: 72 โอนออก, 70 โอนเข้า, 124 ขอโอน, 422 โอนเงิน (`trans.go:20-27`)

## หน้าจอที่ใช้
ทุกจอเอกสารใน `frontend/account/transaction/*` เปิดตาม `TransMenuConfig` เดียวกัน รายการเต็มดูได้ที่ [[acc-trans-flag-map]]

## ข้อควรระวัง
- flag ของเอกสารยกเลิก/อนุมัติเป็นเอกสารแยก มีเลขของตัวเอง เช่น 45 ยกเลิกขาย (เอกสารเดิมคือ 44) และ 4 อนุมัติใบเสนอซื้อ (เอกสารเดิมคือ 2) ดู [[term-last-status-cancel-approve]]
- flag 300/301 (เงินสดย่อย) โค้ดเรียกว่า 300 "คืน/ลด วงเงินสดย่อย" (`transMenuMap.ts:1798`) และ 301 "รับ/เพิ่ม วงเงินสดย่อย" (`:1813`) แต่โน้ต [[acc-trans-flag-map]] เขียนว่า 300 เบิก / 301 คืน ให้ยึดตามโค้ด
- `cb_chq_list` ใช้ `trans_flag` 1 เช็ครับ, 2 เช็คจ่าย, 3 บัตรเครดิต (`:1991`, `:2180`, `:2325`) ซ้ำเลขกับ flag ของ `ic_trans` จึงต้องดูประกอบกับตารางทุกครั้ง

## ลิงก์
[[acc-trans-flag-map]] · [[tbl-ic-trans]] · [[tbl-ic-trans-detail]] · [[term-module-prefix]] · [[term-inquiry-type]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:3` (TransKind), `:11-30` (TransMenuConfig), `:54`, `:541`, `:922` (trans_type)
- `frontend/account/tabs/transMenuMap.ts:295`, `:827`, `:1798`, `:1813`, `:2368`
- `backend/internal/application/process/trans.go:20-27`
- `backend/internal/application/process/service.go:1078-1083`
- `backend/internal/application/process/transcalc.go:9-27`; `stock_rebuild.go:18-22`
