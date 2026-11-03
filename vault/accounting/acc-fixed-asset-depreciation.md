---
title: "ค่าเสื่อมราคาสินทรัพย์ถาวร (Fixed Asset Depreciation)"
tags: [accounting, fixed-asset, depreciation, gl, go]
aliases: ["ค่าเสื่อมราคา", "โอนค่าเสื่อม", "flag 1801", "เส้นตรง", "ลดน้อยถอยลง", "อัตราค่าเสื่อม", "ค่าเสื่อมสะสม", "ราคาซาก", "จำนวนวันสรรพากร", "30/360"]
sources: ["backend/internal/application/process/fa_depreciation.go:4", "backend/internal/application/process/fa_depreciation.go:28", "backend/internal/application/process/fa_depreciation.go:114", "backend/internal/application/process/fa_depreciation.go:126", "backend/internal/application/process/fa_depreciation.go:141", "backend/internal/application/process/fa_depreciation.go:144", "backend/internal/application/process/fa_depreciation.go:160", "backend/internal/application/process/fa_depreciation.go:214", "backend/internal/application/process/fa_depreciation.go:262", "backend/internal/application/process/fa_depreciation.go:264", "backend/internal/application/process/fa_depreciation.go:360", "backend/internal/application/process/fa_depreciation.go:471", "backend/internal/application/process/fa_depreciation.go:488", "backend/internal/application/process/fa_depreciation.go:601", "backend/internal/application/process/fa_depreciation.go:604", "backend/internal/application/process/fa_depreciation.go:656", "backend/internal/application/process/fa_depreciation.go:719", "backend/internal/application/process/fa_depreciation.go:783", "backend/internal/application/process/fa_depreciation.go:793", "backend/internal/application/process/fa_depreciation.go:794", "backend/internal/application/process/fa_depreciation.go:837", "backend/internal/application/process/fa_depreciation.go:858", "backend/internal/application/process/fa_depreciation.go:877", "backend/internal/application/process/fa_depreciation.go:895", "backend/internal/application/process/fa_depreciation.go:935", "backend/internal/application/process/fa_depreciation.go:964", "backend/internal/application/process/fa_depreciation.go:989", "backend/internal/application/process/asset_depreciation.go:66", "backend/internal/application/process/asset_depreciation.go:155", "backend/internal/application/process/asset_depreciation.go:172", "backend/internal/application/process/period.go:27"]
---

# ค่าเสื่อมราคาสินทรัพย์ถาวร (เอกสารโอนค่าเสื่อม 1801)

ค่าเสื่อมคำนวณตามช่วงวันที่ที่เลือก แล้วบันทึกเป็นเอกสาร `as_trans` flag 1801 + `as_trans_detail` (ต่อสินทรัพย์) + `gl_journal` / `gl_journal_detail` ใน transaction เดียว เครื่องคำนวณ**คิดแบบเส้นตรงอย่างเดียว** ไม่อ่าน `calc_type` ของสินทรัพย์ (comment fa_depreciation.go:4) ข้อมูลดิบคือ `as_asset_detail` (+ เอกสารขาย 1802) เอกสาร 1801 สร้างใหม่ทั้งใบ (ลบ + insert ตามเลขที่) ทุกครั้งที่บันทึก

## ทำงานอย่างไร

### ตัวเลือก (fa_depreciation.go:28)
- `ProcessMode`: 0 = จำนวนวันสรรพากร, 1 = จำนวนวันบัญชี 30/360 (ค่าเริ่มต้น :604), 2 = จำนวนวันจริง
- `ProcessBy`: 1 = รายวัน, 2 = รายเดือน (ค่าเริ่มต้น :601), 3 = รายปี
- ทศนิยม (`faAmountScale` :783) = `erp_option.item_amount_decimal` ช่วง 0-6 (เก็บ 0 ได้) ค่าอื่น/NULL/ไม่มีแถว = 2; ทุกขั้นปัด HALF_UP ที่ทศนิยมนี้

### สูตร (`depAsset`)
- ข้อมูลต่อสินทรัพย์อ่านจาก `as_asset_detail` + `as_asset` (:656)
- มูลค่าคิดค่าเสื่อม (`depAssetOf` :471 + `newDepAsset` :114) = (`as_value_balance` ถ้าไม่ใช่ 0 มิฉะนั้น `as_calc_value` ถ้าไม่ใช่ 0 มิฉะนั้น `as_buy_price`) - `as_dead_value` (ราคาซาก)
- อายุจริงเป็นปี (`yearAge` :126): ถ้าวันเริ่ม + อายุเต็มปี = วันสิ้นสุด ใช้อายุตามที่ตั้ง มิฉะนั้นคิดเศษปีจากจำนวนวัน
- ค่าเสื่อมต่อปี (`yearVal` :141) = round(มูลค่าคิด / อายุ)
- ต่อเดือน (`monthVal` :144)
  - บัญชี: 30 x round(ต่อปี / 360)
  - สรรพากร: วันในเดือน x round(ต่อปี / 365) โดย ก.พ. ปีอธิกสุรทินนับ 28 วัน
  - วันจริง: วันในเดือน x round(ต่อปี / วันในปี)
