---
title: "ค่าเสื่อมราคาสินทรัพย์ถาวร (Fixed Asset Depreciation)"
tags: [accounting, fixed-asset, depreciation, gl, go]
aliases: ["ค่าเสื่อมราคา", "โอนค่าเสื่อม", "flag 1801", "เส้นตรง", "ลดน้อยถอยลง", "อัตราค่าเสื่อม", "ค่าเสื่อมสะสม", "ราคาซาก", "จำนวนวันสรรพากร", "30/360"]
sources: ["backend/internal/application/process/fa_depreciation.go:4", "backend/internal/application/process/fa_depreciation.go:28", "backend/internal/application/process/fa_depreciation.go:114", "backend/internal/application/process/fa_depreciation.go:126", "backend/internal/application/process/fa_depreciation.go:141", "backend/internal/application/process/fa_depreciation.go:144", "backend/internal/application/process/fa_depreciation.go:160", "backend/internal/application/process/fa_depreciation.go:471", "backend/internal/application/process/fa_depreciation.go:488", "backend/internal/application/process/fa_depreciation.go:719", "backend/internal/application/process/fa_depreciation.go:783", "backend/internal/application/process/fa_depreciation.go:794", "backend/internal/application/process/fa_depreciation.go:858", "backend/internal/application/process/fa_depreciation.go:935", "backend/internal/application/process/fa_depreciation.go:964", "backend/internal/application/process/asset_depreciation.go:66", "backend/internal/application/process/asset_depreciation.go:155"]
---

# ค่าเสื่อมราคาสินทรัพย์ถาวร (เอกสารโอนค่าเสื่อม 1801)

ค่าเสื่อมคำนวณตามช่วงวันที่ที่เลือก แล้วบันทึกเป็นเอกสาร `as_trans` flag 1801 + `as_trans_detail` (ต่อสินทรัพย์) + `gl_journal` / `gl_journal_detail` ใน transaction เดียว เครื่องคำนวณ port จาก C# `_assetDepreciation` และ**คิดแบบเส้นตรงอย่างเดียว** (comment fa_depreciation.go:4 ระบุว่า C# อ่าน calc_type แต่ไม่ได้ใช้)

## ทำงานอย่างไร

### ตัวเลือก (fa_depreciation.go:28)
- `ProcessMode`: 0 = จำนวนวันสรรพากร, 1 = จำนวนวันบัญชี 30/360 (ค่าเริ่มต้น), 2 = จำนวนวันจริง
- `ProcessBy`: 1 = รายวัน, 2 = รายเดือน (ค่าเริ่มต้น), 3 = รายปี
- ทศนิยม (`faAmountScale` :783) = `item_amount_decimal` ช่วง 0-6 (เก็บ 0 ได้) ค่าอื่น = 2; ทุกขั้นปัด HALF_UP

### สูตร (`depAsset`)
- มูลค่าคิดค่าเสื่อม (`newDepAsset` :114) = (มูลค่ายกมา ถ้าไม่ใช่ 0 มิฉะนั้นราคาทุน) - ราคาซาก
- อายุจริงเป็นปี (`yearAge` :126): ถ้าวันเริ่ม + อายุเต็มปี = วันสิ้นสุด ใช้อายุตามที่ตั้ง มิฉะนั้นคิดเศษปีจากจำนวนวัน
- ค่าเสื่อมต่อปี (`yearVal` :141) = มูลค่าคิด / อายุ
- ต่อเดือน (`monthVal` :144)
  - บัญชี: 30 x round(ต่อปี / 360)
  - สรรพากร: วันในเดือน x round(ต่อปี / 365) โดย ก.พ. ปีอธิกสุรทินนับ 28 วัน
  - วันจริง: วันในเดือน x round(ต่อปี / วันในปี)
- ต่อวัน (`dayVal` :160) แยกตามโหมดเช่นกัน
- สินทรัพย์ที่ขายแล้ว (มีแถว 1802) คิดถึงวันก่อนวันขาย 1 วัน (`depAssetOf` :471)
- `depCompute` (:488): ยอดยกไปติดลบ แสดงราคาซากแทน; ขายในงวด ยอดยกไป = 0

### GL (`depGLLines` :719)
- Dr บัญชีค่าเสื่อม (`depreciation_account_code`) / Cr ค่าเสื่อมสะสม (`depreciation_sum_account_code`) รวมยอดตามบัญชี
- Dr ไม่เท่า Cr (สินทรัพย์ไม่มีบัญชีฝั่งใดฝั่งหนึ่ง) = error "ผังบัญชีค่าเสื่อม/ค่าเสื่อมสะสมของสินทรัพย์ไม่ครบ..." ไม่ลง journal ที่ไม่สมดุล (:836)

### บันทึก (`FADepreciation` :794)
- save = false คือ preview; บันทึกทีละผู้ใช้ด้วย lock "fa-depreciation"
- `resolveDepDoc` (:895): ใช้เลขที่ระบุ หรือเอกสาร 1801 เดิมของงวดเดียวกัน; สมุดบัญชีจากรูปแบบเอกสาร
- `checkDepOverlap` (:935): ห้ามคิดสินทรัพย์ซ้ำในเอกสาร 1801 อื่นที่ช่วงวันที่ทับกัน
- `insertDepDoc` (:964) เขียนเอกสาร และบันทึก process log

### ลบ (`deleteFADepreciation` :858)
- ลบทั้ง as_trans, as_trans_detail, gl_journal_detail, gl_journal (C# ลบแค่หัว)
- ปฏิเสธเมื่อสินทรัพย์ในเอกสารถูกขาย (1802) ในหรือหลังวันที่เอกสาร "...ขายไปแล้วในเอกสาร..."
- ตรวจ `checkPeriodNotClosed` (ไม่พบงวดผ่านได้ งวดปิดไม่ผ่าน)

### ช่วยคำนวณใน master สินทรัพย์ (asset_depreciation.go)
- `assetRate` (:66): เส้นตรง อัตรา = 100 / อายุ; ลดน้อยถอยลง อัตรา = (1 - (ซาก / มูลค่า)^(1/อายุ)) x 100 คิดด้วย `big.Float` 256 bit แล้วปัด 14 หลักนัยสำคัญ (เลียน C# Math.Pow)
- `assetStopDate` (:155): วันหยุดคิด = วันเริ่ม + อายุ (ปี) - 1 วัน; อายุไม่เกิน 1000 ปี; 29 ก.พ. ถูก clamp (`addYearsClamped` :172)

## จุดเสี่ยง
- **ไม่ตรวจงวดบัญชีตอนบันทึก** (comment :792-793 ตาม C#) ลงค่าเสื่อมในงวดที่ปิดแล้วได้ ขณะที่การลบตรวจ ดู [[acc-period-close]]
- **ลดน้อยถอยลงคำนวณได้แค่อัตราใน master** แต่เครื่องคิดค่าเสื่อมใช้เส้นตรงเสมอ
- ปัดเศษทุกขั้นกลาง (ต่อปี ต่อวัน แล้วคูณจำนวนวัน) ผลรวมรายเดือนตลอดอายุอาจไม่เท่ามูลค่าคิดพอดี (ยังไม่ได้ตรวจว่ามีการปิดเศษงวดสุดท้ายหรือไม่)

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:28` ค่าคงที่ mode / by
- `backend/internal/application/process/fa_depreciation.go:114` newDepAsset
- `backend/internal/application/process/fa_depreciation.go:144` monthVal
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
