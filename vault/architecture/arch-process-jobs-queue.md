---
title: "สถาปัตยกรรมคิวประมวลผลแบบกระจาย (JobEngine, Redis Streams, Outbox & AutoScaler)"
audience: dev
tags: [architecture, process-queue, redis-streams, outbox, autoscaler, worker, concurrency]
aliases: ["JobEngine", "proc_jobs_engine", "bc_process_job", "bc_process_outbox", "procqueue AutoScaler", "Distributed Worker Daemon", "คิวประมวลผลเบื้องหลัง BC"]
sources:
  - backend/internal/application/process/proc_jobs_engine.go:1-1880
  - backend/internal/application/process/proc_jobs_gl.go:15-238
  - backend/internal/platform/procqueue/types.go:1-125
  - backend/internal/platform/procqueue/autoscaler.go:1-367
  - backend/internal/platform/procqueue/resilient_broker.go:1-26
  - backend/internal/platform/db/pool.go:148-218
  - backend/internal/adapter/inbound/http/process/jobs_handler.go:1-369
  - backend/cmd/worker/main.go:1-120
  - backend/internal/di/container.go:100-197
  - frontend/account/process/ProcessJobMonitorBar.tsx:1-198
---

ระบบประมวลผลเบื้องหลังแบบกระจาย (**Distributed Process Job Engine**) ใช้จัดการงานคำนวณขนาดใหญ่ (`stock_rebuild`, `ar_rebuild`, `ap_rebuild`, `gl_rebuild`) ให้ทำงานขนานข้าม Shard ได้อย่างปลอดภัยตามหลัก ACID โดยไม่เบียดบัง Connection Pool ของผู้ใช้หน้าเว็บ

---

## 1. โครงสร้างตาราง PostgreSQL ต่อบริษัท (`ProcessJobDDL` ใน `pool.go:148-218`)

ทุกฐานข้อมูลบริษัทจะมี 3 ตารางหลักพร้อม Materialized Balance Columns บน `ar_customer` และ `ap_supplier` (`debt_balance`, `chq_balance`, `bill_balance` ชนิด `NUMERIC(18,2) DEFAULT 0`):

| ตาราง | Primary Key / Index สำคัญ | หน้าที่ |
| :--- | :--- | :--- |
| **`bc_process_job`** | PK `job_id`, Index `(status, created_at DESC)`, Partial Index `idempotency_key` | เก็บสถานะงาน (`queued`, `running`, `completed`, `failed`, `cancelled`), `priority`, `parent_job_id`, `chain_next_json`, ความคืบหน้า (`total_shards`, `completed_shards`, `failed_shards`, `total_items`, `processed_items`), `workers_used`, `result_json` |
| **`bc_process_job_shard`** | PK `(job_id, shard_index)`, FK `ON DELETE CASCADE`, Index `(job_id, status)` | เก็บงานย่อยระดับ Entity Batch (`shard_key`, `status`, `attempts`, `items_count`, `rows_updated`, `payload_json`, `result_json`, `worker_id`) |
| **`bc_process_outbox`** | PK `id BIGSERIAL`, Partial Index `(status, id) WHERE status = 'pending'` | Transactional Outbox สำหรับ `enqueue_job` และ `party_balance_sync` เพื่อกันเหตุการณ์หายหาก Redis ขัดข้อง |

---

## 2. Transactional Outbox, Coalescing & Redis Streams (`proc_jobs_engine.go`)

1. **Durable Enqueue (`EnqueueJob`, `insertJobAndOutboxTx`)**:
   - บันทึก `bc_process_job` + `bc_process_outbox` (`event_type = 'enqueue_job'`) ภายใน **PostgreSQL Transaction เดียวกัน** (ตรวจ `idempotency_key` ที่ยัง `queued`/`running` เพื่อกันซ้ำก่อนสร้าง `JOB-YYYYMMDD-XXXXXXXX`)
   - หลัง `COMMIT` แล้วค่อยเรียก `flushOutboxSafe` ส่งคำสั่งเข้า Broker (`CommandStream`) พร้อมแคชสถานะใน Redis Hash (`SetJobState`) และกระจาย Event ผ่าน Pub/Sub (`queued`)
