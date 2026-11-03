---
title: "ตัวแปรสภาพแวดล้อมและการโหลด config ของ backend (Environment config)"
tags: [backend, config, env, go]
aliases: ["env", "environment variables", "config.go", "env.example", "CONFIG_DIR", "ตัวแปร env", ".env"]
sources: ["backend/internal/platform/config/config.go:17", "backend/internal/platform/config/config.go:96", "backend/env.example:1", "backend/internal/platform/httpserver/server.go:24", "backend/internal/di/container.go:79", "backend/internal/adapter/inbound/http/crm/minio.go:42"]
---

# ตัวแปรสภาพแวดล้อมและการโหลด config

backend อ่านค่าตั้งผ่าน env ด้วยไลบรารี `caarlos0/env` ลงใน struct `Config` และโหลดไฟล์ `.env` ด้วย `godotenv` ก่อน. หมายเหตุความปลอดภัย: โน้ตนี้เก็บ **เฉพาะชื่อตัวแปร** — ค่าจริงของกุญแจ/รหัสผ่านต้องตั้งผ่าน env เท่านั้น ห้ามบันทึกลงเอกสาร.

## ทำงานอย่างไร

1. `config.Load()` (`config.go:96`) หา "โฟลเดอร์ของ exe" (`executableDir`, `:64`) แล้ว resolve พาธ `.env` เทียบกับโฟลเดอร์นั้นก่อน, ถ้าไม่เจอจึงเทียบกับ CWD (`resolvePath`, `:80`) — ทำให้ `go run ./cmd/api` ยังใช้ได้คู่กับเซอร์วิสที่ติดตั้งจริง.
2. `godotenv.Load` — ไฟล์ `.env` ไม่มีไม่ถือว่าผิด (`errors.Is(err, os.ErrNotExist)` ถูกข้าม).
3. `env.Parse(&cfg)` เติมค่าตาม tag `env:"..." envDefault:"..."`.
4. `ConfigDir` และ `LogFile` ถูก resolve เป็นพาธเทียบ exe อีกรอบ (`config.go:96` ถึงท้ายฟังก์ชัน).

## ตัวแปรใน `Config` (`config.go:17-56`)

| ตัวแปร | ค่า default | หน้าที่ |
|---|---|---|
| `APP_ENV` | `development` | โหมดรัน; `development` เปิด `/swagger/*` ([[be-http-router-routes]]) |
| `HTTP_PORT` | `8080` | พอร์ต HTTP |
| `LOG_LEVEL` | `info` | ระดับ log (debug/info/warn/error) |
| `CONFIG_DIR` | `configs` | โฟลเดอร์ `providerlist.json` + `BCConfig<CODE>.json` ([[be-provider-registry]]) |
| `LOG_FILE` | ว่าง | ถ้าตั้ง = เขียน log ลงไฟล์หมุนเวียน; ว่าง = stdout ([[be-service-lifecycle]]) |
| `ADMIN_API_KEY` | ว่าง | กุญแจของ `AdminAuth` header `X-Admin-Api-Key`; ว่าง = ปฏิเสธทุกคำขอ |
| `JWT_SIGNING_KEY` | ว่าง | กุญแจเซ็น JWT; ว่าง = login/verify ล้มเหลวแบบ fail-closed ([[be-jwt-session-tokens]]) |
| `PRE_AUTH_TOKEN_TTL_MINUTES` | `5` | อายุ pre-auth token |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | อายุ access token |
| `REFRESH_TOKEN_TTL_HOURS` | `168` | อายุ refresh token |
| `SHUTDOWN_TIMEOUT_SECONDS` | `15` | เวลารอปิด HTTP server แบบ graceful |
| `HOST_NAME` | ว่าง | ค่า host ที่ swagger-ui ใช้ยิง "Try it out" |
| `SWAGGER_SCHEMES` | `http,https` | scheme ที่ swagger-ui เสนอ (คั่นด้วย `,`) |

