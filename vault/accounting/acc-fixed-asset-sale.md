---
title: "ขายสินทรัพย์ถาวร (Fixed Asset Sale 1802)"
tags: [accounting, fixed-asset, asset-sale, gl, vat]
aliases: ["ขายสินทรัพย์", "จำหน่ายสินทรัพย์", "flag 1802", "กำไรขาดทุนจากการจำหน่ายสินทรัพย์", "มูลค่าตามบัญชี", "as_sale_price", "ขายไปแล้วในเอกสาร"]
sources: ["backend/internal/application/process/fa_sale.go:93", "backend/internal/application/process/fa_sale.go:159", "backend/internal/application/process/fa_sale.go:185", "backend/internal/application/process/fa_sale.go:186", "backend/internal/application/process/fa_sale.go:286", "backend/internal/application/process/fa_sale.go:321", "backend/internal/application/process/fa_sale.go:323", "backend/internal/application/process/fa_sale.go:335", "backend/internal/application/process/fa_sale.go:339", "backend/internal/application/process/fa_sale.go:347", "backend/internal/application/process/fa_sale.go:349", "backend/internal/application/process/fa_sale.go:361", "backend/internal/application/process/fa_sale.go:370", "backend/internal/application/process/fa_sale.go:374", "backend/internal/application/process/fa_sale.go:380", "backend/internal/application/process/fa_sale.go:382", "backend/internal/application/process/fa_sale.go:401", "backend/internal/application/process/fa_sale.go:431", "backend/internal/application/process/fa_sale.go:487", "backend/internal/application/process/fa_sale.go:513", "backend/internal/application/process/fa_sale.go:552", "backend/internal/application/process/fa_sale.go:600", "backend/internal/application/process/fa_sale.go:645", "backend/internal/application/process/fa_sale.go:666", "backend/internal/application/process/fa_sale.go:695", "backend/internal/application/process/fa_depreciation.go:30", "backend/internal/application/process/period.go:17", "backend/internal/application/process/gl_template.go:730"]
---

# ขายสินทรัพย์ถาวร (เอกสาร 1802)

เอกสารขายสินทรัพย์เก็บใน `as_trans` / `as_trans_detail` flag 1802 (`depSaleFlag` fa_depreciation.go:30) พร้อม GL, ทะเบียนภาษีขาย, หัก ณ ที่จ่าย และ `cb_trans` เมื่อขายเงินสด สถานะ "ขายแล้ว" ของสินทรัพย์ derive จากแถว 1802 ลบเอกสารแล้วสินทรัพย์กลับมาขายได้ (comment fa_sale.go:380-381)

## ทำงานอย่างไร

### คำสั่ง (`AssetSale` fa_sale.go:382, `assetSaleTx` :401)
- `preview` คำนวณแล้ว rollback; `save` insert หรือแก้ไข (ลบเอกสารเดิมแล้วเขียนใหม่ตามเลขที่); `delete`
- lock `asset-sale` แล้วตามด้วย lock GL แบบ shared ดู [[acc-gl-rebuild]]
- ด่านงวด (`checkOpenPeriod` period.go:17 ต้องมีงวดและงวดเปิด): ลบตรวจวันที่เอกสารเดิม, บันทึกตรวจวันที่ใหม่ (:431) และวันที่ของเอกสารเดิมเมื่อแก้ไข; preview ไม่ตรวจงวด ดู [[acc-period-close]]
- ต้องมีสมุดรายวัน (`gl_journal_book`) ถ้าไม่ระบุ อ่านจาก `erp_doc_format.gl_book`; เลขเอกสารซ้ำใน `as_trans` หรือ `gl_journal` = "เลขที่เอกสาร ... มีอยู่แล้ว"; ตรวจเลขใบกำกับซ้ำด้วย `checkTaxDocNo` เฉพาะเมื่อเลขใบกำกับเปลี่ยนจากเอกสารเดิม

### ข้อมูลสินทรัพย์ (`loadSaleAssets` :286)
- ราคาทุน = `as_asset_detail.as_buy_price`
- ค่าเสื่อมสะสม = `as_sum_value_balance` + SUM(`as_trans_detail.sum_amount`) ของเอกสาร 1801 ดู [[acc-fixed-asset-depreciation]]
- อยู่ในเอกสาร 1802 อื่นที่ยัง active = "สินทรัพย์ ... ขายไปแล้วในเอกสาร ..."; ไม่พบ = "ไม่พบสินทรัพย์"
- ไม่มีรหัสบัญชีสินทรัพย์หรือค่าเสื่อมสะสม = error ให้กำหนดก่อน

