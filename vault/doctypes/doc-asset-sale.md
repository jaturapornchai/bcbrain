---
title: "ขายสินทรัพย์ (Fixed Asset Sale)"
tags: [doctypes, asset]
aliases: ["trans_flag 1802", "ขายสินทรัพย์", "สินทรัพย์_ขาย", "menu_asset_sale", "AssetSale"]
sources: ["frontend/account/transaction/AssetSaleScreen.tsx:31", "frontend/account/transaction/AssetSaleScreen.tsx:50", "frontend/account/tabs/screenRegistry.tsx:1111", "backend/internal/application/process/fa_sale.go:14", "backend/internal/application/process/fa_sale.go:21", "backend/internal/application/process/fa_sale.go:159", "backend/internal/application/process/fa_sale.go:286", "backend/internal/application/process/fa_sale.go:321", "backend/internal/application/process/fa_sale.go:382", "backend/internal/application/process/fa_sale.go:431", "backend/internal/application/process/fa_sale.go:576", "backend/internal/application/process/fa_sale.go:600", "backend/internal/application/process/fa_sale.go:645", "backend/internal/application/process/fa_sale.go:666", "backend/internal/application/process/fa_sale.go:695", "backend/internal/application/process/trans_tax.go:41", "backend/internal/application/process/gl_template.go:1113", "backend/internal/application/process/docs.go:600"]
---

# ขายสินทรัพย์ (trans_flag 1802)

## ใช้เมื่อไร
ใช้ขายหรือจำหน่ายสินทรัพย์ถาวร ผ่านเมนู `menu_asset_sale` "บันทึกการขายสินทรัพย์" (screenRegistry.tsx:1111) และหน้าจอ `AssetSaleScreen` ที่ใช้ `FLAG = 1802` (AssetSaleScreen.tsx:31)

## trans_flag/ตาราง
- เก็บใน [[tbl-as-trans]] + [[tbl-as-trans-detail]] ไม่ใช่ ic_trans (fa_sale.go:14)
- ขายเงินสดเขียน [[tbl-cb-trans]] เพิ่ม 1 แถว เป็นเงินสดทั้งยอด (fa_sale.go:557)
- บันทึก ดูตัวอย่าง หรือลบผ่าน `AssetSale` ที่มี op = preview / save / delete (fa_sale.go:382, :411, :417)
- บันทึกแล้วเขียนข้อมูลการขายลง as_asset_detail (วันที่ขาย เลขที่เอกสาร ผู้ซื้อ ราคาขายก่อน VAT) (fa_sale.go:551) ลบเอกสารแล้วล้างค่าเหล่านี้ (`deleteAssetSaleDoc` fa_sale.go:487)

## ฟิลด์/แท็บบนหน้าจอ
- ประเภทการขาย (inquiry_type): 0 ขายเงินเชื่อ, 1 ขายเงินสด, 2 ขายสินค้าเงินเชื่อ (สินค้าบริการ), 3 ขายสินค้าเงินสด (สินค้าบริการ) (`SALE_TYPES` AssetSaleScreen.tsx:50)
- grid กรอกแค่รหัสสินทรัพย์และราคาขาย ส่วนทุน ค่าเสื่อมสะสม มูลค่าตามบัญชี VAT และกำไรขาดทุน backend คำนวณให้ (`AssetSaleLine` fa_sale.go:21)
- ทุน = as_buy_price, ค่าเสื่อมสะสม = as_sum_value_balance + Σ ยอด 1801 ของสินทรัพย์, มูลค่าตามบัญชี = ทุน − ค่าเสื่อมสะสม (`loadSaleAssets` fa_sale.go:286)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc 1 (`transVatTabs` trans_tax.go:41) เขียนทะเบียนภาษีขายผ่าน `insertAssetSaleVat` (fa_sale.go:645)
- WHT ฝั่ง "ar" (`transWhtParty` trans_tax.go:49) ให้ผู้ใช้คีย์เอง บันทึกผ่าน `saveAssetSaleWht` (fa_sale.go:666) ไม่มีบรรทัด WHT ใน standard GL

