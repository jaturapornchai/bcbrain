---
title: สเปก HTTP Inbound Endpoints ครบทุกหมวด (/process/*, /workflow/*, /stocktools/*, /print-audit/* และ Domain Modules)
tags: [api, rest, process, workflow, stocktools, print-audit, router]
aliases: [workflow_handler, stocktools_handler, print_audit_handler, transgrid_handler, public_bill_handler, router.go]
sources:
  - backend/internal/adapter/inbound/http/router.go:1-384
  - backend/internal/adapter/inbound/http/process/workflow_handler.go:1-505
  - backend/internal/adapter/inbound/http/process/stocktools_handler.go:1-197
  - backend/internal/adapter/inbound/http/process/print_audit_handler.go:1-162
  - backend/internal/adapter/inbound/http/process/transgrid_handler.go:1-89
  - backend/internal/adapter/inbound/http/process/barcode_handler.go:1-89
  - backend/internal/adapter/inbound/http/process/permission.go:1-423
---

# สเปก HTTP Inbound Endpoints ครบทุกหมวด (`/process/*`, `/workflow/*`, `/stocktools/*`, `/print-audit/*`)

แผนผัง HTTP Routes ทั้งหมดที่ลงทะเบียนใน `backend/internal/adapter/inbound/http/router.go` ภายใต้การตรวจสิทธิ์ `RequireRight` (`process/permission.go`) และ `edition_guard.go` (รองรับทั้ง prefix `/process/...` และ `/api/v1/process/...`)

---

## 1. Core Process, Grid, Barcode & Print Audit Routes

| Endpoint Pattern | Actions / Sub-routes ทั้งหมด |
|---|---|
| `POST /process/{domain}` | `/stock/rebuild`, `/gl/rebuild`, `/gl/template-defaults`, `/gl/recurring`, `/gl/reconcile-subledger`, `/trans/save`, `/trans/delete`, `/doc/save`, `/doc/delete`, `/doc/cancel`, `/doc/approve`, `/doc/bills`, `/doc/flow`, `/trans/deposits`, `/trans/party-defaults`, `/cheque/rebuild`, `/cheque/candidates`, `/tax/rebuild`, `/tax/tourist-vat-refund` |
| `POST /process/lookup/{action}` | `party-filter`, `ref-doc-filter`, `wh-filter`, `wh-pick-check`, `wh-perm-filter` |
| `POST /process/transgrid/{action}` | `line`, `formula`, `totals`, `shortcut`, `priceinfo`, `fx`, `refimport` |
| `POST /process/barcode/{action}` | `item`, `save`, `discount-load`, `discount-save`, `ean13-check`, `ean13-generate`, `ean13-apply`, `print-items`, `format` |
| `POST /process/stocktools/{action}` | `formats`, `barcodecheck`, `serialanalyze`, `serialscan`, `serialcountsave`, `lotamountload`, `lotamountsave`, `hiddencostcalc`, `hiddencostsave`, `hiddencostdelete`, `lotautolist`, `lotautocheck`, `lotautorun`, `notcountedlist`, `notcountedrun`, `itemnextcode`, `stockbeginningsave`, `stockbeginningdelete`, `docnonext`, `checkpricesave`, `pointdocsave`, `pointdocdelete`, `itemsaved` |
| `POST /process/master/{action}` | `nextcode`, `codeleave`, `assetdepdefaults`, `datalistget`, `datalistsave`, `recordlock`, `seeddocformats`, `seedpresets` |
| `POST /process/print-audit/{action}` | `record`, `list`, `detail`, `verify-chain` + `GET /process/print-audit/pdf` |
| `POST /process/{media}` | `/modifyprice/{preview,apply}`, `/docpicture/{formats,docs,get,save}`, `GET /docpicture/image`, `/itempicture/{list,get,save}`, `GET /itempicture/image`, `/itemdetail/{get,save}`, `/itemmaster/{save,delete}` |
| `GET\|POST /public/bill-pay/{token}` | ลิงก์ใบแจ้งหนี้สาธารณะ ดึงยอดค้าง + PromptPay QR และรับอัปโหลดสลิปโอนเงินโดยไม่ต้องใช้ session พนักงาน |

---

## 2. รายชื่อ `POST /process/workflow/{action}` ครบทั้ง 57 Actions

- **บัญชี ภาษี และปิดงบ**: `journal-list`, `journal-pass`, `gl-check`, `gl-close`, `fx-revaluation`, `tax-health`, `rd-prep-wht`, `foreign-service-tax`, `corporate-tax-pnd50`, `dbd-efiling`, `etax-ewht`, `prepaid-amort`
- **สินทรัพย์ สต็อก และการผลิต**: `fa-depreciation`, `asset-sale`, `check-ic-trans`, `fifo-allocate`, `bom-assembly`, `consignment`, `stock-expiry-fefo`, `serial-warranty-rma`
- **ลูกหนี้ เจ้าหนี้ การเงิน และร้านค้าออนไลน์**: `ar-contract`, `ap-contract`, `ar-auto-bill`, `ap-auto-bill`, `credit-group`, `sales-commission`, `public-bill-link`, `slip-verify`, `bank-statement-reconcile`, `marketplace-reconcile`, `cashflow-forecast`, `hire-purchase`
- **SME Pack & Collaboration**: `payroll-sso-pnd1`, `expense-claim`, `project-retention`, `director-loan`, `budget-approval`, `ocr-three-way`, `morning-briefing`, `line-expense-inbox`, `accountant-chaser`, `mobile-quick-bill`, `tax-id-lookup`
- **AI Copilot & บำรุงรักษาระบบ**: `ai-report-sql`, `ai-report-analyze`, `ai-bank-reconcile`, `ai-audit-copilot`, `ai-smart-reorder`, `ai-auto-gl`, `change-code`, `audit-list`, `point-recal`, `import-transport-label`, `province-list`, `province-load`, `feature-options`, `resolve-doc`

---

## 3. Domain Add-on Endpoints (`/api/v1/*`)

- **CRM**: `GET /api/v1/crm/{overview,activities,image}`, `POST /api/v1/crm/{action,activities,upload}` (`CREATE_DEAL`, `ADVANCE_DEAL_STAGE`, `LOG_PROMISE_TO_PAY`, `SEND_DUNNING_LINE`, `VERIFY_WHT_CERT`, `SEND_OMNI_REPLY`, `CONVERT_CHAT_TO_DEAL`, `LAUNCH_CAMPAIGN`, `BROADCAST_CAMPAIGN`)
- **POS**: `POST /api/v1/pos/shift`, `GET /api/v1/pos/{sync,restore,bootstrap,devices,image}`, `POST /api/v1/pos/{bills,media,config,devices/{machine}/pair,bills/reprocess}`
- **WMS / TMS / Procure / Market / e-Tax / AutoCare / Dashboard / MonitorMap / Help**: ดูรายละเอียดเสริมที่ [[api-rest-ops-ext]] และ [[api-overview]]

---

## ดูต่อที่เกี่ยวข้อง
- [[exposes_api::api-overview]] · [[exposes_api::api-process-engine]] · [[exposes_api::api-rest-ops-ext]]
- [[posts_rule::doc-price-engine-ref-import-calc]] · [[posts_rule::doc-marketplace-payroll-dbd-evrt]]
