---
title: "วงจรชีวิตเซอร์วิสและการรัน binary เดียวหลาย OS (Service lifecycle)"
tags: [backend, go, service, windows, macos, deployment]
aliases: ["kardianos service", "windows service", "launchdaemon", "graceful shutdown", "service install", "firewall rule", "lumberjack log"]
sources: ["backend/cmd/api/main.go:58", "backend/cmd/api/main.go:111", "backend/cmd/api/main.go:151", "backend/cmd/api/firewall_windows.go:10", "backend/internal/platform/logger/logger.go:1", "backend/internal/platform/httpserver/server.go:43", "backend/docs/adr/0007-multi-os-service-deployment.md:1"]
---

# วงจรชีวิตเซอร์วิสและ binary เดียวหลาย OS

binary `cmd/api` ตัวเดียวรันได้ทั้งเป็นโปรเซสธรรมดา (container/dev) และเป็นเซอร์วิสของ Windows หรือ LaunchDaemon ของ macOS ผ่าน `kardianos/service` ตามที่ตัดสินใจไว้ใน [[adr-0007-multi-os-service-deployment]].

## ทำงานอย่างไร

1. `main()` สร้างเซอร์วิสด้วย `newService()` (`main.go:111`) — ชื่อ `bcaiaccountapi`, display name `BC Account API`.
2. ถ้า argument แรกคือ `service` → `runServiceCommand` (`main.go:151`) รับ `install | uninstall | start | stop`; ถ้าไม่ใช่ → `svc.Run()` (รันเป็นโปรแกรมหรือให้ service manager เรียก).
3. `program.Start` (`main.go:58`): `config.Load()` → `logger.New(level, logFile)` → ตั้ง swagger host/schemes → `di.Build` → `httpserver.New` → เปิด goroutine รัน `srv.Run(sigCtx, shutdown)` โดยฟังสัญญาณ `os.Interrupt`/`SIGTERM` ([[be-hexagonal-architecture]]).
4. `program.Stop` (`main.go:91`): cancel context, รอ server ปิดไม่เกิน 30 วินาที (เกินแล้วแค่ log เตือน), แล้ว `container.Close()` ปิด pool ทั้งหมด.
5. `httpserver.Run` (`server.go:43`) รันจนกว่า context ถูกยกเลิก แล้ว `Shutdown` ภายใน `SHUTDOWN_TIMEOUT_SECONDS` (default 15, [[be-config-env]]).

## ตัวเลือกของเซอร์วิส (`main.go:111-130`)

| แพลตฟอร์ม | ตัวเลือก |
|---|---|
| Windows | `StartType=automatic` (เปิดเองตอนบูต), `OnFailure=restart` (ล้มแล้วรีสตาร์ต) |
| macOS | `UserService=false` (เป็น LaunchDaemon ระดับระบบ), `RunAtLoad=true`, `KeepAlive=true` |

## Firewall และ log

- ตอน `service install` สำเร็จ โค้ดอ่านพอร์ตจาก config (ถ้า `.env` ยังไม่มีใช้ 8080) แล้วเรียก `addFirewallRule(port)` (`main.go:166-176`). บน Windows ใช้ `netsh advfirewall` ลบกฎชื่อ `BC Account API` เดิมแล้วเพิ่มกฎ inbound TCP ใหม่ (`firewall_windows.go:10-25`); OS อื่นเป็น no-op (`firewall_other.go`). ถ้าเพิ่มกฎไม่สำเร็จแค่เตือนทาง stderr ไม่ทำให้ install ล้ม.
- log เป็น JSON ด้วย zerolog; ถ้า `LOG_FILE` ตั้งไว้ จะหมุนไฟล์ด้วย lumberjack: 100 MB ต่อไฟล์, เก็บ 5 ไฟล์, อายุ 30 วัน, บีบอัด gzip (`logger.go` ส่วน `New`). ถ้าไม่ตั้ง เขียน stdout เพราะเซอร์วิสไม่มี console ([[be-config-env]]).

## ข้อควรระวัง

- พาธ `.env`, `CONFIG_DIR`, `LOG_FILE` ที่เป็นพาธสัมพัทธ์ถูกอ่านเทียบโฟลเดอร์ของ exe ก่อน — ติดตั้งเซอร์วิสแล้วต้องวางไฟล์ไว้ข้าง exe.
- `Stop` รอ 30 วินาทีแบบตายตัว ไม่ผูกกับ `SHUTDOWN_TIMEOUT_SECONDS`.
- Windows ต้องรัน `service install` ด้วยสิทธิ์ผู้ดูแล (เพราะแก้ service manager และ firewall) (อนุมาน ยังไม่ได้ลองรัน).

## ที่มาในโค้ด

- `backend/cmd/api/main.go:58-109` — `Start`/`Stop`.
- `backend/cmd/api/main.go:111-149` — ตัวเลือกเซอร์วิสและ `main`.
- `backend/cmd/api/main.go:151` — คำสั่ง `service install|uninstall|start|stop`.
- `backend/cmd/api/firewall_windows.go:10` — ชื่อกฎ firewall.
- `backend/internal/platform/logger/logger.go:1` — การหมุน log.
- `backend/internal/platform/httpserver/server.go:43` — `Run` + graceful shutdown.

## ดูเพิ่ม

[[backend-overview]] · [[be-deployment]] · [[be-config-env]] · [[adr-0007-multi-os-service-deployment]] · [[adr-index]]
