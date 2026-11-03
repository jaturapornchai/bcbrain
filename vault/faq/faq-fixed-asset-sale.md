---
title: "ขายสินทรัพย์ (1802) ระบบคำนวณกำไร/ขาดทุนและลงบัญชีอย่างไร"
tags: [faq, fixed-asset, sale, gl, vat]
aliases: ["ขายสินทรัพย์", "จำหน่ายสินทรัพย์", "กำไรขาดทุนจากการขายสินทรัพย์", "asset sale", "trans_flag 1802", "as_trans 1802", "as_sum_value_balance", "ขายสินทรัพย์ลงบัญชี"]
sources: ["backend/internal/application/process/fa_sale.go:159", "backend/internal/application/process/fa_sale.go:286", "backend/internal/application/process/fa_sale.go:321", "backend/internal/application/process/fa_sale.go:349", "backend/internal/application/process/fa_sale.go:382", "backend/internal/application/process/fa_sale.go:576", "backend/internal/application/process/fa_sale.go:600"]
---
# ขายสินทรัพย์ (1802) ระบบคำนวณกำไร/ขาดทุนและลงบัญชีอย่างไร

**ตอบสั้น:** กำไร(ขาดทุน) = ยอดขายก่อน VAT − มูลค่าตามบัญชี (ราคาทุน − ค่าเสื่อมสะสม) GL เส้นมาตรฐานลง Dr เงินสด/ลูกหนี้ + Dr ค่าเสื่อมสะสม (+ Dr ขาดทุน) / Cr ราคาทุนสินทรัพย์ + Cr ภาษีขาย (+ Cr กำไร) บัญชีกำไร/ขาดทุนหาจากชื่อในผังบัญชี

## รายละเอียด
ดู [[acc-fixed-asset-sale]], [[doc-asset-sale]], [[flow-fixed-asset-lifecycle]]

**ข้อมูลสินทรัพย์ (`loadSaleAssets`)**
- ราคาทุน = `as_asset_detail.as_buy_price`
- ค่าเสื่อมสะสม = `as_sum_value_balance` + ผลรวม `as_trans_detail.sum_amount` ของ 1801 ([[faq-fixed-asset-depreciation]])
- รหัสบัญชี: ราคาทุน = `as_asset.account_code`, ค่าเสื่อมสะสม = `depreciation_sum_account_code`
- ปฏิเสธ: "ไม่พบสินทรัพย์ X", "สินทรัพย์ X ขายไปแล้วในเอกสาร Y", "สินทรัพย์ X ยังไม่กำหนดรหัสบัญชีสินทรัพย์/ค่าเสื่อมราคาสะสม"

**คำนวณ (`calcAssetSale`)**
- ราคาขายต่อแถวปัดด้วย `bcRound` ([[faq-rounding-decimal]])
- vat_type 1 (รวมใน): ก่อน VAT = ราคา × 100 ÷ (100 + อัตรา) ปัด ToEven, VAT = ราคา − ก่อน VAT
- vat_type 0 (แยกนอก): VAT = ราคา × อัตรา ÷ 100 ปัด ToEven
- ยอดรวมผ่าน `vatCalc` แล้วปัดยอดสุทธิและ VAT แบบ HALF_UP 2 ตำแหน่ง เพื่อให้ Dr = Cr
- อัตรา VAT: ถ้าไม่ส่งมา ใช้ `erp_option.vat_rate` ไม่มีแถว erp_option ใช้ 7

**บัญชี (`computeAssetSale`)**
- ขายสด (inquiry 1/3): 1111/1110/1100; ขายเชื่อ: `ar_customer_detail.account_code` ของลูกค้า ไม่มีใช้ 1121/1120
- ภาษีขาย: 2134/2121/2135/2190
- กำไร/ขาดทุน: บัญชีแรกที่ชื่อตรง `(จำหน่าย|ขาย)สินทรัพย์` เรียงตามรหัส

**GL เส้นมาตรฐาน**

