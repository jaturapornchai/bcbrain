---
title: "ADR-0007 binary เดียวรันเป็น Windows Service / macOS LaunchDaemon / container"
tags: [backend, adr, deployment, windows-service]
aliases: ["ADR 0007", "kardianos service", "service install", "LaunchDaemon", "Windows Service"]
sources: ["backend/docs/adr/0007-multi-os-service-deployment.md:7", "backend/cmd/api/main.go:111", "backend/cmd/api/main.go:150", "backend/internal/platform/config/config.go:65", "backend/internal/platform/config/config.go:80"]
---

# ADR-0007 binary เดียว หลายรูปแบบการรัน

สถานะ: **accepted** (ตรงกับโค้ด). ใช้ `github.com/kardianos/service` ให้ binary เดียวมี subcommand `service install|uninstall|start|stop` แทนการห่อด้วย NSSM / plist เขียนมือ; ถ้าไม่ใส่ subcommand พฤติกรรมเหมือนเดิม (`go run ./cmd/api`, Docker `ENTRYPOINT`, `go test`) — `backend/docs/adr/0007-multi-os-service-deployment.md:7`.

## ทำงานอย่างไร

1. `main()` เรียก `runServiceCommand` เมื่อมี subcommand `service ...` ไม่งั้นรันเซิร์ฟเวอร์ตามปกติ (`main.go:132-189`).
2. ตัวเลือกบริการ: Windows `StartType: automatic` + `OnFailure: restart`; macOS `UserService: false` (LaunchDaemon ระบบ), `RunAtLoad: true`, `KeepAlive: true` (`main.go:116-127`).
3. ปัญหา working dir ของ service (Windows = `System32`, macOS = `/`) แก้โดย `config` หาไฟล์ `.env`, `CONFIG_DIR`, `LOG_FILE` เทียบกับ **โฟลเดอร์ของ exe ก่อน** แล้วค่อย fallback เป็นเทียบ CWD (`config.go:65-110`).
4. Windows: `service install` เพิ่มกฎ firewall inbound ให้ `HTTP_PORT` เอง (`cmd/api/firewall_windows.go:10-27`); macOS ไม่มี (`firewall_other.go`).

## ตัวเลือกที่ไม่เลือก

- NSSM + launchd plist: ต้องดูแล 2 เครื่องมือภายนอก ไม่มี UX install/uninstall ร่วมกัน.
- Code signing / notarization: เลื่อนไว้ (ไม่มี cert) — macOS ต้องล้าง quarantine เองหรือ build ในเครื่อง.

## ข้อควรระวัง

- วาง binary + `configs/` + `.env` ไว้โฟลเดอร์เดียวกัน (ตัวอย่างใน ADR: `C:\BCAccountAPI\` / `/opt/bcaccountapi/`); แยกที่กันแล้วจะ resolve ผิด (`...0007...md:20`).
- `service uninstall` ไม่ลบ `configs/`, `.env`, `logs/` (`...0007...md:11`).
- ใน `go run` "exe" คือไฟล์ build ชั่วคราว จึงต้อง fallback เป็น CWD (`...0007...md:9`).

## ที่มาในโค้ด

- `backend/cmd/api/main.go:111` — `newService` (ตัวเลือกต่อ OS).
- `backend/cmd/api/main.go:150` — `runServiceCommand`.
- `backend/internal/platform/config/config.go:65` — `executableDir`; `:80` — `resolvePath`.
- `backend/docs/adr/0007-multi-os-service-deployment.md:20` — ผลที่ตามมาเรื่องที่วางไฟล์.

## ดูเพิ่ม

[[be-service-lifecycle]] · [[be-deployment]] · [[be-config-env]] · [[adr-index]]
