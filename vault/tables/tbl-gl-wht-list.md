---
title: "หัวเอกสารหัก ณ ที่จ่าย (gl_wht_list)"
tags: [tables, gl]
aliases: ["gl_wht_list", "ภาษีหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "หนังสือรับรองการหักภาษี", "ภ.ง.ด.3", "ภ.ง.ด.53", "WHT header"]
sources: ["backend/internal/application/process/journaltax.go:241", "backend/internal/application/process/journaltax.go:260", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/trans_tax.go:148", "backend/internal/application/process/fa_sale.go:666", "backend/internal/application/process/pay_check.go:52", "backend/internal/application/process/report_menu_gl_fa.go:1137", "backend/internal/application/process/report_menu_gl_fa.go:1729", "backend/internal/application/process/report_menu_so_po.go:714", "backend/internal/application/process/service.go:1875"]
---

# หัวเอกสารหัก ณ ที่จ่าย (`gl_wht_list`)

หัวใบหัก ณ ที่จ่าย 1 แถวต่อ 1 เลขที่ใบหัก (`tax_doc_no`) รายการแยกตามประเภทเงินได้อยู่ที่ [[tbl-gl-wht-list-detail]] ตารางเดียวใช้ได้สองทิศ: **เราหักเขา** (ภาษีหัก ณ ที่จ่าย ฝั่งซื้อ/จ่าย ใช้ยื่น ภ.ง.ด.3 / ภ.ง.ด.53) และ **เขาหักเรา** (ภาษีถูกหัก ฝั่งขาย/รับ) แยกด้วย `trans_flag` ภาพรวมอยู่ที่ [[acc-vat-register-wht]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `doc_date` | เอกสารเจ้าของใบหัก | `journaltax.go:241` |
| `trans_flag` | ชนิดเอกสารเจ้าของ แยกทิศภาษี (ดูตารางด้านล่าง) | ลบ/อ่านทุกที่ |
| `tax_doc_no` | เลขที่เอกสารหัก ณ ที่จ่าย ห้ามซ้ำทั้งระบบ (คีย์เชื่อมกับตารางลูก) | `journaltax.go:108`, `journaltax.go:304` |
| `due_date` | วันที่หัก ณ ที่จ่าย (ถ้าว่างใช้วันที่เอกสาร) รายงานกรองตามวันนี้ | `journaltax.go:260`, `report_menu_gl_fa.go:1159` |
| `amount` | ผลรวมฐานภาษีของทุกบรรทัดลูก | `journaltax.go:291-296` |
| `tax_value` | ผลรวมภาษีที่หักของทุกบรรทัดลูก | `journaltax.go:291-296`, `pay_check.go:70` |
| `cust_code` | รหัสเจ้าหนี้/ลูกหนี้ (ถ้าแถวไม่ระบุ ใช้ของเอกสาร) | `trans_tax.go:148-152` |
| `cust_name`, `cust_address` | ชื่อ/ที่อยู่ ดึงจาก `ap_supplier` หรือ `ar_customer` ตอนบันทึก | `journaltax.go:241-256` |
| `cust_tax_type` | ประเภทผู้ถูกหัก คัดลอกจาก `ap_status`/`ar_status` ของทะเบียน ใช้แยก ภ.ง.ด.3 (0) / ภ.ง.ด.53 (1) | `journaltax.go:241-256`, `report_menu_gl_fa.go:1729-1730` |
| `card_number` | เลขบัตรประชาชน จาก `*_detail.card_id` | `journaltax.go:241-256` |
| `tax_number` | เลขประจำตัวผู้เสียภาษี จาก `*_detail.tax_id` | `journaltax.go:241-256` |

### ทิศภาษีตาม `trans_flag`

| ทิศ | party | flag | ที่มา |
|---|---|---|---|
| เราหัก (ภาษีหัก ณ ที่จ่าย) | ap | 12, 16, 260, 262, 264, 315, มัดจำซื้อ 11, 25 | `trans_tax.go:48` |
| เขาหักเรา (ภาษีถูกหัก) | ar | 44, 48, 144, 250, 252, ขายสินทรัพย์ 1802, มัดจำขาย 110, 112 | `trans_tax.go:48` |
| จ่ายชำระหนี้ / รับชำระหนี้ | ap / ar | 19 / 239 (`ap_ar_trans`) | `trans_tax.go:53` |
| JV ทำมือ เราหัก / เขาหักเรา | ap / ar | 1502 / 1501 | `journaltax.go:17-19` |

## คีย์และความสัมพันธ์
- ลูก: [[tbl-gl-wht-list-detail]] เชื่อมด้วย `doc_no` + `trans_flag` (+ `tax_doc_no`)
- เจ้าของ: [[tbl-ic-trans]], [[tbl-as-trans]] (1802), [[tbl-ap-ar-trans]] (19/239), หรือ JV ทำมือ ([[tbl-gl-journal]])
- ทะเบียนคู่ค้า: [[tbl-ap-supplier]], [[tbl-ar-customer]]
- เอกสารรับ/จ่ายเงิน: `total_tax_at_pay` ของ [[tbl-cb-trans]] คือ Σ `gl_wht_list.tax_value` ของเอกสาร (`pay_check.go:52-70`)

## ใครเขียน (writers)
- ทุกทางเข้าผ่าน `journalWhtStmts` `journaltax.go:260` และ `whtInsert` `journaltax.go:241`: แท็บ WHT ของ JV `journaltax.go:82`, ของเอกสาร `docWhtStmts` `trans_tax.go:148`, ของขายสินทรัพย์ `saveAssetSaleWht` `fa_sale.go:666`
- ข้อมูล WHT เป็นข้อมูลที่ผู้ใช้คีย์เสมอ ไม่มีการคำนวณให้ใหม่ ("raw")

## ใครลบและใครอ่าน
- ลบ: ก่อน insert ใหม่ในแท็บเดียวกัน `trans_tax.go:162-163`; ลบ JV `journaltax.go:94-95`, `journaltax.go:132-133`; ลบตามเอกสาร `trans_tax.go:202-203`; แถวกำพร้า `trans_tax.go:245-246`; ลบเอกสารขายสินทรัพย์ `fa_sale.go:488-490`
- อ่าน: รายงาน ภ.ง.ด.3 / ภ.ง.ด.53 / ภาษีถูกหัก `report_menu_gl_fa.go:1137` และลงทะเบียนเมนู `:1729-1731`; รวมยอดหักของเอกสาร `pay_check.go:70`, `service.go:1875`; คอลัมน์ "ภาษีหัก ณ ที่จ่าย" รายงานใบสั่งขาย 44 `report_menu_so_po.go:714`

## ข้อควรระวัง
- `tax_doc_no` ซ้ำไม่ได้แม้ต่างเอกสาร ถ้าซ้ำระบบแจ้ง "เลขที่เอกสารหัก ณ ที่จ่าย ซ้ำ" (`journaltax.go:108`, `journaltax.go:304`)
- แถวที่ไม่ระบุ `tax_doc_no` แต่มีรายการลูกหรือรหัสคู่ค้า ระบบปฏิเสธ (ฝั่ง C# เดิมข้ามเงียบ ๆ) `journaltax.go:270-276`
- ใบหักของเอกสารยกเลิก **ยังอยู่** รายงานแสดงสถานะ "ยกเลิก" และยอดเป็น 0 โดยดู `last_status` ของเอกสารต้นทาง (19/239 → `ap_ar_trans`, 1501/1502 → ไม่ยกเลิก, อื่น ๆ → `ic_trans`) `report_menu_gl_fa.go:1156-1157`
- การอัปเดตเลขที่เอกสารตอนแก้เลขเอกสารขายสินทรัพย์ย้ายใบหักตาม `doc_no`/`doc_date` ใหม่ (`fa_sale.go:666-680`)
- เงินและอัตราเก็บ NUMERIC (ยอด 2 ตำแหน่ง อัตรา 4 ตำแหน่ง) ([[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/journaltax.go:241` `whtInsert`
- `backend/internal/application/process/journaltax.go:260` `journalWhtStmts`
- `backend/internal/application/process/journaltax.go:304` ชื่อ constraint เลขที่ซ้ำ
- `backend/internal/application/process/trans_tax.go:48` `transWhtParty`
- `backend/internal/application/process/trans_tax.go:148` `docWhtStmts`
- `backend/internal/application/process/fa_sale.go:666` `saveAssetSaleWht`
- `backend/internal/application/process/pay_check.go:52` total_tax_at_pay
- `backend/internal/application/process/report_menu_gl_fa.go:1137` รายงาน WHT
- `backend/internal/application/process/report_menu_gl_fa.go:1729` ลงทะเบียนเมนูรายงาน
- `backend/internal/application/process/report_menu_so_po.go:714` ยอดหักในรายงานใบสั่งขาย
- `backend/internal/application/process/service.go:1875` รวม tax_value

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-vat-register-wht]]
- [[tbl-gl-wht-list-detail]]
