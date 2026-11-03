---
title: "บทเรียนการลงบัญชี GL และความสมดุล (GL Posting & Balance)"
tags: [history, lesson, gl, journal]
aliases: ["GL ไม่สมดุล", "journal unbalanced", "GL fallback", "ValidateAndBalanceJournal", "resolveChartAccount"]
sources: ["backend/internal/application/process/service.go:508", "backend/internal/application/process/service.go:1346", "backend/internal/application/process/service.go:1625", "backend/internal/application/process/service.go:1677", "backend/internal/application/process/service.go:1766", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/gl_template.go:1046", "backend/internal/application/process/gl_pay_other.go:17", "backend/internal/application/process/fa_sale.go:184", "backend/internal/application/process/fa_sale.go:374", "backend/internal/application/process/fa_sale.go:695", "backend/internal/application/process/fa_sale_test.go:125", "backend/internal/application/process/service_test.go:15", "AGENTS.md:50"]
---

# บทเรียนการลงบัญชี GL และความสมดุล

GL มีสองทางลงรายการ: ตามรูปแบบ `erp_doc_format_gl` (ตัวสร้างแบบ template) และทางสำรองมาตรฐาน `buildStandardGLLines` ถ้าทางใดทางหนึ่งลงด้านเดียว ใช้รหัสบัญชีที่ไม่อยู่ในผัง หรือไม่อ่านแท็บชำระ เดบิตจะไม่เท่าเครดิตหรืองบจะไม่แสดงบรรทัดนั้น

## อะไรพังได้
- **เดบิต != เครดิต**: template ที่ลงรายการด้านเดียว หรือการปัดทศนิยมต่างกันระหว่างบรรทัดทำให้ผลรวมไม่เท่ากัน
- **รหัสบัญชีไม่อยู่ในผัง** (`gl_chart_of_account`): รายการลงแล้วแต่งบดุลไม่แสดงบรรทัดนั้น
- **ทางสำรองไม่อ่านแท็บชำระ**: รายได้/ค่าใช้จ่ายอื่น เงินทอน ภาษีถูกหัก ณ ที่จ่าย เช็ค บัตร ถูกลงเป็นเงินสดทั้งยอด
- **ขายสินทรัพย์ตัดสินสด/เชื่อผิด**: ลูกหนี้กับเงินสดสลับกัน ถ้าแต่ละจุดตีความ `inquiry_type` เอง
- **rebuild ช่วงวันที่ที่ไม่มีจริง**: วันที่ปี 0000 ผ่านการ parse แต่ PostgreSQL ไม่มีปี 0 จึงได้ error 500 ดิบ

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ตรวจสมดุลก่อนลง | `backend/internal/application/process/service.go:508` `ValidateAndBalanceJournal` | ปัดแต่ละบรรทัดแล้วเทียบผลรวมเดบิต/เครดิตด้วย `big.Rat` ไม่สมดุลหรือไม่มีบรรทัด = error; ทางสำรองเรียกที่ `backend/internal/application/process/service.go:1625` ก่อน INSERT `gl_journal` |
| template ไม่สมดุล | `gl_template.go:1046` | เทียบผลรวมของ template แล้วคืนข้อความเตือน "ไม่สมดุล" ให้ผู้เรียกใช้ทางสำรอง/ข้ามเอกสารนั้น ไม่ทำให้บันทึกหรือ rebuild ทั้งก้อนล้ม (คอมเมนต์ `gl_template.go:998-1002`) |
| ขายสินทรัพย์ | `fa_sale.go:374` | ปฏิเสธรายการไม่สมดุล; `fa_sale.go:184` ปัดค่าเข้า 2 ทศนิยมก่อนเพื่อให้ Dr = Cr แม้ `item_amount_decimal` กว้างกว่า |
| สด/เชื่อของขายสินทรัพย์ | `fa_sale.go:695` `assetSaleIsCash` | จุดตัดสินจุดเดียว (`inquiry_type` 1 และ 3 = สด) เทสทุกค่าที่ `fa_sale_test.go:125` |
| รหัสบัญชีต้องอยู่ในผัง | `backend/internal/application/process/service.go:1766` `resolveChartAccount` | ไล่รหัสที่ต้องการทีละตัวจนเจอในผัง; ภาษีถูกหัก ณ ที่จ่ายฝั่งจ่ายไล่ 2122, 2123, 2120 (`backend/internal/application/process/service.go:1874`) |
| ล้างรหัสยกมาสต็อกที่ไม่อยู่ในผัง | `backend/internal/application/process/service.go:1677-1686` | ตอน RebuildGL แก้บรรทัด `trans_flag = 54` ที่ `account_code` ไม่มีในผัง |
| ทางสำรองอ่านแท็บชำระ | `backend/internal/application/process/service.go:1871` `payTenders`; `gl_pay_other.go:17` `payOtherGL` | แยกเงินสด/โอน/เช็ค/บัตร/ภาษีถูกหัก; รายได้อื่น (doc_type 12) และค่าใช้จ่ายอื่น (11) อ่านจาก `cb_trans_detail` และคืน error ถ้าอ่านไม่ได้ (ไม่ข้ามเงียบ) |
| ตรวจช่วงวันที่ rebuild | `backend/internal/application/process/service.go:1346` `checkDateRange` | ปฏิเสธรูปแบบผิด ปี < 1 และวันเริ่มหลังวันสิ้นสุด ก่อนยิง SQL; เทส `backend/internal/application/process/service_test.go:15` |

## กฎที่ต้องจำ
- ทุกเส้นทางที่สร้างรายการบัญชีต้องผ่านการตรวจสมดุล หรือเตือนชัดเจน ห้ามเก็บ Dr != Cr เงียบ ๆ
- รหัสบัญชี resolve จากข้อมูลหลักหรือผัง ห้ามฝังรหัสตายตัวแล้วเชื่อว่ามีในผัง
- ทางสำรองต้องอ่านแท็บชำระครบทุกช่องทาง ไม่ใช่คิดจากยอดรวมเอกสาร
- ค่าที่ตีความ enum (เช่น `inquiry_type`) ต้องมีฟังก์ชันตัดสินจุดเดียวและเทสทุกค่า
- รายการบัญชีเป็นผลที่ rebuild ได้จากข้อมูลดิบ (`AGENTS.md:50`) จึงแก้ที่ต้นทางแล้วสั่ง rebuild แทนแก้ GL ตรง ๆ

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:508-530, 1625, 1766-1783` ตรวจสมดุลและเลือกรหัสบัญชี
- `backend/internal/application/process/gl_template.go:1045-1047` เตือน template ไม่สมดุล
- `backend/internal/application/process/gl_pay_other.go:17` รายได้/ค่าใช้จ่ายอื่นในทางสำรอง
- ดูเพิ่ม: [[acc-gl-posting-standard]] · [[acc-gl-template-engine]] · [[acc-gl-rebuild]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-payment-cheque-tenders]] · [[history-overview]]
