---
title: "รหัสชนิดเอกสาร trans_flag และทิศทางสต็อก (Trans Flag Map)"
tags: [accounting, trans-flag, reference, inventory]
aliases: ["trans_flag", "รหัสเอกสาร", "ชนิดเอกสาร", "calc_flag", "flag 44 คืออะไร", "screen code", "doc type"]
sources: ["backend/internal/application/process/gl_template_rules.go:20", "backend/internal/application/process/transcalc.go:14", "backend/internal/application/process/trans.go:19", "backend/internal/application/process/trans_grid.go:85", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/period.go:126", "backend/internal/application/process/journaltax.go:16", "backend/internal/application/process/fa_depreciation.go:28", "backend/internal/application/process/point_doc.go:14"]
---

# รหัสชนิดเอกสาร `trans_flag`

ทุกเอกสารแยกชนิดด้วย `trans_flag` (int) ในตาราง `ic_trans` / `ic_trans_detail` / `cb_trans` / `gl_journal`
ทิศทางสต็อกของแต่ละบรรทัดเก็บใน `calc_flag` (+1 = เข้า, -1 = ออก, 0 = ไม่กระทบ) ซึ่งได้มาจาก flag ของเอกสาร

## ทำงานอย่างไร

### flag กับรหัสหน้าจอ (screen code ของ `erp_doc_format`)
ได้จากแผนที่ `glRuleByScreen` (gl_template_rules.go:20) และ comment ใน `buildStandardGLLines`

| กลุ่ม | flag (screen code) |
|---|---|
| ซื้อ | 12 PU ซื้อ/ตั้งหนี้, 14 PA, 16 PT ส่งคืน/ลดหนี้, 310 PI ทยอยรับสินค้า, 311 PIA ส่งคืนจากการรับ, 315 PIU ตั้งหนี้จากการรับ, 316 PID, 317 PIC |
| มัดจำ/ล่วงหน้า ซื้อ | 10 PD จ่ายเงินล่วงหน้า, 11 PC จ่ายเงินมัดจำ, 20 PDR, 25 PCR (รับคืน) |
| ขาย | 44 SI/SIP ขาย, 46 SA, 48 ST รับคืน/ลดหนี้, 144 ใบกำกับเต็มรูปออกแทน |
| มัดจำ/ล่วงหน้า ขาย | 40 SD รับเงินล่วงหน้า, 42 SDR, 110 SRV รับเงินมัดจำ, 112 SRT |
| สต็อก | 56 IO เบิก, 58 IR รับคืนจากเบิก, 60 IF, 66 IA ปรับปรุงเพิ่ม, 68 IS ปรับปรุงลด, 72 IM โอนออก (คู่ 70 โอนเข้า), 124 ขอโอน, 76 ตรวจนับ, 54 ยอดยกมาสินค้า |
| ลูกหนี้/เจ้าหนี้ | 19 DE จ่ายชำระหนี้, 239 EE รับชำระหนี้, 87 COB, 89 CDO, 91 CCO (เจ้าหนี้อื่น), 99 AOB, 101 ADO, 103 ACO (ลูกหนี้อื่น) |
| รายได้/ค่าใช้จ่ายอื่น | 250 OI, 252 OCN, 254 ODN, 260 EPO, 262 EPC, 264 EPD |
| เงินสด/ธนาคาร | 300 PCD เบิกเงินสดย่อย, 301 PRM คืน, 401 DM ฝากธนาคาร, 402 WM ถอน, 422 TM โอนออก (คู่ 420) |
| เช็ค/บัตร | 405 เช็ครับยกมา, 406 เช็คจ่ายยกมา, 410 CHD, 411 CHP, 412 CRT, 413 CRC, 416 CDE, 418 CND, 451 CPP, 452 CHC, 453 CPR, 456 CPE, 461 CRD, 462 CRN, 463 WLD |
| สินทรัพย์ | 1801 โอนค่าเสื่อม, 1802 ASS ขายสินทรัพย์ (ตาราง `as_trans`) |
| อื่นๆ | 0/1999 สมุดรายวันทั่วไป (JV), 1501/1502 WHT ของ JV, 801/802 แต้มสะสม, 521-523 คลังรับฝาก |

ชื่อภาษาไทยของ flag ที่ไม่มีใน comment ของโค้ด (เช่น 14, 46, 316, 60) ยังไม่ยืนยัน จึงใส่เพียง screen code

### `calc_flag` (transcalc.go:14)
- +1: 12, 14, 48, 54, 58, 60, 66, 70, 76, 310, 315, 316 และอื่นๆ ตามรายการในโค้ด
- -1: 16, 44, 46, 56, 68, 72, 144, 311, 317, 1802 ฯลฯ
- flag ที่ไม่อยู่ในทั้งสองรายการ = 0 (port มาจาก C# `_global._transStockCalcType`)

### ชุด flag สำคัญที่ใช้ซ้ำในหลายไฟล์
- `saleGroupFlags` {30,34,36,44,46,48,144}, `purchaseGroupFlags` {2,6,12,14,16,310,311,315,316,317} (trans_grid.go:85-115)
- 30 เสนอราคา, 34 สั่งจอง, 36 สั่งขาย, 2 ขอซื้อ, 6 สั่งซื้อ: แม้บาง flag จะมี `calc_flag` +1 แต่ไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18) และไม่อยู่ใน `glRebuildTransFlags` จึงไม่กระทบยอดสต็อกและไม่ลง GL
- 66 เป็น grid เดียวที่ยอมให้ qty ติดลบ
- `glRebuildTransFlags` (service.go:1731) = flag ที่สร้าง GL ได้; 54, 62, 64, 81-85, 93-97 ไม่ลง GL
- `headerAmountFlags` 81, 83, 85, 93, 95, 97, 602, 604 = เอกสารที่มีแต่ยอดหัว ไม่มีบรรทัดรายการ (trans.go)
- `depositFlags` รวมรหัสยกมา 9010, 9011, 9040, 9110 (trans.go)
- `periodExemptFlags` 521, 522, 523 บันทึกได้โดยไม่ตรวจงวด แต่การลบยังตรวจงวด (period.go:126)

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template_rules.go:20` glRuleByScreen
- `backend/internal/application/process/transcalc.go:14` calcFlagByTransFlag
- `backend/internal/application/process/trans.go:19` ค่าคงที่ 72/70/124/422
- `backend/internal/application/process/trans_grid.go:85` กลุ่ม flag ขาย/ซื้อ
- `backend/internal/application/process/service.go:1731` glRebuildTransFlags
- `backend/internal/application/process/period.go:126` periodExemptFlags
- `backend/internal/application/process/journaltax.go:16` 1999/1501/1502
- `backend/internal/application/process/fa_depreciation.go:28` 1801/1802
- `backend/internal/application/process/point_doc.go:14` 801/802 (ไม่มีบรรทัด ไม่มีสต็อก ไม่มี GL)

## ดูเพิ่ม
- [[accounting-overview]]
- [[acc-transaction-save-flow]]
- [[acc-gl-posting-standard]]
- [[acc-inventory-stock-rebuild]]
