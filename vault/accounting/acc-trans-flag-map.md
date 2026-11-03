---
title: "รหัสชนิดเอกสาร trans_flag และทิศทางสต็อก (Trans Flag Map)"
tags: [accounting, trans-flag, reference, inventory]
aliases: ["trans_flag", "รหัสเอกสาร", "ชนิดเอกสาร", "calc_flag", "flag 44 คืออะไร", "screen code", "doc type"]
sources: ["backend/internal/application/process/gl_template_rules.go:20", "backend/internal/application/process/transcalc.go:14", "backend/internal/application/process/trans.go:21", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/trans.go:220", "backend/internal/application/process/trans_grid.go:92", "backend/internal/application/process/trans_grid.go:112", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/period.go:128", "backend/internal/application/process/journaltax.go:16", "backend/internal/application/process/fa_depreciation.go:29", "backend/internal/application/process/point_doc.go:14", "backend/internal/application/process/pay_other.go:42", "backend/internal/application/process/doc_flow_graph.go:200"]
---

# รหัสชนิดเอกสาร `trans_flag`

ทุกเอกสารแยกชนิดด้วย `trans_flag` (int) ในตาราง `ic_trans` / `ic_trans_detail` / `cb_trans` / `gl_journal`
ทิศทางสต็อกของแต่ละบรรทัดเก็บใน `calc_flag` (+1 = เข้า, -1 = ออก, 0 = ไม่กระทบ) ซึ่งได้มาจาก flag ของเอกสาร

## ทำงานอย่างไร

### flag กับรหัสหน้าจอ (screen code ของ `erp_doc_format`)
ได้จากแผนที่ `glRuleByScreen` (gl_template_rules.go:20) ซึ่งมีชื่อไทยของแต่ละหน้าจอเป็น comment ส่วน flag ที่ไม่อยู่ในแผนที่ อ้างชื่อจากไฟล์ที่ระบุในวงเล็บ

| กลุ่ม | flag (screen code) |
|---|---|
| ซื้อ | 12 PU ซื้อสินค้าและค่าบริการ, 14 PA ซื้อสินค้าเพิ่มหนี้หรือราคาผิด, 16 PT ส่งคืนสินค้าลดหนี้ราคาผิด, 310 PI พาเชียล_รับสินค้า, 311 PIA พาเชียล_ส่งคืนสินค้าหรือราคาผิด, 315 PIU พาเชียล_ตั้งหนี้, 316 PID พาเชียล_เพิ่มหนี้, 317 PIC พาเชียล_ลดหนี้ |
| มัดจำ/ล่วงหน้า ซื้อ | 10 PD จ่ายเงินล่วงหน้า, 11 PC จ่ายเงินมัดจำ, 20 PDR จ่ายเงินล่วงหน้า_รับคืน, 25 PCR จ่ายเงินมัดจำ_รับคืน |
| ขาย | 44 SI/SIP ขายสินค้าและบริการ, 46 SA ขาย_เพิ่มหนี้, 48 ST รับคืนสินค้าจากการขายและลดหนี้, 144 ใบกำกับภาษีอย่างเต็มออกแทน (pay_other.go:42) |
| มัดจำ/ล่วงหน้า ขาย | 40 SD รับเงินล่วงหน้า, 42 SDR เงินล่วงหน้า_คืน, 110 SRV รับเงินมัดจำ, 112 SRT เงินมัดจำ_คืน |
| สต็อก | 56 IO เบิกสินค้าวัตถุดิบ, 58 IR รับคืนสินค้าจากการเบิก, 60 IF รับสินค้าสำเร็จรูป, 66 IA ปรับปรุงสต็อก (เพิ่ม), 68 IS ปรับปรุงสต็อก_ขาด (ลด), 72 IM โอนออก (คู่ 70 โอนเข้า, trans.go:21-22), 124 ใบขอโอนสินค้า (trans.go:24, doc_flow_graph.go:202), 76 ตรวจนับสินค้า (doc_flow_graph.go:200), 54 ยอดยกมาสินค้า (stock_beginning.go:29) |
| ลูกหนี้/เจ้าหนี้ | 19 DE จ่ายชำระหนี้, 239 EE รับชำระหนี้, 87 COB ตั้งหนี้อื่น, 89 CDO เพิ่มหนี้อื่น, 91 CCO ลดหนี้อื่น (เจ้าหนี้), 99 AOB ตั้งหนี้อื่น, 101 ADO เพิ่มหนี้อื่น, 103 ACO ลดหนี้อื่น (ลูกหนี้) |
| รายได้/ค่าใช้จ่ายอื่น | 250 OI รายได้อื่น, 252 OCN รายได้อื่น_ลดหนี้, 254 ODN รายได้อื่น_เพิ่มหนี้, 260 EPO รายจ่ายอื่น, 262 EPC รายจ่ายอื่น_ลดหนี้, 264 EPD รายจ่ายอื่น_เพิ่มหนี้ |
| เงินสด/ธนาคาร | 300 PCD เบิกเงินสดย่อย, 301 PRM รับคืนเงินสดย่อย, 401 DM ฝากเงิน, 402 WM ถอนเงิน, 422 TM โอนเงินออกธนาคาร (คู่ 420 สร้างอัตโนมัติ, trans.go:25-26) |
| เช็ค/บัตร | 405 เช็ครับยกมา, 406 เช็คจ่ายยกมา (cheque_forward.go:5), เช็ครับ: 410 CHD ฝาก, 411 CHP ผ่าน, 412 CRT คืน, 413 CRC ยกเลิก, 416 CDE เปลี่ยนเช็ค, 418 CND ตั้งหนี้ใหม่; เช็คจ่าย: 451 CPP ผ่าน, 452 CHC ยกเลิก, 453 CPR คืน, 456 CPE เปลี่ยนเช็ค; 461 CRD บัตรเครดิต_ผ่าน, 462 CRN บัตรเครดิต_ยกเลิก, 463 WLD wallet_ผ่าน |
| สินทรัพย์ | 1801 โอนค่าเสื่อม, 1802 ASS ขายสินทรัพย์ (ตาราง `as_trans`, fa_depreciation.go:29-30) |
| อื่นๆ | 0/1999 สมุดรายวันทั่วไป (JV, `isVoucherFlag` journaltax.go:71), 1502 ภาษีหัก ณ ที่จ่าย / 1501 ภาษีถูกหัก ณ ที่จ่าย ของ JV (journaltax.go:17-19), 801 แต้มคงเหลือยกมา / 802 บันทึกตัดแต้ม (point_doc.go:14-20), 521-523 คลังรับฝาก ฝาก/เบิก/รับคืนจากเบิก (period.go:126-128) |

