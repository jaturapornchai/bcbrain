---
title: "คิดค่าเสื่อมราคาสินทรัพย์ (โอนค่าเสื่อม 1801) คำนวณและลงบัญชีอย่างไร"
tags: [faq, fixed-asset, depreciation, gl]
aliases: ["คิดค่าเสื่อม", "โอนค่าเสื่อมราคา", "fixed asset depreciation", "trans_flag 1801", "as_trans", "menu_asset_transfers", "เส้นตรง 30/360", "depreciation_sum_account_code"]
sources: ["backend/internal/application/process/fa_depreciation.go:28", "backend/internal/application/process/fa_depreciation.go:144", "backend/internal/application/process/fa_depreciation.go:471", "backend/internal/application/process/fa_depreciation.go:590", "backend/internal/application/process/fa_depreciation.go:719", "backend/internal/application/process/fa_depreciation.go:794", "backend/internal/application/process/fa_depreciation.go:858", "backend/internal/application/process/asset_depreciation.go:66"]
---
# คิดค่าเสื่อมราคาสินทรัพย์ (โอนค่าเสื่อม 1801) คำนวณและลงบัญชีอย่างไร

**ตอบสั้น:** งานโอนค่าเสื่อม (`menu_asset_transfers`) คิดแบบเส้นตรงอย่างเดียว ปัด HALF_UP ที่ `item_amount_decimal` สร้างเอกสาร `as_trans` 1801 หนึ่งใบ มีแถวละสินทรัพย์ แล้วลง GL Dr ค่าเสื่อมราคา / Cr ค่าเสื่อมราคาสะสม รวมตามรหัสบัญชี รันซ้ำเลขเดิมได้ เพราะระบบลบแล้วสร้างใหม่

## รายละเอียด
ดู [[acc-fixed-asset-depreciation]], [[flow-fixed-asset-lifecycle]], [[doc-asset-depreciation-transfer]]

**ตัวเลือกการคำนวณ**
- คิดตาม (`ProcessBy`): 1 วัน, 2 เดือน (ค่าเริ่มต้น), 3 ปี; แบบรายวันได้ไม่เกิน 366 วัน
- จำนวนวัน (`ProcessMode`): 0 สรรพากร, 1 บัญชี 30/360 (ค่าเริ่มต้น), 2 วันจริง
- วันที่เอกสาร ถ้าไม่ระบุ ใช้วันสิ้นสุดของช่วง

**ฐานคำนวณต่อสินทรัพย์ (`depAssetOf`)** ([[tbl-as-asset]], [[tbl-as-asset-detail]])
- มูลค่าคิดค่าเสื่อม = `as_calc_value` ถ้าเป็น 0 ใช้ `as_buy_price`
- ยอดคงเหลือ = `as_value_balance` ถ้าเป็น 0 ใช้มูลค่าคิดค่าเสื่อม
- มูลค่าที่ตัด = ยอดคงเหลือ − ราคาซาก (`as_dead_value`)
- สินทรัพย์ที่ขายแล้ว (1802) คิดถึงวันก่อนวันขาย 1 วัน

**สูตร (ปัดทุกขั้น)**
- ต่อปี = มูลค่าที่ตัด ÷ อายุปี (อายุคำนวณจากวันเริ่ม/วันหยุดคิด)
- ต่อเดือน: โหมดบัญชี = 30 × (ต่อปี ÷ 360); สรรพากร = วันในเดือน × (ต่อปี ÷ 365) โดย ก.พ. ปีอธิกสุรทินนับ 28 วัน; วันจริง = วันในเดือน × (ต่อปี ÷ วันในปี)
- ต่อวัน: บัญชี = ต่อเดือน ÷ 30; สรรพากร = ต่อปี ÷ 365; วันจริง = ต่อปี ÷ วันในปี

**บันทึก (`FADepreciation`)**
1. ล็อก 'fa-depreciation' แล้วลบ `as_trans`, `as_trans_detail`, `gl_journal`, `gl_journal_detail` ของเลขเอกสารเดิม
2. ไม่มีสินทรัพย์ → "ไม่พบสินทรัพย์ที่ต้องคิดค่าเสื่อมในช่วง ..."
3. สินทรัพย์เดียวกันมีเอกสาร 1801 อื่นช่วงวันทับกัน → "สินทรัพย์ช่วงวันที่นี้โอนค่าเสื่อมไปแล้วในเอกสาร ..."
4. GL (`depGLLines`): Dr `depreciation_account_code` / Cr `depreciation_sum_account_code` ถ้ารหัสไม่ครบจน Dr ≠ Cr → "ผังบัญชีค่าเสื่อม/ค่าเสื่อมสะสมของสินทรัพย์ไม่ครบ ..."
5. `gl_journal` journal_type 0, trans_direct 1 ([[tbl-as-trans]])

**ลบ** ปฏิเสธถ้าสินทรัพย์ในเอกสารถูกขาย (1802) ในวันที่เดียวกันหรือหลังวันที่เอกสาร

## ข้อควรระวัง
- ประเภท `calc_type` (ลดน้อยถอยลง) ไม่มีผลกับงานโอนค่าเสื่อม ใช้เฉพาะช่วยเติมอัตราเริ่มต้นในจอสินทรัพย์ (`assetRate`: เส้นตรง = 100 ÷ อายุ, ลดน้อยถอยลง = (1 − (ซาก/มูลค่า)^(1/อายุ)) × 100 ปัดค่ายกกำลังที่ 15 หลักนัยสำคัญ)
- บันทึกไม่ตรวจงวดบัญชี ส่วนลบตรวจแบบผ่อน (ไม่พบงวด = ผ่าน, งวดปิด = ปฏิเสธ) ([[faq-period-closed-cannot-save]])
- งวดใน `gl_journal` หาจากช่วงวันที่ ไม่ดู status
- ไม่ได้ใช้รูปแบบ GL (doc format) ลง Dr/Cr ตามรหัสบัญชีของสินทรัพย์ตรงๆ

## ดูเพิ่ม
- [[acc-fixed-asset-depreciation]]
- [[faq-fixed-asset-sale]]
- [[flow-fixed-asset-lifecycle]]
- [[faq-rounding-decimal]]
- [[tbl-as-asset-type]]

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:28` ค่าคงที่ 1801/1802, โหมด, ProcessBy
- `backend/internal/application/process/fa_depreciation.go:111` ปัด `RoundHalfUp`; `:141` `yearVal`; `:144` `monthVal`; `:160` `dayVal`
- `backend/internal/application/process/fa_depreciation.go:471` `depAssetOf`
- `backend/internal/application/process/fa_depreciation.go:590` `normalizeFADepreciation`
- `backend/internal/application/process/fa_depreciation.go:719` `depGLLines`; `:783` `faAmountScale`
- `backend/internal/application/process/fa_depreciation.go:794` `FADepreciation`; `:935` `checkDepOverlap`; `:964` `insertDepDoc`
- `backend/internal/application/process/fa_depreciation.go:858` `deleteFADepreciation`; `:877` ตรวจงวดแบบผ่อน
- `backend/internal/application/process/asset_depreciation.go:66` `assetRate`