- ต่อวัน (`dayVal` :160): บัญชี = ต่อเดือน / 30; สรรพากร = ต่อปี / 365; วันจริง = ต่อปี / วันในปี
- ปิดเศษ: ปีสุดท้าย = มูลค่าคิด - ยอดสะสม (:214); รายเดือน เดือนธันวาคม = ยอดปีนั้น - ยอดที่คิดไปแล้วในปี (:264) และเดือนที่หยุดคิด = มูลค่าคิด - ยอดสะสม (:262); รายวันทำแบบเดียวกัน (:360)
- สินทรัพย์ที่ขายแล้ว (มีแถว 1802) คิดถึงวันก่อนวันขาย 1 วัน (`depAssetOf` :471)
- `depCompute` (:488): ยอดยกไปติดลบ แสดงราคาซากแทน; ขายในงวด ยอดยกไป = 0

### GL (`depGLLines` :719)
- Dr บัญชีค่าเสื่อม (`as_asset.depreciation_account_code`) / Cr ค่าเสื่อมสะสม (`as_asset.depreciation_sum_account_code`) รวมยอดตามบัญชี; สินทรัพย์ที่ไม่มีรหัสบัญชีถูกข้าม
- Dr ไม่เท่า Cr (สินทรัพย์ไม่มีบัญชีฝั่งใดฝั่งหนึ่ง) = error "ผังบัญชีค่าเสื่อม/ค่าเสื่อมสะสมของสินทรัพย์ไม่ครบ..." ไม่ลง journal ที่ไม่สมดุล (:837)
- ทุกสินทรัพย์ไม่มีบัญชี = บันทึกเอกสารแต่ไม่สร้าง journal (:989); `period_number` / `account_year` ของ journal หาจาก `erp_account_period` ที่ครอบวันที่เอกสาร

### บันทึก (`FADepreciation` :794)
- save = false คือ preview; บันทึกทีละผู้ใช้ด้วย advisory lock "fa-depreciation"
- `resolveDepDoc` (:895): ใช้เลขที่ระบุ หรือเอกสาร 1801 เดิมของช่วงวันที่เดียวกัน (ต้องพบพอดี 1 ใบ); สมุดบัญชีจาก `erp_doc_format.gl_book`; เลขที่ที่ถูกใช้กับเอกสารอื่นไม่ได้
- `checkDepOverlap` (:935): ห้ามคิดสินทรัพย์ซ้ำในเอกสาร 1801 อื่นที่ช่วงวันที่ทับกัน
- `insertDepDoc` (:964) เขียนเอกสาร และบันทึก process log

### ลบ (`deleteFADepreciation` :858)
- ลบทั้ง `as_trans_detail`, `as_trans`, `gl_journal_detail`, `gl_journal` ของเอกสารใน transaction เดียว
- ปฏิเสธเมื่อสินทรัพย์ในเอกสารถูกขาย (1802) ในหรือหลังวันที่เอกสาร "...ขายไปแล้วในเอกสาร..."
- ตรวจ `checkPeriodNotClosed` (:877, period.go:27 — ไม่พบงวดผ่านได้ งวดปิดไม่ผ่าน)

### ช่วยคำนวณใน master สินทรัพย์ (asset_depreciation.go)
- `assetRate` (:66): เส้นตรง อัตรา = 100 / อายุ; ลดน้อยถอยลง อัตรา = (1 - (ซาก / มูลค่า)^(1/อายุ)) x 100 คิดด้วย `big.Float` 256 bit แล้วปัดผลยกกำลังเหลือ 15 หลักนัยสำคัญก่อนลบออกจาก 1
- `assetStopDate` (:155): วันหยุดคิด = วันเริ่ม + อายุ (ปีเต็ม ตัดเศษ) - 1 วัน; อายุไม่เกิน 1000 ปี; 29 ก.พ. ไปปีที่ไม่อธิกสุรทินเป็น 28 ก.พ. (`addYearsClamped` :172)

## จุดเสี่ยง
- **ไม่ตรวจงวดบัญชีตอนบันทึก** (comment :793) ลงค่าเสื่อมในงวดที่ปิดแล้วได้ ขณะที่การลบตรวจ ดู [[acc-period-close]]
- **ลดน้อยถอยลงคำนวณได้แค่อัตราใน master** แต่เครื่องคิดค่าเสื่อมใช้เส้นตรงเสมอ
- ปัดเศษทุกขั้นกลาง (ต่อปี ต่อวัน แล้วคูณจำนวนวัน) ยอดรายงวดจึงต่างกันเล็กน้อย แต่ปีสุดท้าย/เดือนที่หยุดคิดรับเศษที่เหลือ ยอดรวมตลอดอายุจึงเท่ามูลค่าคิด (ยกเว้นสินทรัพย์ที่ขายก่อนครบอายุ)

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:28` ค่าคงที่ mode / by
- `backend/internal/application/process/fa_depreciation.go:114` newDepAsset
- `backend/internal/application/process/fa_depreciation.go:144` monthVal
- `backend/internal/application/process/fa_depreciation.go:262` เดือนสุดท้ายรับเศษ
- `backend/internal/application/process/fa_depreciation.go:488` depCompute
- `backend/internal/application/process/fa_depreciation.go:719` depGLLines
- `backend/internal/application/process/fa_depreciation.go:794` FADepreciation
- `backend/internal/application/process/fa_depreciation.go:858` deleteFADepreciation
- `backend/internal/application/process/fa_depreciation.go:935` checkDepOverlap
- `backend/internal/application/process/asset_depreciation.go:66` assetRate

## ดูเพิ่ม
- [[acc-fixed-asset-sale]]
- [[acc-period-close]]
- [[acc-rounding-decimal]]