2. **Party Balance Coalescing (`recordPartyBalanceOutboxTx`, `flushOutbox`)**:
   - เมื่อบันทึกเอกสารที่มี `trans_flag` ฝั่งลูกหนี้/เจ้าหนี้ ระบบเขียน `event_type = 'party_balance_sync'` ลง `bc_process_outbox` ในธุรกรรมเดียวกัน
   - `flushOutbox` ดึงแถวค้างด้วย `FOR UPDATE SKIP LOCKED` (ครั้งละ `LIMIT 100`) แล้วรวมรหัสคู่ค้าที่ซ้ำกันใน Phase 1 ให้เป็น `ar_rebuild` / `ap_rebuild` 1 งานต่อฝั่งพร้อม `COMMIT` ก่อน แล้วจึง Publish เข้า Redis Streams ใน Phase 2 (ป้องกัน Worker ตื่นมาแล้วเจอ `pgx.ErrNoRows`)
3. **Worker Daemon & Crash Recovery (`StartWorker`, `cmd/worker/main.go`)**:
   - `NewResilientBroker` เชื่อมต่อ **Redis Streams + Pub/Sub** (`mode = "redis"`) และสลับเป็น **`memory_fallback`** อัตโนมัติเมื่อไม่ได้ตั้ง `REDIS_URL` หรือ Redis ล่ม (`di/container.go:192-195` จะรัน Embedded Worker ใน API ทันที)
   - `cmd/worker/main.go` รันบริการ `bcaiaccountworker` คอยอ่านกลุ่ม `XREADGROUP`, กู้คืนงานค้างที่ไม่มี Ack เกิน `90s` ทุก `30s` ด้วย `ClaimStale` (`XAUTOCLAIM`), ส่ง Heartbeat สถานะเครื่องขึ้น Redis ทุก `2s` และรองรับ Cancel ข้ามโปรเซสผ่าน Redis Pub/Sub

---

## 3. Adaptive Sharding, Entity Locks & AutoScaler (`autoscaler.go`, `proc_jobs_engine.go:791-1455`)

- **Deterministic Sharding (`PlanEntityShards`)**: ถ้ามีรายการ `<= 100` แตก 1 ชิ้นต่อ 1 Shard เพื่อกระจายขนานเต็มที่ หาก `> 100` จัดกลุ่มเป็น Micro-batch ไม่เกิน `maxShards` (`200` สำหรับ Stock/AR/AP และ `150` สำหรับ GL) และ resume เฉพาะ shard ที่ `status <> 'completed'` ได้ทันทีเมื่อ worker รีสตาร์ต
- **3-Layer Concurrency & ACID Barrier**:
  1. **Distributed Entity Lock (`acquireShardEntityLocks`)**: ขอ Lock ระดับ Entity ตามลำดับตัวอักษร (`stock:<CODE>`, `ar:<CODE>`, `ap:<CODE>`, `gl:<DOC>:<FLAG>`, `stock_action:<ACT>`) TTL `120s` ก่อนหยิบ DB Slot เพื่อไม่ให้ Shard ที่ชนกันไปรอค้างใน PostgreSQL Connection Pool
  2. **Server-Aware `AutoScaler` + `DynamicGate`**: สุ่มวัด CPU/RAM (`gopsutil`) และ PostgreSQL Pool ทุก `1.5s` โดยสงวน Pool ไว้ให้ HTTP หน้าเว็บ `DBReserveRatio = 0.35` (35%) พร้อมวงจร **AIMD** ลดจำนวน Worker ลงครึ่งหนึ่งเมื่อ latency เฉลี่ย `> 2000ms` หรือเกิด DB contention (`40P01`, `40001`, `55P03`) และค่อยๆ คืนค่าเมื่อทำเร็ว `< 400ms` ต่อเนื่อง 5 ครั้ง
  3. **Atomic Shard Commit & Retry (`executeShardWithRetry`, `executeShardOnce`)**: ล็อกแถว `bc_process_job_shard ... FOR UPDATE OF s`, รันด้วย `*big.Rat` (เช่น `aggDebt`, `aggChq`, `aggBill` สำหรับ AR/AP), Retry สูงสุด `3` ครั้งเมื่อเจอ PG deadlock/serialization แล้วอัปเดต `completed_shards` / `processed_items` ใน Commit เดียวกับผลลัพธ์
