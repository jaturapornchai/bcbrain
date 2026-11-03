---
title: "ขายสินทรัพย์ถาวร (Fixed Asset Sale 1802)"
tags: [accounting, fixed-asset, asset-sale, gl, vat]
aliases: ["ขายสินทรัพย์", "จำหน่ายสินทรัพย์", "flag 1802", "กำไรขาดทุนจากการจำหน่ายสินทรัพย์", "มูลค่าตามบัญชี", "as_sale_price", "ขายไปแล้วในเอกสาร"]
sources: ["backend/internal/application/process/fa_sale.go:93", "backend/internal/application/process/fa_sale.go:159", "backend/internal/application/process/fa_sale.go:286", "backend/internal/application/process/fa_sale.go:321", "backend/internal/application/process/fa_sale.go:323", "backend/internal/application/process/fa_sale.go:335", "backend/internal/application/process/fa_sale.go:349", "backend/internal/application/process/fa_sale.go:364", "backend/internal/application/process/fa_sale.go:382", "backend/internal/application/process/fa_sale.go:401", "backend/internal/application/process/fa_sale.go:487", "backend/internal/application/process/fa_sale.go:513", "backend/internal/application/process/fa_sale.go:600", "backend/internal/application/process/fa_sale.go:645", "backend/internal/application/process/fa_sale.go:666"]
---

# ขายสินทรัพย์ถาวร (เอกสาร 1802)

เอกสารขายสินทรัพย์เก็บใน `as_trans` / `as_trans_detail` flag 1802 พร้อม GL, ทะเบียนภาษีขาย, หัก ณ ที่จ่าย และ `cb_trans` เมื่อขายเงินสด สถานะ "ขายแล้ว" ของสินทรัพย์ derive จากแถว 1802 ลบเอกสารแล้วสินทรัพย์กลับมาขายได้ (comment fa_sale.go:379-380)

## ทำงานอย่างไร

### คำสั่ง (`AssetSale` fa_sale.go:382, `assetSaleTx` :401)
- `preview` คำนวณแล้ว rollback; `save` insert หรือแก้ไข (ลบเอกสารเดิมแล้วเขียนใหม่ตามเลขที่); `delete`
- lock `asset-sale` แล้วตามด้วย lock GL แบบ shared ดู [[acc-gl-rebuild]]
- ด่านงวด: ลบตรวจวันที่เอกสารเดิม, บันทึกตรวจวันที่ใหม่ และวันที่ของเอกสารเดิมเมื่อแก้ไข (`checkOpenPeriod`) ดู [[acc-period-close]]
- ต้องมีสมุดรายวัน (`gl_journal_book`) ถ้าไม่ระบุ อ่านจาก `erp_doc_format.gl_book`; เลขเอกสารซ้ำ = "เลขที่เอกสาร ... มีอยู่แล้ว"; ตรวจเลขใบกำกับซ้ำด้วย `checkTaxDocNo`

### ข้อมูลสินทรัพย์ (`loadSaleAssets` :286)
- ราคาทุน = `as_asset_detail.as_buy_price`
- ค่าเสื่อมสะสม = `as_sum_value_balance` + SUM(`as_trans_detail.sum_amount`) ของเอกสาร 1801 ดู [[acc-fixed-asset-depreciation]]
- อยู่ในเอกสาร 1802 อื่นที่ยัง active = "สินทรัพย์ ... ขายไปแล้วในเอกสาร ..."; ไม่พบ = "ไม่พบสินทรัพย์"
- ไม่มีรหัสบัญชีสินทรัพย์หรือค่าเสื่อมสะสม = error ให้กำหนดก่อน

### สูตร (`calcAssetSale` :159)
- ราคาขายต่อรายการ = `bcRound` ที่ทศนิยมยอดเงินตาม round_type ดู [[acc-rounding-decimal]]
- vat_type 1 (รวมใน): ยอดก่อน VAT = HALF_EVEN(ราคา x 100 / (100 + อัตรา)), VAT = ราคา - ยอดก่อน VAT
- vat_type 0 (แยกนอก): VAT = HALF_EVEN(ราคา x อัตรา / 100) (`roundHalfEven` :93)
- vat_type อื่น = ยกเว้นภาษีทั้งจำนวน
- มูลค่าตามบัญชี = ราคาทุน - ค่าเสื่อมสะสม
- ยอดรวมและ VAT รวมคิดผ่าน vatCalc แล้วปัด HALF_UP 2 ตำแหน่ง (comment: journal เป็น 2 ตำแหน่ง)
- กำไร(ขาดทุน) = (ยอดรวม - VAT รวม) - (ราคาทุน - ค่าเสื่อมสะสม)
- อัตรา VAT ว่าง = `erp_option.vat_rate`; ไม่มีแถว erp_option ใช้ 7 (hardcode :323)

