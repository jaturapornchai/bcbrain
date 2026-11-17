---
title: สถาปัตยกรรมเชิงลึก Company Brain Microservice (Two-Stage Executor, .rl Graph, 5-Channel Evidence Fusion & Read-Only SQL Guard)
tags: [architecture, company-brain, graphrag, rrf-fusion, hybrid-llm, postgresql]
aliases: [TwoStageBrainExecutor, evidenceFusionEngine, multiHypothesisSearch, thaiAccountingContext, brainSqlQueryRunner, PgPoolManager]
sources:
  - services/company-brain/src/server.ts:1-536
  - services/company-brain/src/executor.ts:1-4818
  - services/company-brain/src/brainManager.ts:1-1987
  - services/company-brain/src/evidenceFusionEngine.ts:1-1364
  - services/company-brain/src/multiHypothesisSearch.ts:1-1918
  - services/company-brain/src/brainSqlQueryRunner.ts:1-1065
  - services/company-brain/src/pgPoolManager.ts:1-258
  - services/company-brain/src/decimal.ts:1-122
---

# สถาปัตยกรรมเชิงลึก Company Brain Microservice (`services/company-brain/src/**`)

บริการ `company-brain` (พอร์ตภายใน `127.0.0.1:18095`, เรียกผ่าน Proxy `backend/internal/adapter/inbound/http/companybrain/handler.go` ที่ล้าง `X-BC-*` จากภายนอกแล้วฉีด `X-BC-Tenant-DB` ที่ตรวจสิทธิ์แล้วเท่านั้น) ทำหน้าที่เป็นสมองวิเคราะห์ข้อมูลจริงรายบริษัทแบบ Read-Only 100%

---

## 1. Per-Tenant Graph Lifecycle & Strict Decimal/Read-Only Guard

- **`BrainManager` (`brainManager.ts`)**: บริหารกราฟฝังตัว `.rl` แยกตามฐานข้อมูลลูกค้า (`maxActiveBrains = 40` แบบ LRU, ซ่อมตัวเองอัตโนมัติเมื่อสคีมาเปลี่ยนหรือไฟล์เสียหาย) พร้อม Embedding 256 มิติ (`embeddingEngine.ts`) และตัวเรียนรู้คำพ้องชื่อสินค้า/คู่ค้า (`aliasEnricher.ts`)
- **`PgPoolManager` (`pgPoolManager.ts`) & `decimal.ts`**:
  - บังคับ `default_transaction_read_only = on`, `statement_timeout = 1500ms`, และ `enforceReadOnlyBoundedSql` (`LIMIT <= 50`)
  - ดึง PostgreSQL OID `1700` (`NUMERIC`) และ OID `1082` (`DATE`) เป็น `string` เสมอ แล้วคำนวณด้วย `BigInt` ทศนิยมคงที่ 6 ตำแหน่งใน `decimal.ts` (ไม่ใช้ binary float)

---

## 2. ไปป์ไลน์วิเคราะห์คำถาม 2 ระยะ (`TwoStageBrainExecutor.executeAsk`)

1. **Stage 1 — Cross-Lingual Intent & Entity Resolution (`executor.ts`, `thaiAccountingContext.ts`, `thaiNumberFilter.ts`, `thaiEnglishResolver.ts`)**:
   - แปลงวันที่ พ.ศ./ค.ศ. ช่วงไตรมาส/งวดบัญชี เงื่อนไขตัวเลขไทย (เช่น *"เกินแสน"*, *"ยอด 12,500"*) และแก้คำพิมพ์สลับแป้นพิมพ์ไทย–อังกฤษ (Kedmanee ↔ QWERTY)
   - จำแนกเจตนาคำถามออกเป็น 12 บริบท (`stock_ranking`, `top_selling_items`, `customer_ranking`, `supplier_ranking`, `ar_ap_outstanding`, `tax_vat`, `gl_balance`, `document_lookup`, `entity_search`, `multi_hypothesis_lookup`, `system_knowledge`, `executive_overview`)
2. **Stage 2 — Parallel Live Evidence + System Brain MCP + 5-Channel RRF Fusion**:
   - รัน `collectLivePostgresEvidence` (รวม `multiHypothesisSearch.ts` ค้นหลายสมมติฐานพร้อมกันเมื่อถามเลขยอดเงินหรือคำเฉพาะ) ขนานกับ `systemBrainMcpClient.ts` + `brainSqlQueryRunner.ts`
   - รวมหลักฐานทั้ง **5 ช่องทาง** ใน `evidenceFusionEngine.ts` ด้วย Reciprocal Rank Fusion (`brain_graph_alias`, `exact_sql_probes`, `deep_text_clues`, `contextual_enrichment`, `system_brain_mcp`)
   - สตรีม HTML (`brainContextHtml.ts`) ผ่าน SSE ทันที แล้วสังเคราะห์บทสรุปผ่าน `HybridLlmClient` (Local GPU → Cloud Fallback พร้อม Circuit Breaker) ที่ตรวจความสอดคล้องของตัวเลขก่อนส่งออก และบันทึกผลตรวจตัวเองใน `brainAuditLogger.ts`

---

## ดูต่อที่เกี่ยวข้อง
- [[part_of_arch::arch-company-brain-ai]] · [[part_of_arch::arch-overview]]
- [[exposes_api::api-mcp-gateway]] · [[exposes_api::api-inbound-handlers-workflows]]