| ฝั่ง | บัญชี | ยอด |
|---|---|---|
| Dr | เงินสด / ลูกหนี้ | ยอดสุทธิรวม VAT |
| Dr | ค่าเสื่อมสะสม (ต่อสินทรัพย์) | ค่าเสื่อมสะสม |
| Dr | กำไร(ขาดทุน)ขายสินทรัพย์ | เมื่อขาดทุน |
| Cr | สินทรัพย์ (ต่อสินทรัพย์) | ราคาทุน |
| Cr | ภาษีขาย | VAT |
| Cr | กำไร(ขาดทุน)ขายสินทรัพย์ | เมื่อกำไร |

ไม่พบชื่อบัญชีในผัง → "ไม่พบผังบัญชี X (ต้องสร้างในผังบัญชีก่อนบันทึก)" (ไม่มีบัญชีกำไร/ขาดทุน ขึ้นชื่อ "กำไร(ขาดทุน)จากการจำหน่ายสินทรัพย์"), Dr ≠ Cr → "รายการบัญชีไม่สมดุล"

**บันทึก (`AssetSale`)** ทำได้ 3 แบบ preview / save / delete ล็อก 'asset-sale' เขียน `as_trans`, `as_trans_detail` ([[tbl-as-trans]]), `cb_trans`, ทะเบียนภาษีขาย และแท็บภาษีถูกหัก ถ้ารหัสเอกสารมีรูปแบบ GL ใช้รูปแบบแทน ถ้ารูปแบบไม่ลงรายการ → ปฏิเสธ ไม่ถอยไปเส้นมาตรฐาน ลบเอกสารแล้วสินทรัพย์กลับเป็นยังไม่ขาย

## ข้อควรระวัง
- บัญชีกำไร/ขาดทุนหาด้วยชื่อ ถ้าผังมีหลายบัญชีชื่อคล้ายกัน ระบบเลือกรหัสน้อยสุด
- `gl_journal` ของ 1802 เขียน `trans_direct` = 0 (`fa_sale.go:579`) ต่างจาก 1801 ที่เป็น 1 และ 1802 ไม่อยู่ใน `glRebuildTransFlags` จึงไม่ถูก rebuild GL ลบ ยกเว้นรหัสเอกสารที่มีรูปแบบ GL ซึ่ง `postTemplateOnly` ลงใหม่ ([[faq-gl-rebuild-when]])
- ตรวจงวดทั้งวันที่ใหม่ วันที่เดิมตอนแก้ และตอนลบ ([[faq-period-closed-cannot-save]])
- ลบเอกสารโอนค่าเสื่อม 1801 ที่วันที่ไม่เกินวันขายไม่ได้

## ดูเพิ่ม
- [[acc-fixed-asset-sale]]
- [[faq-fixed-asset-depreciation]]
- [[faq-vat-exclude-include-calc]]
- [[faq-gl-template-doc-format]]
- [[faq-wht-certificate-pnd]]

## ที่มาในโค้ด
- `backend/internal/application/process/fa_sale.go:159` `calcAssetSale` (VAT, กำไรขาดทุน, GL)
- `backend/internal/application/process/fa_sale.go:286` `loadSaleAssets`
- `backend/internal/application/process/fa_sale.go:321` `computeAssetSale`; `:323` VAT ตั้งต้น 7; `:349` หาบัญชีกำไรขาดทุนจากชื่อ
- `backend/internal/application/process/fa_sale.go:382` `AssetSale`; `:401` `assetSaleTx`
- `backend/internal/application/process/fa_sale.go:576` INSERT `gl_journal` (trans_direct 0 `:579`)
- `backend/internal/application/process/fa_sale.go:600` `postAssetSaleTemplate`
- `backend/internal/application/process/service.go:1731` `glRebuildTransFlags`
- `backend/internal/application/process/gl_template.go:1100` `postTemplateOnly` ลง 1802 ใหม่เมื่อมีรูปแบบ GL
