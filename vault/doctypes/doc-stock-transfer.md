---
title: "โอนสินค้า/วัตถุดิบ ระหว่างคลัง (Stock Transfer)"
tags: [doctypes, inventory]
aliases: ["trans_flag 72", "trans_flag 70", "โอนสินค้า", "สินค้า_โอนออก", "สินค้า_โอนเข้า", "IM"]
sources: ["frontend/account/tabs/transMenuMap.ts:1073", "frontend/account/transaction/transLayouts.ts:99", "backend/internal/application/process/trans.go:18", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:69", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/doc_cancel.go:53"]
---

# โอนสินค้า/วัตถุดิบ (trans_flag 72 โอนออก + 70 โอนเข้า)

## ใช้เมื่อไร
ใช้ย้ายสินค้าระหว่างคลังหรือที่เก็บ อ้างใบขอโอน 124 ได้ อยู่ที่เมนู "โอนสินค้า/วัตถุดิบ" (IM, transMenuMap.ts:1073 เมนูใส่ transFlags 72/124 และมีค่า isTransfer)

## trans_flag/ตาราง
- สินค้าแต่ละรายการเขียน 2 บรรทัดภายใต้ doc_no เดียวกัน คือบรรทัดโอนออก 72 (calc −1) และบรรทัดโอนเข้า 70 (calc +1) (comment trans.go:18)
- หัวเอกสาร 70 ถูกสร้างใหม่จากหัว 72 ทุกครั้ง (`syncStockTransferIn` stock_rebuild.go:69) ภายใน `rebuildTransDerived` (trans.go:593)
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, sale, wh, whTo แท็บ gl (transLayouts.ts:99)
- ช่อง sale แสดงชื่อ "ผู้ขอโอน:" และไม่แสดงราคา (transLayouts.ts:306, :474)

## ผลต่อสต็อก
- 72 ตัดออกจากคลังต้นทาง และ 70 รับเข้าคลังปลายทาง ทั้งสอง flag อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)
- อยู่ใน `stockCheckFlags` ซึ่งตรวจยอดคงเหลือตอนบันทึก (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
- ไม่มี standard GL โดย 72 อยู่ใน `glTemplateOnlyFlags` ลง GL เฉพาะเมื่อรูปแบบเอกสารมี template (gl_template.go:1096) ดู [[acc-gl-template-engine]]
- ถ้าไม่มี template จะไม่มี GL (ไม่พบ fallback ในโค้ด)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขอโอน 124 (คู่ {72,124} trans_ref_import.go:23)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 73 ซึ่งใช้ได้กับทั้ง 70 และ 72 (doc_cancel.go:53)

## ข้อควรระวัง
- หัวเอกสาร 70 เป็นข้อมูล derived ห้ามแก้ตรง ระบบลบแล้วสร้างใหม่ทุกครั้ง
- doc_flow_graph.go:197 มี label 62 "โอนสินค้ารับเข้า" แต่ใน backend ใช้ 70 เป็นโอนเข้า

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1073` เมนู
- `frontend/account/transaction/transLayouts.ts:99` FLAG_SPEC 72
- `backend/internal/application/process/trans.go:18` คู่ 72/70
- `backend/internal/application/process/stock_rebuild.go:69` syncStockTransferIn
- `backend/internal/application/process/gl_template.go:1096` glTemplateOnlyFlags
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 73

## ดูเพิ่ม
- [[doc-transfer-request]] · [[acc-stock-special-docs]] · [[acc-inventory-stock-rebuild]] · [[doctypes-overview]]