## การลงบัญชี
คำนวณใน `calcAssetSale` (fa_sale.go:159) และหาบัญชีใน `computeAssetSale` (fa_sale.go:321) แล้ว insert gl_journal ที่ fa_sale.go:576
- กำไรขาดทุน pl = (ยอดเงิน − VAT) − (ทุน − ค่าเสื่อมสะสม) โดยยอดเงินและ VAT ปัด half-up 2 ตำแหน่งก่อน เพื่อให้ Dr = Cr (fa_sale.go:184-186)

| Dr | Cr |
|---|---|
| เงินสด 1111/1110/1100 เมื่อ inquiry 1/3 (`assetSaleIsCash` fa_sale.go:695) มิฉะนั้นเป็น account_code ของลูกค้าใน ar_customer_detail หรือ 1121/1120 = ยอดเงิน | ราคาทุน: account_code ของสินทรัพย์แต่ละตัว |
| ค่าเสื่อมราคาสะสม: depreciation_sum_account_code ของสินทรัพย์แต่ละตัว | ภาษีขาย 2134/2121/2135/2190 (fa_sale.go:347) |
| ขาดทุนจากการจำหน่าย (ถ้า pl < 0) | กำไรจากการจำหน่าย (ถ้า pl > 0) |

- บัญชีกำไรขาดทุนเป็นบัญชีแรกในผังที่ชื่อตรง regex `(จำหน่าย|ขาย)สินทรัพย์` (fa_sale.go:349)
- ถ้ารูปแบบเอกสารมี template GL จะลงตาม template และไม่ fallback (`postAssetSaleTemplate` fa_sale.go:600) ตอน rebuild GL ระบบลง 1802 ใหม่เฉพาะเอกสารที่รูปแบบมี template (`postTemplateOnly` gl_template.go:1113)
- บันทึกไม่ได้เมื่อ: ไม่พบสินทรัพย์ สินทรัพย์ขายไปแล้วในเอกสารอื่น (fa_sale.go:312) สินทรัพย์ไม่มีรหัสบัญชีสินทรัพย์/ค่าเสื่อมสะสม (:314) ไม่พบผังบัญชี (:370) หรือ Dr ≠ Cr (:374)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: สินทรัพย์และค่าเสื่อมที่โอนแล้ว 1801 ([[doc-asset-depreciation-transfer]])
- ขายเชื่อ inquiry 0/2 นับเป็นหนี้ลูกหนี้ (`arDebtWhere` docs.go:600) แล้วไปต่อที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49) แก้ไขด้วยการบันทึกทับ (ลบเอกสารเดิมแล้วสร้างใหม่) หรือลบด้วย op = delete (fa_sale.go:417)
- บันทึก/ลบต้องอยู่ในงวดบัญชีที่เปิด ทั้งวันที่เอกสารใหม่และวันที่ของเอกสารเดิมที่แก้ (`checkOpenPeriod` fa_sale.go:422, :431, :448)

## ข้อควรระวัง
- เลขที่เอกสารซ้ำกับ as_trans หรือ gl_journal ที่มีอยู่แล้วบันทึกไม่ได้ (fa_sale.go:461)
- สมุดรายวันต้องมีใน gl_journal_book (fa_sale.go:439)

## ที่มาในโค้ด
- `frontend/account/transaction/AssetSaleScreen.tsx:31` FLAG
- `backend/internal/application/process/fa_sale.go:159` calcAssetSale
- `backend/internal/application/process/fa_sale.go:321` computeAssetSale
- `backend/internal/application/process/fa_sale.go:382` AssetSale
- `backend/internal/application/process/fa_sale.go:600` postAssetSaleTemplate

## ดูเพิ่ม
- [[doc-asset-depreciation-transfer]] · [[acc-fixed-asset-sale]] · [[doctypes-overview]]
