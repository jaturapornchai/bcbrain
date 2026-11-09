---
title: ภาพรวมรายงานทั้งหมดของระบบบัญชี
tags: [report, overview]
aliases:
  - รายงานมีอะไรบ้าง
  - อยากดูรายงาน
  - รายงานอยู่เมนูไหน
  - รวมรายงานทั้งหมด
  - หารายงานไม่เจอ
  - รายงานที่ใช้บ่อย
sources:
  - backend/internal/application/process/report_menu_ic.go:340
  - backend/internal/application/process/report_menu_ap_ar.go:563
  - backend/internal/application/process/report_menu_gl_fa_tb.go:6
  - frontend/account/report/UniversalReportScreen.tsx:2339
---

# ภาพรวมรายงานทั้งหมดของระบบบัญชี

รายงานทุกตัวใช้หน้าจอรูปแบบเดียวกัน: เลือกเงื่อนไข กด "ประมวลผลรายงาน" แล้วพิมพ์หรือส่งออกได้ วิธีใช้ตัวกรองดู [[rpt-run-filters]] วิธีพิมพ์และส่งออกดู [[rpt-print-export]]

## รายงานที่ถูกถามบ่อย
- ลูกหนี้ค้างชำระ/อายุหนี้: [[rpt-ar-aging]]
- สินค้าคงเหลือ: [[rpt-ic-stock-balance]]
- กำไรขั้นต้น: [[rpt-ic-gross-profit]]
- ยอดขายสรุป: [[rpt-so-sales-summary]]
- งบทดลองและงบการเงิน: [[rpt-gl-trial-balance]] [[rpt-gl-financial-statements]]

## สินค้าและคลัง
[[rpt-ic-stock-balance]] · [[rpt-ic-item-info]] · [[rpt-ic-stock-docs]] · [[rpt-ic-status-control]] · [[rpt-ic-movement-reorder]] · [[rpt-ic-gross-profit]] · [[rpt-ic-cancel-docs]]

## ซื้อ
[[rpt-po-pr-po]] · [[rpt-po-deposit-advance]] · [[rpt-po-purchase-docs]] · [[rpt-po-purchase-summary]] · [[rpt-po-purchase-analysis]] · [[rpt-po-cancel-docs]]

## ขาย
[[rpt-so-quote-order]] · [[rpt-so-deposit-advance]] · [[rpt-so-sales-docs]] · [[rpt-so-sales-summary]] · [[rpt-so-sales-analysis]] · [[rpt-so-cancel-docs]]

## เจ้าหนี้
[[rpt-ap-master-opening]] · [[rpt-ap-bill-payment]] · [[rpt-ap-outstanding]] · [[rpt-ap-aging]] · [[rpt-ap-cancel-docs]]

## ลูกหนี้
[[rpt-ar-master-opening]] · [[rpt-ar-bill-receipt]] · [[rpt-ar-outstanding-credit]] · [[rpt-ar-aging]] · [[rpt-ar-cancel-docs]]

## เงินสดและธนาคาร
[[rpt-cb-cash-petty]] · [[rpt-cb-bank-credit-card]] · [[rpt-cb-cheque-receive]] · [[rpt-cb-cheque-pay]] · [[rpt-cb-cancel-docs]]

## สินทรัพย์
[[rpt-asset-reports]]

## บัญชีแยกประเภทและงบการเงิน
[[rpt-gl-ledger-journal]] · [[rpt-gl-trial-balance]] · [[rpt-gl-financial-statements]]

## รายงานอื่น ๆ
[[rpt-other-custom]]

## รายงานภาษีมูลค่าเพิ่มและภาษีหัก ณ ที่จ่าย
ดู [[howto-tax-overview]]

## ปัญหาที่พบบ่อย
[[ts-rpt-no-data]] · [[ts-rpt-no-cost-permission]] · [[ts-rpt-numbers-mismatch]] · [[ts-rpt-slow-too-big]] · [[ts-rpt-export-fail]] · [[ts-rpt-pdf-fail]]

## คำถามที่พบบ่อย
[[faq-rpt-cancelled-docs]] · [[faq-rpt-ar-vs-ledger]] · [[faq-rpt-stock-vs-value]] · [[faq-rpt-save-template]]

## ดูต่อ
[[index]] · [[playbook-call-center]] · [[sys-account-overview]]
