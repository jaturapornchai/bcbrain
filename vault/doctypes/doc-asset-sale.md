---
title: "ขายสินทรัพย์ (Fixed Asset Sale)"
tags: [doctypes, asset]
aliases: ["trans_flag 1802", "ขายสินทรัพย์", "สินทรัพย์_ขาย", "menu_asset_sale", "AssetSale"]
sources: ["frontend/account/transaction/AssetSaleScreen.tsx:31", "frontend/account/tabs/screenRegistry.tsx:1111", "backend/internal/application/process/fa_sale.go:14", "backend/internal/application/process/fa_sale.go:159", "backend/internal/application/process/fa_sale.go:321", "backend/internal/application/process/fa_sale.go:379", "backend/internal/application/process/fa_sale.go:600", "backend/internal/application/process/fa_sale.go:645", "backend/internal/application/process/fa_sale.go:666", "backend/internal/application/process/fa_sale.go:695", "backend/internal/application/process/docs.go:600"]
---

# ขายสินทรัพย์ (trans_flag 1802)

## ใช้เมื่อไร
ใช้ขายหรือจำหน่ายสินทรัพย์ถาวร ผ่านเมนู `menu_asset_sale` (screenRegistry.tsx:1111) และหน้าจอ `AssetSaleScreen` ที่ใช้ `FLAG = 1802` (AssetSaleScreen.tsx:31)

## trans_flag/ตาราง
- เก็บใน [[tbl-as-trans]] + [[tbl-as-trans-detail]] ไม่ใช่ ic_trans (fa_sale.go:14)
- บันทึก ดูตัวอย่าง หรือลบผ่าน `AssetSale` ที่มี op = preview / save / delete (fa_sale.go:379)

## ฟิลด์/แท็บบนหน้าจอ
- grid กรอกแค่รหัสสินทรัพย์และราคาขาย ส่วนทุน ค่าเสื่อมสะสม มูลค่าตามบัญชี VAT และกำไรขาดทุน backend คำนวณให้ (`AssetSaleLine` fa_sale.go:21)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc +1 (trans_tax.go:37) บันทึกผ่าน `insertAssetSaleVat` (fa_sale.go:645)
- WHT ฝั่ง "ar" (trans_tax.go:48) บันทึกผ่าน `saveAssetSaleWht` (fa_sale.go:666)

## การลงบัญชี
คำนวณใน `calcAssetSale` (fa_sale.go:159) และหาบัญชีใน `computeAssetSale` (fa_sale.go:321)
- กำไรขาดทุน pl = (ยอดเงิน − VAT) − (ทุน − ค่าเสื่อมสะสม)

| Dr | Cr |
|---|---|
| เงินสด 1111/1110/1100 เมื่อ inquiry 1/3 (`assetSaleIsCash` fa_sale.go:695) มิฉะนั้นเป็นบัญชีของลูกค้าใน ar_customer_detail หรือ 1121/1120 = ยอดเงิน | ราคาทุนของสินทรัพย์แต่ละตัว |
| ค่าเสื่อมราคาสะสมของสินทรัพย์แต่ละตัว | ภาษีขาย 2134/2121/2135/2190 |
| ขาดทุนจากการจำหน่าย (ถ้า pl < 0) | กำไรจากการจำหน่าย (ถ้า pl > 0) |

- บัญชีกำไรขาดทุนหาจากผังที่ชื่อตรง regex `(จำหน่าย|ขาย)สินทรัพย์` (fa_sale.go:349)
- ถ้าเอกสารมี template GL จะลงตาม template และไม่ fallback (`postAssetSaleTemplate` fa_sale.go:600)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: สินทรัพย์และค่าเสื่อมที่โอนแล้ว 1801 ([[doc-asset-depreciation-transfer]])
- ขายเชื่อ inquiry 0/2 นับเป็นหนี้ลูกหนี้ (`arDebtWhere` docs.go:600) แล้วไปต่อที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- แก้ไขด้วยการบันทึกทับตาม doc_no หรือลบด้วย op = delete (fa_sale.go:379)
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (ไม่พบในโค้ด)

## ข้อควรระวัง
- ถ้ารหัสลูกค้าไม่มีใน ar_customer_detail ฝั่ง Dr จะใช้บัญชีลูกหนี้ตั้งต้นแทน (comment fa_sale.go:229)
- ยอดใน journal ปัดเป็น 2 ตำแหน่งก่อนคำนวณเพื่อให้ Dr = Cr (fa_sale.go:184)

## ที่มาในโค้ด
- `frontend/account/transaction/AssetSaleScreen.tsx:31` FLAG
- `backend/internal/application/process/fa_sale.go:159` calcAssetSale
- `backend/internal/application/process/fa_sale.go:321` computeAssetSale
- `backend/internal/application/process/fa_sale.go:600` postAssetSaleTemplate

## ดูเพิ่ม
- [[doc-asset-depreciation-transfer]] · [[acc-fixed-asset-sale]] · [[doctypes-overview]]