### `calc_flag` (transcalc.go:14)
- +1: 12, 14, 48, 54, 58, 60, 66, 70, 76, 310, 315, 316 และอื่นๆ ตามรายการในโค้ด (transcalc.go:16-18)
- -1: 16, 44, 46, 56, 68, 72, 144, 311, 317, 1802 ฯลฯ (transcalc.go:21-23)
- flag ที่ไม่อยู่ในทั้งสองรายการ = 0

### ชุด flag สำคัญที่ใช้ซ้ำในหลายไฟล์
- `saleGroupFlags` {30,34,36,44,46,48,144}, `purchaseGroupFlags` {2,6,12,14,16,310,311,315,316,317} (trans_grid.go:92-93)
- 30 เสนอราคา, 34 สั่งจอง, 36 สั่งขาย, 2 ขอซื้อ, 6 สั่งซื้อ: แม้บาง flag จะมี `calc_flag` +1 แต่ไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18) และไม่อยู่ใน `glRebuildTransFlags` จึงไม่กระทบยอดสต็อกและไม่ลง GL
- 66 เป็น grid เดียวที่ยอมให้ qty ติดลบ (`transFlagAdjustStock` trans_grid.go:112)
- `glRebuildTransFlags` (service.go:1742) = flag ที่ `RebuildGL` สร้าง GL มาตรฐานให้ (ต้องตรงกับ `buildStandardGLLines`); 54, 62, 64, 81-85, 93-97 และรหัสยกมา 90xx ไม่อยู่ในรายการ (service.go:1748, 1750)
- `glTemplateOnlyFlags` {72, 418} (gl_template.go:1096) และขายสินทรัพย์ 1802 ใน `as_trans` ลง GL ผ่าน GL template เท่านั้น เมื่อรูปแบบเอกสารมี template (gl_template.go:1100-1113) ดู [[acc-gl-template-engine]]
- `headerAmountFlags` 81, 83, 85, 93, 95, 97, 602, 604 = เอกสารที่มีแต่ยอดหัว ไม่มีบรรทัดรายการ (trans.go:216)
- `depositFlags` 10, 11, 20, 25, 40, 42, 110, 112 รวมรหัสยกมา 9010, 9011, 9040, 9110 บรรทัดเป็นรายละเอียด + จำนวนเงินใน `ap_ar_trans_detail` ไม่ใช่สินค้า (trans.go:218-221)
- `periodExemptFlags` 521, 522, 523 บันทึกได้โดยไม่ตรวจงวด (period.go:128, trans_validate.go:44) แต่การลบยังตรวจงวด

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template_rules.go:20` glRuleByScreen
- `backend/internal/application/process/transcalc.go:14` calcFlagByTransFlag
- `backend/internal/application/process/trans.go:21` ค่าคงที่ 72/70/124/422
- `backend/internal/application/process/trans.go:216` headerAmountFlags
- `backend/internal/application/process/trans.go:220` depositFlags
- `backend/internal/application/process/trans_grid.go:92` กลุ่ม flag ขาย/ซื้อ
- `backend/internal/application/process/service.go:1742` glRebuildTransFlags
- `backend/internal/application/process/gl_template.go:1096` glTemplateOnlyFlags
- `backend/internal/application/process/period.go:128` periodExemptFlags
- `backend/internal/application/process/journaltax.go:16` 1999/1501/1502
- `backend/internal/application/process/fa_depreciation.go:29` 1801/1802
- `backend/internal/application/process/point_doc.go:14` 801/802 (ไม่มีบรรทัด ไม่มีสต็อก ไม่มี GL)

## ดูเพิ่ม
- [[accounting-overview]]
- [[acc-transaction-save-flow]]
- [[acc-gl-posting-standard]]
- [[acc-inventory-stock-rebuild]]
