---
title: "ภาพรวมประเภทเอกสาร (Document Types Overview)"
tags: [doctypes, purchase, sale, inventory, ap, ar, cash-bank, gl, asset]
aliases: ["doctypes", "ประเภทเอกสาร", "รายการเอกสารทั้งหมด", "trans_flag overview"]
sources: ["backend/internal/application/process/service.go:1742", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/stock_rebuild.go:33", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/doc_cancel.go:49", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/doc_flow.go:91", "backend/internal/application/process/period.go:128", "backend/internal/application/process/doc_flow_graph.go:193"]
---

# ภาพรวมประเภทเอกสาร

หน้ารวมการ์ดเอกสาร 60 ใบ จัดกลุ่มตามโมดูล ความหมายของ flag ทั้งหมดดูที่ [[acc-trans-flag-map]]

**วิธีอ่านตาราง**
- **สต็อก**: เข้า/ออก ตาม `stockRowsSQL` (stock_rebuild.go:18), `stockValueOnlySQL` (:26) และ `stockAdjustQtyPredicate` (:33)
- **VAT**: ซื้อ/ขาย ตาม `transVatTabs` (trans_tax.go:37) และ `apArTaxTabs` (:53) ส่วน "−" หมายถึง vat_calc −1
- **GL**: ✓ คือ flag ที่อยู่ใน `glRebuildTransFlags` (service.go:1742) และลง standard GL ([[acc-gl-posting-standard]]) ส่วน "template" คือ `glTemplateOnlyFlags` (gl_template.go:1096) ลง GL เฉพาะเมื่อรูปแบบเอกสารมีรายการลงบัญชี; 1801/1802 ไม่อยู่ในชุดนี้แต่สร้าง GL เองตอนบันทึก ดู [[acc-fixed-asset-depreciation]] · [[acc-fixed-asset-sale]]

## จัดซื้อ (purchase)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-purchase-requisition]] | 2 (อนุมัติ 4) | — | — | — |
| [[doc-purchase-order]] | 6 (อนุมัติ 8) | — | — | — |
| [[doc-purchase-advance-payment]] | 9010/10/20 | — | — | ✓ เฉพาะ 10/20 |
| [[doc-purchase-deposit-payment]] | 9011/11/25 | — | ซื้อ (11) / ซื้อ − (25) | ✓ เฉพาะ 11/25 |
| [[doc-purchase-invoice]] | 12 | เข้า | ซื้อ | ✓ |
| [[doc-purchase-partial-receive]] | 310 | เข้า | — | ✓ |
| [[doc-purchase-partial-invoice]] | 315 | — | ซื้อ | ✓ |
| [[doc-purchase-return]] | 16 | ออก (inquiry 1/3 ลงแต่มูลค่า) | ซื้อ − | ✓ |
| [[doc-purchase-partial-return]] | 311 | ออก (inquiry 1/3 ลงแต่มูลค่า) | — | ✓ |
| [[doc-purchase-partial-credit-note]] | 317 | — | ซื้อ − | ✓ |
| [[doc-purchase-debit-note]] | 14 | เข้า (inquiry 1/3 ลงแต่มูลค่า) | ซื้อ | ✓ |
| [[doc-purchase-partial-debit-note]] | 316 | — | ซื้อ | ✓ |

## ขาย (sale)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-sale-quotation]] | 30 (อนุมัติ 32) | — | — | — |
| [[doc-sale-reservation]] | 34 (อนุมัติ 38) | — | — | — |
| [[doc-sale-order]] | 36 (อนุมัติ 52) | — | — | — |
| [[doc-sale-advance-receipt]] | 9040/40/42 | — | — | ✓ เฉพาะ 40/42 |
| [[doc-sale-deposit-receipt]] | 9110/110/112 | — | ขาย (110) / ขาย − (112) | ✓ เฉพาะ 110/112 |
| [[doc-sale-invoice]] | 44/144 | ออก (เฉพาะ 44) | ขาย | ✓ |
| [[doc-sale-return]] | 48 | เข้า (inquiry 0/1) | ขาย − | ✓ |
| [[doc-sale-debit-note]] | 46/50 | ออก (เฉพาะ 46 inquiry 0) | ขาย (46) | ✓ |

## สินค้าคงคลัง (inventory)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-stock-beginning-balance]] | 54 | เข้า | — | แท็บ GL (คีย์เอง) |
| [[doc-finished-goods-receive]] | 60 | เข้า | — | ✓ |
| [[doc-issue-request]] | 122 | — | — | — |
| [[doc-stock-issue]] | 56 | ออก | — | ✓ |
| [[doc-issue-return]] | 58 | เข้า | — | ✓ |
| [[doc-transfer-request]] | 124 | — | — | — |
| [[doc-stock-transfer]] | 72/70 | ออก/เข้า | — | template |
| [[doc-stock-count-request]] | 276/128 | — | — | — |
| [[doc-stock-count]] | 76 | — | — | — |
| [[doc-stock-adjust-increase]] | 66 | เข้า/ออก ตามเครื่องหมาย qty | — | ✓ |
| [[doc-stock-adjust-decrease]] | 68 | ออก | — | ✓ |

## เจ้าหนี้ (ap)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-ap-beginning-balance]] | 81/83/85 | — | — | — |
| [[doc-ap-other-debt]] | 87 | — | ซื้อ | ✓ |
| [[doc-ap-other-debit-credit-note]] | 89/91 | — | ซื้อ (91 −) | ✓ |
| [[doc-ap-billing-receive]] | 213 | — | — | — |
| [[doc-ap-payment]] | 19 | — | ซื้อ (กรอกเอง) | ✓ |

## ลูกหนี้ (ar)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-ar-beginning-balance]] | 93/95/97 | — | — | — |
| [[doc-ar-other-debt]] | 99 | — | ขาย | ✓ |
| [[doc-ar-other-debit-credit-note]] | 101/103 | — | ขาย (103 −) | ✓ |
| [[doc-ar-billing]] | 235 | — | — | — |
| [[doc-ar-receipt]] | 239 | — | ขาย (กรอกเอง) | ✓ |
| [[doc-ar-point]] | 801/802 | — | — | — |

## เงินสด/ธนาคาร (cash-bank)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-other-income]] | 250 | — | ขาย | ✓ |
| [[doc-other-income-adjust]] | 252/254 | — | ขาย (252 −) | ✓ |
| [[doc-other-expense]] | 260 | — | ซื้อ | ✓ |
| [[doc-other-expense-adjust]] | 262/264 | — | ซื้อ (262 −) | ✓ |
| [[doc-petty-cash]] | 300/301 | — | — | ✓ |
| [[doc-cash-bank-beginning]] | 602/604 | — | — | — |
| [[doc-bank-deposit-withdraw]] | 401/402 | — | — | ✓ |
| [[doc-bank-transfer]] | 422/420 | — | — | ✓ เฉพาะ 422 |
| [[doc-cheque-received-balance]] | 405 | — | — | — |
| [[doc-cheque-received-lifecycle]] | 410–418 | — | — | ✓ |
| [[doc-cheque-paid-balance]] | 406 | — | — | — |
| [[doc-cheque-paid-lifecycle]] | 451/452/453/456 | — | — | ✓ |
| [[doc-credit-card]] | 461/462 | — | ซื้อ (461) | ✓ |
| [[doc-wallet-pass]] | 463 | — | — | ✓ |
| [[doc-cheque-register]] | cb_chq_list | — | — | — |

## บัญชีแยกประเภท (gl)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-gl-journal]] | 0/1999 | — | แท็บ VAT/WHT | กรอกเอง |

## สินทรัพย์ (asset)
| เอกสาร | trans_flag | สต็อก | VAT | GL |
|---|---|---|---|---|
| [[doc-asset-sale]] | 1802 | — | ขาย | ✓ |
| [[doc-asset-depreciation-transfer]] | 1801 | — | — | ✓ |

## flag ที่ไม่มีการ์ด
- 521–523 (คลังรับฝาก: ฝาก/เบิก/รับคืนจากเบิก ตาม comment period.go:126) อยู่ใน `periodExemptFlags` (period.go:128) และ `stockRowsSQL` (stock_rebuild.go:18) แต่ไม่พบเมนูหรือหน้าจอ
- 62/64 อยู่ใน `stockRowsSQL` แต่ไม่พบเมนู

## ข้อควรระวัง: ชื่อในตาราง label
ชื่อใน `doc_flow_graph.go` บางบรรทัดไม่ตรงกับเมนู
- 54 "รับสินค้าสำเร็จรูป" (doc_flow_graph.go:193)
- 60 "โอนสินค้าออก" (:196)
- 62 "โอนสินค้ารับเข้า" (:197)
- 66 "สินค้าคงเหลือยกมา" (:198)
- 68 "ปรับปรุงสต๊อกเกิน/ขาด" (:199)

ตารางนี้ยังใช้ flag ยกเลิก 160–163 แทน 41/111/43/113, ใช้ 21 แทน 23 และใช้ 153 แทน 152 ซึ่งต่างจาก `cancelOrigFlags` (doc_cancel.go:49)

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1742` glRebuildTransFlags
- `backend/internal/application/process/gl_template.go:1096` glTemplateOnlyFlags
- `backend/internal/application/process/stock_rebuild.go:18` / `:26` / `:33` เงื่อนไขสต็อก
- `backend/internal/application/process/trans_tax.go:37` / `:53` แท็บ VAT
- `backend/internal/application/process/doc_cancel.go:49` / `:66` คู่ยกเลิก/อนุมัติ
- `backend/internal/application/process/doc_flow.go:91` flowRules
- `backend/internal/application/process/period.go:128` periodExemptFlags
- `backend/internal/application/process/doc_flow_graph.go:193` ตาราง label

## ดูเพิ่ม
- [[acc-trans-flag-map]] · [[proc-doc-cancel-approve]] · [[proc-doc-flow-numbering]] · [[acc-gl-posting-standard]] · [[acc-transaction-save-flow]] · [[acc-transaction-delete-edit]] · [[acc-vat-register-wht]] · [[acc-inventory-cost-moving-average]]
