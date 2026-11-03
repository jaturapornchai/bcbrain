---
title: "erp_credit_approved_logs / erp_credit_request — ขออนุมัติเครดิต"
tags: [tables, erp, credit, approval, company-db]
aliases: ["erp_credit_approved_logs", "erp_credit_request", "อนุมัติเครดิต", "เกินวงเงิน", "credit_status", "approve_status"]
sources: ["backend/internal/application/process/trans_credit.go:203", "backend/internal/application/process/trans_credit.go:204", "backend/internal/application/process/trans_save_rules.go:576", "backend/internal/application/process/doc_flow.go:70", "backend/internal/application/process/doc_flow.go:290"]
---

# erp_credit_approved_logs และ erp_credit_request

คู่ตารางของขั้นตอน "เอกสารขายเครดิตเกินวงเงิน → ขออนุมัติ → อนุมัติ" (Company DB) ตารางเดิม (legacy) ไม่มี DDL ในโค้ด

## erp_credit_request — คำขออนุมัติเครดิต
เขียนใน trans_credit.go:204-210 ตอนเอกสารถูกพักเพราะเกินเครดิต (ลบแล้ว INSERT ใหม่พร้อม log):
| คอลัมน์ | ความหมายตามชื่อ/การใช้ |
|---|---|
| `doc_no`, `trans_flag` | เลขที่/ชนิดเอกสารที่ขอ |
| `credit_money`, `credit_money_max` | วงเงินเครดิต/วงเงินสูงสุด |
| `chq_amount` | ยอดเช็คค้าง |
| `advance_amount` | ยอดมัดจำ/เงินรับล่วงหน้า |
| `ar_balance_amount` | ยอดลูกหนี้คงค้าง |
| `sr_amount`, `ss_amount` | ยอดใบสั่งจอง/ใบสั่งขาย (ตามชื่อย่อ SR/SS) |
| `bill_amount` | ยอดบิลนี้ |
| `over_amount`, `over_percent` | ยอด/เปอร์เซ็นต์ที่เกินวงเงิน |
| `credit_status` | สถานะคำขอ (ความหมายค่า ไม่ชัดจากโค้ดที่อ่าน) |

อ่านกลับ: trans_save_rules.go:576-591

## erp_credit_approved_logs — บันทึกการอนุมัติ
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `doc_no`, `trans_flag` | เอกสารที่อนุมัติ | doc_flow.go:70, 290 |
| `approve_status` | สถานะอนุมัติ (ค่าไม่ชัดจากโค้ด) | doc_flow.go:70, 290 |

- โค้ดนี้ **อ่าน** (doc_flow.go:70, 290) และ **ลบ** (trans_credit.go:203) เท่านั้น — **ไม่พบ INSERT ใน Go** แถวถูกเขียนจากที่อื่น (เช่นโปรแกรมเดิมที่ผู้อนุมัติใช้) (ไม่ชัดจากโค้ด)

## ผู้อนุมัติ
`erp_user.approve_ar_credit` ([[tbl-erp-user]]) + รหัสผ่านอนุมัติตาม `erp_option.password_ar_credit` / `request_ar_credit` ([[tbl-erp-option]])

## ลิงก์
[[acc-transaction-save-flow]] · [[proc-doc-cancel-approve]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans_credit.go:203`
- `backend/internal/application/process/trans_credit.go:204`
- `backend/internal/application/process/trans_save_rules.go:576`
- `backend/internal/application/process/doc_flow.go:70`
- `backend/internal/application/process/doc_flow.go:290`
