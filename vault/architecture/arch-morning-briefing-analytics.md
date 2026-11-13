---
title: "สถาปัตยกรรม Morning Briefing, ResolveDoc & Executive Analytics"
audience: dev
tags: [architecture, morning-briefing, drilldown, dashboard, monitormap]
aliases: ["Morning Briefing BC", "ResolveDocMenu", "MonitorMap Tile Cache", "Executive Dashboard Architecture"]
sources: ["backend/internal/application/process/morning_briefing.go:42-1548", "backend/internal/adapter/inbound/http/dashboard/handler.go:40-315", "backend/internal/adapter/inbound/http/monitormap/handler.go:33-516", "backend/internal/application/process/report_drilldown.go:46-399"]
---

ระบบสรุปงานบริหารและการเจาะลึก (Drill-Down) ของ **BC Ai Account** ทำงานบน Backend-First Pipeline เพื่อให้นักบัญชีและผู้บริหารเปิดดูงานด่วนและกดคลิกจากรายงานหรือการ์ด KPI เข้าสู่หน้าจอเอกสารต้นทางได้แม่นยำ

---

## 1. Morning Action Briefing (`POST /process/workflow/morning-briefing`)

Engine ใน `morning_briefing.go:227-1065` คิวรีข้อมูลสด 6 หมวดหมู่หลักพร้อมจัดโควตาแยกหมวดและแปลงปี พ.ศ./ค.ศ. ตาม `erp_option.year_type`:

| Category Key | แหล่งข้อมูล & เงื่อนไขคิวรีจริง |
| :--- | :--- |
| `AR_OVERDUE` | ลูกหนี้ค้างชำระ (`ic_trans` `trans_flag = 44`) ที่ `COALESCE(due_date, credit_date, doc_date) <= asOfDate` |
| `AUTO_BILL` | บิลขายเชื่อคงค้างที่พร้อมนำไปออกใบวางบิลรวมอัตโนมัติ |
| `AP_DUE` | เจ้าหนี้ (`trans_flag = 12`) ที่ครบกำหนดภายใน 7 วันข้างหน้าหรือเลยกำหนดแล้ว |
| `CHEQUE_DUE` | เช็ครับ/จ่ายใน `cb_chq_list` ที่ `status NOT IN (2, 7, 8)` และ `chq_due_date <= asOfDate + 7 days` |
| `LOW_STOCK` | สินค้าคงเหลือต่ำกว่าจุดสั่งซื้อจาก `ic_inventory` / `ic_inventory_detail` (`purchase_point` / `minimum_qty`) |
| `PENDING_APPROVAL` | ใบขอซื้อ (`trans_flag = 2`) และใบสั่งซื้อ (`trans_flag = 6`) รออนุมัติ + สลิปโอนเงินที่ลูกค้าอัปโหลดผ่านลิงก์วางบิลสาธารณะใน `ar_public_bill_link` (`status = 'SLIP_SUBMITTED'`) |

---

## 2. `ResolveDocMenu` — 2-Hop Document & Master Drill-Down (`morning_briefing.go:1127-1548`)

รองรับคำสั่ง `POST /process/workflow/resolve-doc` เมื่อผู้ใช้คลิกเลขที่เอกสารหรือรหัสในรายงาน/Dashboard/Company Brain ระบบจะค้นหาแบบ Multi-Layer 2 ขั้น:

1. **Workflow Extension Tables (`workflowDocRoutes`, 19 ตาราง)**:
   - ตรวจจากรหัสนำหน้าหรือคิวรีในตารางส่วนเสริม เช่น `ap_contract` (`APC-`), `ar_contract` (`ARC-`), `cb_expense_claim` (`EXP-`), `ar_marketplace_settlement` (`MKT-`), `ar_ap_retention_ledger` (`RET-`), `gl_fx_revaluation` (`FXR-`), `ar_commission_run` (`COM-`), `ic_assembly_order` (`ASM-`/`BOM-`), `ic_warranty_rma_ticket` (`RMA-`), `ic_writeoff_petition` (`WOF-`/`LOT-`/`PAW79-`), `erp_approval_request` (`APR-`/`BDG-`), `erp_etax_ewht_batch` (`EWHT-`), `cb_bank_reconcile_batch` (`BRC-`), `erp_payroll_run` (`PAY-`), `gl_foreign_tax_voucher` (`FTX-`), `gl_director_loan_ledger` (`DLN-`), `gl_corporate_tax_workpaper` (`PND50-`/`PND51-`), `gl_prepaid_schedule` (`AMR-`), `fa_hire_purchase_contract` (`HP-`)
   - รวมถึงการแกะรหัส GL ชนิด `JV-...` กลับไปหาเอกสาร Workflow ต้นทาง (`glLinkedMatch`)
2. **Core ERP Tables (2-Hop Resolution)**:
   - ค้นใน `ic_trans`, `ap_ar_trans`, `cb_trans`, `as_trans`, `cb_chq_list`, `gl_journal` และถ้าเจอกลุ่มใบสำคัญที่มาจากเอกสารต้นทาง ระบบจะติดตาม `attachSourceRef` ไปให้ด้วย
   - หากไม่พบเลขที่เอกสาร และส่ง Context คอลัมน์มา (เช่น `customer`, `supplier`, `item`, `account`, `passbook`, `warehouse` จาก `report_drilldown.go`) จะ route ไปยังหน้าจอ Master Record นั้นทันที

---

## 3. Executive Dashboard & MonitorMap Tile Cache

- **Unified Dashboard (`GET /api/v1/dashboard/overview`, `dashboard/handler.go:40-315`)**: รวม `KpiSummary`, กราฟคู่รายได้-ค่าใช้จ่าย (`DualChartPoint`), `DonutSlice`, สินค้าขายดี (`RaceBarItem`), ความเสี่ยง (`RiskRadarRow`), และ `DocPipelineRow` จากข้อมูลจริงข้ามโมดูล
- **MonitorMap 3-Tier Map Tile Cache (`monitormap/handler.go:127-516`)**:
  - ให้บริการ Map Tiles 3 Layer: `sat`, `trans`, `places`
  - **กลไกแคช 3 ชั้น**: RAM Cache -> Local Disk Cache -> PostgreSQL (`monitormap_tile_cache`) ลด latency และป้องกัน rate-limit จาก Upstream
  - เปิดเส้นทาง `GET /api/v1/monitormap/tile` แบบไม่บังคับ Bearer เพื่อให้ Browser โหลดแผนที่ได้ลื่น ส่วน `POST /api/v1/monitormap/tile` (`PrewarmTiles`) บังคับ JWT Auth เพื่อควบคุมงาน background prewarm
  - Projection & Fleet Tracking เก็บใน `monitormap_hub_nodes`, `monitormap_customer_nodes`, `monitormap_fleet_missions`, `monitormap_live_events`, `monitormap_kpi_projection` และ `monitormap_sme_alerts`
