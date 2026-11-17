// vault top-level folder → Thai label + pastel neuron colour + audience zone (shared by server pages, MCP and 3D client)
export type Audience = "user" | "dev" | "both";
export type AudienceFilter = "all" | "user" | "dev";

export type GroupMeta = {
  label: string;
  color: string;
  audience: Audience;
};

export const GROUPS: Record<string, GroupMeta> = {
  root: { label: "แกนกลาง", color: "#ffffff", audience: "both" },
  playbook: { label: "คู่มือ AI ผู้ช่วยตอบลูกค้า", color: "#ffe27a", audience: "user" },
  start: { label: "เริ่มต้นใช้งาน", color: "#7cc8ff", audience: "user" },
  howto: { label: "วิธีทำทีละขั้น", color: "#7ef0c8", audience: "user" },
  troubleshoot: { label: "แก้ปัญหา", color: "#ff6f91", audience: "user" },
  faq: { label: "ถาม-ตอบ", color: "#fff3a0", audience: "user" },
  reports: { label: "รายงาน", color: "#5ee0f0", audience: "user" },
  systems: { label: "ระบบงานในชุด BC", color: "#6ee77a", audience: "user" },
  glossary: { label: "คำศัพท์", color: "#f7c6ff", audience: "user" },
  sales: { label: "ข้อมูลการขาย", color: "#ffb68a", audience: "user" },
  "dev-playbook": { label: "คู่มือ AI นักพัฒนา", color: "#c4a7ff", audience: "dev" },
  schema: { label: "โครงสร้างตาราง (Schema)", color: "#95abff", audience: "dev" },
  queries: { label: "คลังคำสั่ง SQL", color: "#b8f566", audience: "dev" },
  api: { label: "สเปก API และ MCP", color: "#ff96d2", audience: "dev" },
  doctypes: { label: "รหัสเอกสารและผังบัญชี", color: "#ff9393", audience: "dev" },
  architecture: { label: "สถาปัตยกรรมระบบ", color: "#68d8d6", audience: "dev" },
};

export const GROUP_ORDER = Object.keys(GROUPS);

export const ZONE_LABEL: Record<Audience, string> = {
  user: "ผู้ใช้ทั่วไป",
  dev: "นักพัฒนา",
  both: "แกนกลาง",
};

export const MODE_OPTIONS: readonly [AudienceFilter, string][] = [
  ["all", "ทั้งหมด"],
  ["user", "ผู้ใช้ทั่วไป"],
  ["dev", "นักพัฒนา (Dev)"],
];

export const groupOf = (folder: string): GroupMeta =>
  GROUPS[folder] ?? { label: folder, color: "#c9d1ff", audience: "user" };

export function matchesAudience(aud: Audience, filter: AudienceFilter = "all"): boolean {
  return filter === "all" || aud === "both" || aud === filter;
}

export function normalizeAudienceFilter(value?: string | null): AudienceFilter {
  return value === "user" || value === "dev" ? value : "all";
}

export const RELATION_TYPES = [
  "uses_table",
  "writes_table",
  "posts_rule",
  "has_query",
  "exposes_api",
  "follows_rule",
  "part_of_arch",
  "solves_issue",
  "explains_term",
  "has_report",
  "guides_howto",
  "in_system",
  "answers_faq",
  "shares_menu",
  "implements_code",
  "bridges_zone",
  "hub_map",
  "related",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_LABEL: Record<RelationType, string> = {
  uses_table: "ใช้ตาราง",
  writes_table: "บันทึกตาราง",
  posts_rule: "รหัสเอกสาร/ผังบัญชี",
  has_query: "ตัวอย่าง SQL",
  exposes_api: "สเปก API",
  follows_rule: "กติกาหลัก",
  part_of_arch: "สถาปัตยกรรม",
  solves_issue: "แก้ปัญหา",
  explains_term: "คำศัพท์",
  has_report: "รายงาน",
  guides_howto: "วิธีทำ",
  in_system: "ระบบงาน",
  answers_faq: "ถาม-ตอบ",
  shares_menu: "รหัสเมนูเดียวกัน",
  implements_code: "ใช้โค้ดชุดเดียวกัน",
  bridges_zone: "เชื่อมหน้าจอ-โค้ด",
  hub_map: "แผนที่หลัก",
  related: "เชื่อมโยง",
};

const RELATION_SET = new Set<string>(RELATION_TYPES);
export const isRelationType = (v: string): v is RelationType => RELATION_SET.has(v);

export function inferRelation(fromFolder: string, toFolder: string): RelationType {
  if (fromFolder === "root" || toFolder === "root") return "hub_map";
  if (toFolder === "schema") return fromFolder === "doctypes" ? "writes_table" : "uses_table";
  if (toFolder === "doctypes") return "posts_rule";
  if (toFolder === "queries") return "has_query";
  if (toFolder === "api") return "exposes_api";
  if (toFolder === "dev-playbook" || toFolder === "playbook") return "follows_rule";
  if (toFolder === "architecture") return "part_of_arch";
  if (toFolder === "troubleshoot") return "solves_issue";
  if (toFolder === "glossary") return "explains_term";
  if (toFolder === "reports") return "has_report";
  if (toFolder === "howto" || toFolder === "start") return "guides_howto";
  if (toFolder === "systems") return "in_system";
  if (toFolder === "faq" || toFolder === "sales") return "answers_faq";
  return "related";
}
