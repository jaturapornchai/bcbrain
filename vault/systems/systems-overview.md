---
title: "ระบบงานในชุด BC — ภาพรวม 15 ระบบและเครื่องมือทีมพัฒนา (Systems Overview)"
tags: [systems, moc]
aliases: ["ระบบทั้งหมด", "ระบบในชุด", "ระบบในชุด BC", "ระบบอะไรบ้าง", "ระบบย่อย", "system portal", "SYS-01", "หน้ารวมระบบ", "workspace hub"]
sources: ["frontend/shared/layout/SystemPortalScreen.tsx:91", "frontend/shared/layout/SystemPortalScreen.tsx:347"]
---
# ระบบงานในชุด BC Ai Account

หลังล็อกอินและเลือกฐานข้อมูล ผู้ใช้จะเห็น **หน้ารวมระบบ** (`SystemPortalScreen`) เป็นการ์ด 15 ระบบ รหัส `SYS-01` ถึง `SYS-15` กดการ์ดแล้วไปที่ path ของระบบนั้น ทุกระบบใช้ session และฐานข้อมูลบริษัทเดียวกับระบบบัญชี

| รหัส | ระบบ | path | เริ่มอ่านที่ |
|---|---|---|---|
| SYS-01 | BC Account บัญชีและ ERP | `/home?system=account` | [[index]] (กลุ่มบัญชี หน้าจอ ตาราง) |
| SYS-02 | POS ขายหน้าร้าน | `/pos` | [[sys-pos-overview]] |
| SYS-03 | AutoCare ศูนย์บริการรถยนต์ | `/autocare` | [[sys-autocare-overview]] |
| SYS-04 | e-Tax ใบกำกับภาษีอิเล็กทรอนิกส์ | `/etax` | [[sys-etax-overview]] |
| SYS-05 | Procure จัดซื้อ | `/procure` | [[sys-procure-overview]] |
| SYS-06 | WMS คลังสินค้า | `/wms` | [[sys-wms-overview]] |
| SYS-07 | TMS ขนส่ง | `/tms` | [[sys-tms-overview]] |
| SYS-08 | Market ร้านค้าส่งออนไลน์ B2B | `/market` | [[sys-market-overview]] |
| SYS-09 | Dashboard ผู้บริหาร | `/dashboard` | [[sys-dashboard-overview]] |
| SYS-10 | CRM ลูกค้าสัมพันธ์ | `/crm` | [[sys-crm-overview]] |
| SYS-11 | LINE OA แชทลูกค้า | `/lineoa` | [[sys-lineoa-overview]] |
| SYS-12 | AI Copilot | `/ai` | [[sys-ai-overview]] |
| SYS-13 | MonitorMap แผนที่ธุรกรรม 3D | `/monitormap` | [[sys-monitormap-overview]] |
| SYS-14 | WorkMonitor จอพนักงาน 3D | `/workmonitor` | [[sys-workmonitor-overview]] |
| SYS-15 | FraudWarning เฝ้าระวังทุจริต 3D | `/fraudwarning` | [[sys-fraudwarning-overview]] |

## เครื่องมือของทีมพัฒนา (ไม่อยู่บนหน้ารวมระบบ)
- [[sys-uat-overview]] — บอททดสอบอัตโนมัติและ Chaos Lab
- [[sys-tests-overview]] — ชุดทดสอบ e2e, Playwright, Go test
- [[sys-scripts-overview]] — สคริปต์ deploy สร้างฐานข้อมูล และตัวเฝ้า ticket
- [[sys-video-overview]] — งานทำวิดีโอสาธิตระบบ

## ที่มาในโค้ด
- `frontend/shared/layout/SystemPortalScreen.tsx:91-347` — รายการการ์ด `SYS-01`…`SYS-15` พร้อม `href` ของแต่ละระบบ
- ดูเพิ่ม: [[index]] · [[std-platform-google-login-pdpa-hub]]