- **Auto-Chaining (`finalizeJob`)**: หาก `stock_rebuild` สำเร็จและ `erp_option.inventory_gl_post == 1` (`autoChainGl` ไม่เป็น false) ระบบจะแตกงานลูก `gl_rebuild` สำหรับเอกสารที่ต้นทุนเปลี่ยน (`changedDocs`) และ `chainNext` ทั้งหมดใน Transaction เดียวก่อน Commit
- **GL Micro-Batch Shards & Deadlock-Free Locking (`proc_jobs_gl.go:49-239`)**:
  - `buildGLRebuildDocsQuery` / `resolveGLRebuildDocsTx` รวบรวมเอกสารงวดบัญชีเปิด (`erp_account_period.status = 0` และไม่ทับใบสำคัญคีย์มือ `gl_journal.trans_direct = 1`) ครบทั้ง **6 แหล่ง** (`ic_trans` ปกติ, `ap_ar_trans` `19/239`, `ic_trans` template-only เช่น `72`, `as_trans` `1802`, ใบยกเลิก `ic_trans` และใบยกเลิก `ap_ar_trans`)
  - `rebuildGLShardTx` ล็อกลำดับเดียวกับ `lockTransDoc`: ล็อก per-document `pg_advisory_xact_lock(hashtext('ic_trans:<docNo>:<transFlag>'))` เรียงลำดับ hash ก่อนแล้วจึงขอ `lockGLShared` ทำให้การบันทึก POS/ขายเอกสารอื่นทำงานขนานได้โดยไม่ถูกบล็อก
  - ก่อน Commit ตรวจ **Double-Entry Invariant** (`SUM(debit) == SUM(credit)`) ด้วย `*big.Rat` (`RoundHalfUp` 2 ตำแหน่ง) ครบทุกเอกสารใน Shard หากไม่สมดุลจะ Rollback ทันที

---

## 4. API, SSE Streaming & Frontend Monitor (`jobs_handler.go`, `ProcessJobMonitorBar.tsx`)

- **HTTP & SSE Endpoints (`/process/jobs/*`)**:
  - `POST /process/jobs/enqueue` (และ `async: true` บน `/process/stock/rebuild`, `/process/gl/rebuild`, `/process/ar/rebuild`, `/process/ap/rebuild`) คืน `202 Accepted` พร้อม `JobSnapshot`
  - `GET /process/jobs`, `GET /process/jobs/health`, `GET /process/jobs/{jobId}`, `POST /process/jobs/{jobId}/cancel`
  - `GET /process/jobs/events` และ `GET /process/jobs/{jobId}/events` ปิด `WriteDeadline` บน `http.ResponseController` เพื่อสตรีม SSE (`event: job`, keepalive ทุก `15s`) โดย Subscribe Redis Pub/Sub ก่อนโหลด Snapshot แรกเพื่อไม่ให้ตกหล่น Event
- **Frontend (`ProcessJobMonitorBar.tsx`)**: แสดงป้ายสถานะ `Redis Worker พร้อมทำงาน` หรือ `โหมดประมวลผลขนานในเครื่อง`, จำนวนเทรดแนะนำ (`recommendedConcurrency / maxConcurrency`), `% CPU`, `DB Pool` และปุ่มหยุดงานกลางคัน

---

## ดูต่อที่เกี่ยวข้อง
- [[exposes_api::api-process-engine]] — สเปก Endpoint `/process/jobs/*` และ Workflow Dispatcher
- [[part_of_arch::arch-multi-tenant-di]] — การแยก Pool รายบริษัทและ Dependency Injection (`di/container.go`)
- [[part_of_arch::arch-overview]] — ภาพรวมสถาปัตยกรรม 4 ชั้นของ BC Ai Account