### สูตร (`calcAssetSale` :159)
- ราคาขายต่อรายการ = `bcRound` ที่ทศนิยมยอดเงินตาม round_type ดู [[acc-rounding-decimal]]
- vat_type 1 (รวมใน): ยอดก่อน VAT = HALF_EVEN(ราคา x 100 / (100 + อัตรา)), VAT = ราคา - ยอดก่อน VAT
- vat_type 0 (แยกนอก): VAT = HALF_EVEN(ราคา x อัตรา / 100) (`roundHalfEven` :93) ปัดที่ทศนิยมยอดเงิน
- vat_type อื่น = ยกเว้นภาษีทั้งจำนวน
- มูลค่าตามบัญชี = ราคาทุน - ค่าเสื่อมสะสม
- ยอดรวมและ VAT รวมคิดผ่าน vatCalc แล้วปัด HALF_UP 2 ตำแหน่ง (:185 journal เป็น 2 ตำแหน่ง)
- กำไร(ขาดทุน) = (ยอดรวม - VAT รวม) - (ราคาทุน - ค่าเสื่อมสะสม) (:186)
- อัตรา VAT ว่าง = `erp_option.vat_rate`; ไม่มีแถว erp_option ใช้ 7 (hardcode :323)

### GL แบบมาตรฐาน (`computeAssetSale` :321)
| ฝั่ง | บัญชี |
|---|---|
| Dr | คู่ค้า = ยอดรวม (เงินสด inquiry 1/3: 1111 / 1110 / 1100 :335; เชื่อ: `ar_customer_detail.account_code` หรือ 1121 / 1120 :339) |
| Dr | ค่าเสื่อมสะสม (`depreciation_sum_account_code`) ต่อสินทรัพย์ |
| Dr | ขาดทุนจากการจำหน่าย เมื่อผล < 0 |
| Cr | ราคาทุน (`account_code` ของสินทรัพย์) |
| Cr | ภาษีขาย 2134 / 2121 / 2135 / 2190 (ลำดับเดียวกับ standard GL :347) |
| Cr | กำไรจากการจำหน่าย เมื่อผล > 0 |

- บัญชีกำไรขาดทุนหาจากชื่อ: `gl_chart_of_account.name_1 ~ '(จำหน่าย|ขาย)สินทรัพย์'` เรียงรหัสเอาตัวแรก (:349)
- บัญชีใดไม่มีชื่อในผัง = "ไม่พบผังบัญชี ... (ต้องสร้างในผังบัญชีก่อนบันทึก)" (:370); Dr ≠ Cr = "รายการบัญชีไม่สมดุล" (:374)

### GL แบบ template (`postAssetSaleTemplate` :600)
- รูปแบบเอกสารมี template จะลงตาม template แทน (ข้ามการตรวจชื่อบัญชี/สมดุลของแบบมาตรฐาน :361) และไม่ fallback ไป standard ดู [[acc-gl-template-engine]]
- template ไม่สมดุลหรือไม่มีรายการให้ลง = error; กรณีวันที่ไม่มีงวดหรืองวดปิด ถูกด่าน `checkOpenPeriod` ปฏิเสธตั้งแต่ก่อนลง GL แล้ว

### ตารางที่เขียน (`insertAssetSaleDoc` :513, `deleteAssetSaleDoc` :487)
- `as_trans`, `as_trans_detail`, UPDATE `as_asset_detail` (วันที่ขาย, `as_sale_price` = ยอดก่อน VAT ของรายการ :552, ผู้ซื้อ, เลขอ้างอิง) สำหรับ master และรายงาน
- `cb_trans` เฉพาะขายเงินสด (`assetSaleIsCash` :695)
- `gl_journal` / `gl_journal_detail`, `gl_journal_vat_sale` (`insertAssetSaleVat` :645), `gl_wht_list` / `gl_wht_list_detail` (`saveAssetSaleWht` :666)
- ลบ: ลบทุกตารางข้างต้นตาม doc_no + flag 1802 และล้างฟิลด์ขายใน `as_asset_detail`

## จุดเสี่ยง
- **บัญชีกำไรขาดทุนหาด้วย regex จากชื่อบัญชี** (comment ponytail :348) ถ้าผังมีหลายบัญชีชื่อคล้ายกัน จะได้รหัสน้อยสุด
- อัตรา VAT สำรอง 7 hardcode เมื่อไม่มีแถว erp_option (:323)
- VAT ต่อรายการปัด HALF_EVEN แต่ยอดรวมปัด HALF_UP 2 ตำแหน่งตายตัว ไม่ตาม `gl_no_decimal` (ค่านี้ใช้เฉพาะ template gl_template.go:730)
- ราคาทุนอ่านจาก `as_buy_price` ตรง; ค่าเสื่อมสะสมรวม `sum_amount` ของแถว 1801 ทุกแถวของสินทรัพย์ ไม่กรองสถานะหรือวันที่

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
