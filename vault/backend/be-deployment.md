---
title: "การ build และ deploy backend: Docker, Kubernetes, Makefile (Deployment)"
tags: [backend, deployment, docker, kubernetes, makefile]
aliases: ["dockerfile", "docker-compose", "k8s", "kubernetes manifest", "makefile", "build-all", "health probe", "deploy backend"]
sources: ["backend/deployments/docker/Dockerfile:1", "backend/deployments/docker/docker-compose.yml:1", "backend/deployments/k8s/deployment.yaml:11", "backend/Makefile:3", "backend/go.mod:3"]
---

# การ build และ deploy backend

สรุป: backend build เป็น binary เดียว (`./cmd/api`) แล้ว deploy ได้ 3 ทาง — คอนเทนเนอร์ (Dockerfile / docker-compose / K8s), เซอร์วิส Windows, หรือ LaunchDaemon macOS ([[be-service-lifecycle]]). ADR ที่เกี่ยวข้อง: [[adr-0007-multi-os-service-deployment]].

## ทำงานอย่างไร

1. **Makefile** (`Makefile:3-41`): `build` = `go build ./...`; `build-all` = cross-compile `windows/amd64` (.exe), `darwin/amd64`, `darwin/arm64`, `linux/amd64` ลง `dist/`; `run` = `go run ./cmd/api`; `test` = `go test ./...`; `test-integration` = `go test -tags=integration ./test/...` (ใช้ testcontainers + Docker); `vet`; `lint` = `golangci-lint run ./...`; `tidy`; `swagger` = `swag init -g cmd/api/main.go -o docs --parseInternal` (CI ไม่รัน ต้อง commit ไฟล์ที่สร้างเอง).
2. **Dockerfile** (`Dockerfile:1-14`): multi-stage — build ด้วย `golang:1.25-alpine` (`CGO_ENABLED=0 GOOS=linux`) แล้วคัดลอกไป `distroless/static-debian12:nonroot`, ผู้ใช้ `nonroot`, `EXPOSE 8080`, `ENTRYPOINT ["/api"]`.
3. **docker-compose** (`docker-compose.yml`): บริการ `api` (build จาก Dockerfile, พอร์ต 8080, ตั้ง `APP_ENV=development`, `HTTP_PORT`, `LOG_LEVEL`) + `postgres:16-alpine` สำหรับ dev พร้อม volume `pgdata`.
4. **Kubernetes** (`deployments/k8s/`):
   - `deployment.yaml`: `replicas: 2`, อิมเมจ placeholder, `envFrom` ConfigMap `bcaiaccountapi-config` + Secret `bcaiaccountapi-secrets`, liveness/readiness ชี้ `/health` พอร์ต 8080 (initialDelay 5 วินาที, period 15 และ 10 วินาที), requests cpu 100m/mem 64Mi, limits cpu 500m/mem 256Mi.
   - `configmap.yaml`: `APP_ENV=production`, `HTTP_PORT`, `LOG_LEVEL`, `CONFIG_DIR=configs`, `SHUTDOWN_TIMEOUT_SECONDS`, TTL ของ token; ตั้งใจไม่ตั้ง `LOG_FILE` (ให้ log ออก stdout).
   - `secret.example.yaml`: ตัวอย่างสำหรับ `ADMIN_API_KEY` และ `JWT_SIGNING_KEY` (ค่าเป็น placeholder).
   - `service.yaml`: Service port 8080 → targetPort 8080.
5. **Health**: `GET /health` ตอบ `{"status":"ok"}` เป็น liveness เท่านั้น ไม่ ping DB (`ops/health.go:24`); manifest เองก็ใช้เป็น readiness ชั่วคราว.

## ข้อควรระวัง

- Dockerfile ใช้ Go 1.25 แต่ `go.mod` ระบุ `go 1.26.0` (`go.mod:3`) — build อิมเมจนี้อาจล้ม หรือดึง toolchain เพิ่ม (ยังไม่ยืนยัน ไม่ได้รัน build).
- runtime image ไม่มีโฟลเดอร์ `configs/` และ manifest K8s ไม่ mount volume ให้ `CONFIG_DIR` → registry ผู้เช่า (`providerlist.json`) จะอยู่บน filesystem ของ pod เอง; ผู้ใช้ `nonroot` อาจเขียนพาธนั้นไม่ได้ (ยังไม่ยืนยัน). ดู [[be-provider-registry]].
- `replicas: 2` ขัดกับข้อสมมติ "instance เดียว" ของ registry แบบไฟล์ ([[adr-0001-provider-config-json-files]]): ผู้เช่าที่ลงทะเบียนที่ pod หนึ่งอาจไม่ปรากฏที่อีก pod.
- ใน compose การตั้ง `APP_ENV=development` โดยไม่ตั้ง `HTTP_BIND_HOST` ทำให้ bind loopback ในคอนเทนเนอร์ ([[be-config-env]]) (อนุมาน ยังไม่ได้ลองรัน).
- `/swagger/*` เปิดเฉพาะ `APP_ENV=development`; production ให้ 404 ([[be-http-router-routes]]).

## ที่มาในโค้ด

- `backend/Makefile:3-41` — เป้าหมาย build/test/lint/swagger.
- `backend/deployments/docker/Dockerfile:1-14` — multi-stage build.
- `backend/deployments/docker/docker-compose.yml:1-27` — api + postgres dev.
- `backend/deployments/k8s/deployment.yaml:11-52` — replica, probe, resource.
- `backend/deployments/k8s/configmap.yaml:7-18` — env ที่ไม่ลับ.
- `backend/internal/adapter/inbound/http/ops/health.go:24` — `/health`.

## ดูเพิ่ม

[[backend-overview]] · [[be-service-lifecycle]] · [[be-config-env]] · [[be-provider-registry]] · [[adr-index]]