### GL แบบมาตรฐาน (`computeAssetSale` :321)
| ฝั่ง | บัญชี |
|---|---|
| Dr | คู่ค้า = ยอดรวม (เงินสด inquiry 1/3: 1111 / 1110 / 1100; เชื่อ: `ar_customer_detail.account_code` หรือ 1121 / 1120) |
| Dr | ค่าเสื่อมสะสม (`depreciation_sum_account_code`) ต่อสินทรัพย์ |
| Dr | ขาดทุนจากการจำหน่าย เมื่อผล < 0 |
| Cr | ราคาทุน (`account_code` ของสินทรัพย์) |
| Cr | ภาษีขาย 2134 / 2121 / 2135 / 2190 (ลำดับเดียวกับ standard GL :347) |
| Cr | กำไรจากการจำหน่าย เมื่อผล > 0 |

- บัญชีกำไรขาดทุนหาจากชื่อ: `gl_chart_of_account.name_1 ~ '(จำหน่าย|ขาย)สินทรัพย์'` เรียงรหัสเอาตัวแรก (:349)
- บัญชีใดไม่มีชื่อในผัง = "ไม่พบผังบัญชี ... (ต้องสร้างในผังบัญชีก่อนบันทึก)"; Dr ≠ Cr = "รายการบัญชีไม่สมดุล" (:364)

### GL แบบ template (`postAssetSaleTemplate` :600)
- รูปแบบเอกสารมี template จะลงตาม template แทน และไม่ fallback ไป standard; template ไม่ลงรายการ (รวมกรณีงวดปิด) = error ดู [[acc-gl-template-engine]]

### ตารางที่เขียน (`insertAssetSaleDoc` :513, `deleteAssetSaleDoc` :487)
- `as_trans`, `as_trans_detail`, UPDATE `as_asset_detail` (วันที่ขาย, ราคาขาย, เลขอ้างอิง) สำหรับ master และรายงาน
- `cb_trans` เฉพาะขายเงินสด (`assetSaleIsCash` :695)
- `gl_journal` / `gl_journal_detail`, `gl_journal_vat_sale` (`insertAssetSaleVat` :645), `gl_wht_list` / `gl_wht_list_detail` (`saveAssetSaleWht` :666)
- ลบ: ลบทุกตารางข้างต้นตาม doc_no + flag 1802 และล้างฟิลด์ขายใน `as_asset_detail`

## จุดเสี่ยง
- **บัญชีกำไรขาดทุนหาด้วย regex จากชื่อบัญชี** (comment ponytail :348) ถ้าผังมีหลายบัญชีชื่อคล้ายกัน จะได้รหัสน้อยสุด
- อัตรา VAT สำรอง 7 hardcode เมื่อไม่มีแถว erp_option (:323)
- VAT ต่อรายการปัด HALF_EVEN แต่ยอดรวมปัด HALF_UP 2 ตำแหน่งตายตัว ไม่ตาม `gl_no_decimal`
- ราคาทุนอ่านจาก `as_buy_price` ตรง ไม่รวมการปรับมูลค่า (ถ้ามี ยังไม่ยืนยัน)

## ที่มาในโค้ด
- `backend/internal/application/process/fa_sale.go:159` calcAssetSale
- `backend/internal/application/process/fa_sale.go:286` loadSaleAssets
- `backend/internal/application/process/fa_sale.go:321` computeAssetSale
- `backend/internal/application/process/fa_sale.go:349` หาบัญชีกำไรขาดทุนจากชื่อ
- `backend/internal/application/process/fa_sale.go:401` assetSaleTx
- `backend/internal/application/process/fa_sale.go:487` deleteAssetSaleDoc
- `backend/internal/application/process/fa_sale.go:513` insertAssetSaleDoc
- `backend/internal/application/process/fa_sale.go:600` postAssetSaleTemplate

## ดูเพิ่ม
- [[acc-fixed-asset-depreciation]]
- [[acc-gl-template-engine]]
- [[acc-vat-register-wht]]
- [[acc-period-close]]
- [[accounting-overview]]