## ตัวแปรที่อ่านนอก `Config` (os.Getenv ตรง ๆ)

- `HTTP_BIND_HOST` — host ที่ bind; ถ้าว่างและ `APP_ENV` ว่างหรือ `development` จะ bind loopback เท่านั้น (ฝั่ง Docker ภายนอกเข้าไม่ได้) นอกนั้น bind ทุก interface (`httpserver/server.go:24-30`).
- `REVOCATION_STORE_FILE` — ไฟล์เก็บรายการ session ที่ถูกเพิกถอน; default `<CONFIG_DIR>/revoked_sessions.json` (`di/container.go:79-82`).
- MinIO/S3 (อ่านใน `crm/minio.go:42-46` ผ่าน `firstEnv`): `S3_ENDPOINT` (หรือ `R2_ENDPOINT`), `S3_BUCKET_NAME` (หรือ `R2_BUCKET_NAME`, default `bcaiaccount`), `S3_ACCESS_KEY_ID` (หรือ `R2_ACCESS_KEY_ID`), `S3_SECRET_ACCESS_KEY` (หรือ `R2_SECRET_ACCESS_KEY`), `S3_REGION` (default `us-east-1`) ([[be-blob-insert]]).
- `BC_TILE_CACHE_DIR` — โฟลเดอร์แคช tile ของ monitormap (`monitormap/handler.go:86`).
- `DEEPSEEK_API_KEY` — โมดูล AI chat (`ai/handler.go:761`) (ยังไม่ได้อ่านการใช้งานลึก).

## ข้อควรระวัง

- `env.example` มีเฉพาะ `APP_ENV, HTTP_PORT, LOG_LEVEL, CONFIG_DIR, SHUTDOWN_TIMEOUT_SECONDS, LOG_FILE, ADMIN_API_KEY, JWT_SIGNING_KEY, PRE_AUTH_TOKEN_TTL_MINUTES, ACCESS_TOKEN_TTL_MINUTES, REFRESH_TOKEN_TTL_HOURS, HOST_NAME, SWAGGER_SCHEMES` (`env.example:1-31`) — ไม่มี `HTTP_BIND_HOST`, `REVOCATION_STORE_FILE`, ตัวแปร S3/MinIO; ต้องรู้จากโค้ด.
- K8s ConfigMap ตั้ง `APP_ENV=production` และ `CONFIG_DIR=configs`; `ADMIN_API_KEY`/`JWT_SIGNING_KEY` อยู่ใน Secret ([[be-deployment]]).
- docker-compose ตั้ง `APP_ENV=development` โดยไม่ตั้ง `HTTP_BIND_HOST` → ตามกติกา bind loopback ในคอนเทนเนอร์ อาจทำให้ publish พอร์ต 8080 เข้าไม่ถึง (อนุมานจากโค้ด `server.go:24-30` ยังไม่ได้ลองรันจริง).
- ห้ามตั้ง `ADMIN_API_KEY`/`JWT_SIGNING_KEY` เป็นค่าจริงในไฟล์ที่ commit (ใช้ env หรือ Secret).

## ที่มาในโค้ด

- `backend/internal/platform/config/config.go:17-56` — struct `Config` และ tag env.
- `backend/internal/platform/config/config.go:96` — `Load`.
- `backend/env.example:1-31` — รายชื่อตัวแปรที่เอกสารไว้ (ชื่อเท่านั้น).
- `backend/internal/platform/httpserver/server.go:24-30` — กติกา bind host.
- `backend/internal/di/container.go:79` — `REVOCATION_STORE_FILE`.
- `backend/internal/adapter/inbound/http/crm/minio.go:42` — ตัวแปร S3.

## ดูเพิ่ม

[[backend-overview]] · [[be-service-lifecycle]] · [[be-deployment]] · [[be-jwt-session-tokens]] · [[adr-index]]
