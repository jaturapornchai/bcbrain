// Export pre-processed BC Brain knowledge pack for the compiled Go MCP sidecar (cmd/bcbrain-mcp).
// Strictly READ-ONLY on vault/ and never touches D:/bcaiaccount.
// Usage: node scripts/export-go-pack.mjs [outputPath]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Locate fallback node_modules from NODE_PATH or git common root when running inside a git worktree
const fallbackParentURLs = [];
if (process.env.NODE_PATH) {
  for (const dir of process.env.NODE_PATH.split(path.delimiter).filter(Boolean)) {
    const base = path.basename(dir) === "node_modules" ? path.dirname(dir) : dir;
    if (fs.existsSync(path.join(base, "node_modules"))) {
      fallbackParentURLs.push(pathToFileURL(path.join(base, "package.json")).href);
    }
  }
}
if (!fs.existsSync(path.join(process.cwd(), "node_modules"))) {
  try {
    const commonDir = execFileSync("git", ["--no-optional-locks", "rev-parse", "--git-common-dir"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const repoRoot = path.resolve(process.cwd(), commonDir, "..");
    if (fs.existsSync(path.join(repoRoot, "node_modules"))) {
      fallbackParentURLs.push(pathToFileURL(path.join(repoRoot, "package.json")).href);
    }
  } catch {
    // ignore
  }
}

// Allow Node 22/24 native TS execution to resolve extensionless relative imports used by Next.js / tsconfig
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (fallbackParentURLs.length && !specifier.startsWith(".") && !specifier.startsWith("node:") && !specifier.startsWith("file:")) {
        for (const parentURL of fallbackParentURLs) {
          try {
            return nextResolve(specifier, { ...context, parentURL });
          } catch {
            // try next fallback
          }
        }
      }
      throw err;
    }
  },
});

// Load SYNC_COMMIT / BUILD_TIME from public/sync-meta.json if not already set in env
if (!process.env.SYNC_COMMIT) {
  try {
    const metaPath = path.join(process.cwd(), "public", "sync-meta.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (meta.sourceCommit) process.env.SYNC_COMMIT = String(meta.sourceCommit).slice(0, 12);
      if (meta.syncedAt && !process.env.BUILD_TIME) process.env.BUILD_TIME = String(meta.syncedAt);
    }
  } catch {
    // optional
  }
}

const vaultMod = await import("../lib/vault.ts");
const retrievalMod = await import("../lib/vault-retrieval.ts");
const openApiMod = await import("../lib/openapi.ts");
const {
  getBootstrapPack,
  getNoteFacts,
  getNoteTldr,
  getVaultPackGzip,
  stripSeeAlso,
  syncCommit,
  updatedAt,
  vault,
  vaultFolders,
  warmVaultIndexes,
} = vaultMod;
const { buildErrorIndex } = retrievalMod;
const { getOpenApiSpec } = openApiMod;

const t0 = performance.now();
warmVaultIndexes();

// ---------- Exact text normalizer & tokenizer parity with lib/vault.ts ----------
const normalizeText = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ภ\.ง\.ด\.\s*(\d+)/g, "ภงด$1")
    .replace(/ภ\.พ\.\s*(\d+)/g, "ภพ$1")
    .replace(/สต๊อก/g, "สต็อก")
    .replace(/ล๊อก/g, "ล็อก")
    .replace(/แพ็คเกจ/g, "แพ็กเกจ")
    .replace(/พ\.ศ\./g, "พศ")
    .replace(/ค\.ศ\./g, "คศ")
    .replace(/เครม/g, "เคลม")
    .replace(/\be-tax\b/g, "etax")
    .replace(/\be-wht\b/g, "ewht")
    .replace(/\be-filing\b/g, "efiling")
    .replace(/\be-pod\b/g, "epod")
    .replace(/\b3-way\b/g, "3way")
    .replace(/\b(ctrl|alt|shift)\s*\+\s*([a-z0-9]+)\b/g, "$1_$2");

const STOP_WORDS =
  "คือ อะไร ยังไง อย่างไร ไหม มั้ย หรือ และ ที่ ของ การ ความ ใน ให้ ได้ มี เป็น จะ ว่า กับ แล้ว บ้าง ช่วย หน่อย ครับ ค่ะ คะ นะ เรา ผม the a an of to is are how what in on and or for does do with".split(
    " ",
  );
const STOP = new Set(STOP_WORDS);
const THAI_WORD = /^[\u0E00-\u0E7F]+$/;
const THAI_OR_THAI_NUM = /^[\u0E00-\u0E7F]+\d*$/;
const NEEDS_GLUE_PREV = /(?:[เแโใไ็]|ั)$/;
const NEEDS_GLUE_CUR = /(?:^[่้๊๋ัิีึืุู็์]|^[\u0E01-\u0E2E]\u0E4C?$|^[\u0E01-\u0E2E]{1,2}\u0E4C$)/;
const MIXED_SCRIPT = /(?=.*[\u0E00-\u0E7F])(?=.*[a-z])/;
const segmenter = new Intl.Segmenter("th", { granularity: "word" });

const SYNONYM_GROUPS = [
  ["สต็อก", "สินค้าคงเหลือ", "คงเหลือ", "คลัง", "ic_inventory", "ic_trans_detail"],
  ["คลัง", "คลังสินค้า", "wh_code", "ic_warehouse"],
  ["ที่เก็บ", "ชั้นวาง", "ชั้น", "shelf_code", "ic_shelf"],
  ["ลูกหนี้", "ลูกค้า", "ค้างชำระ", "ค้าง", "วางบิล", "บิล", "ar_customer"],
  ["เจ้าหนี้", "ซัพพลาย", "ซัพพลายเออร์", "ผู้จำหน่าย", "จำหน่าย", "ผู้ขาย", "ap_supplier"],
  ["ลดหนี้", "คืนสินค้า", "รับคืน", "ส่งคืน", "คืน", "ใบลดหนี้"],
  ["เช็ค", "เช็ครับ", "เช็คจ่าย", "เด้ง", "ทะเบียนเช็ค", "cb_chq_list"],
  ["มัดจำ", "เงินมัดจำ", "ล่วงหน้า", "ล่วง"],
  ["ภพ30", "vat", "ภาษีมูลค่าเพิ่ม", "มูลค่า", "ภาษีซื้อ", "ภาษีขาย"],
  ["ภงด3", "ภงด53", "wht", "หักณที่จ่าย", "ทวิ"],
  ["งบการเงิน", "งบทดลอง", "ทดลอง", "งบดุล", "งบกำไรขาดทุน", "ฐานะ"],
  ["ผังบัญชี", "ผัง", "สมุดรายวัน", "สมุด", "เดบิต", "เครดิต", "gl_journal"],
  ["สินทรัพย์", "ทรัพย์สิน", "ค่าเสื่อม", "ค่าเสื่อมราคา", "เสื่อม", "fa_asset"],
  ["บัตรคุม", "บัตรคุมสินค้า", "การ์ด", "สต็อกการ์ด"],
  ["sql", "query", "queries", "คิวรี"],
  ["สิทธิ์", "กำหนดสิทธิ์"],
  ["รหัสเมนู", "เลขเมนู", "สารบัญเมนู", "ผังเมนู"],
  ["คีย์ลัด", "ปุ่มลัด", "shortcut", "shortcuts"],
  ["หาเมนูไม่เจอ", "เมนูหาย", "ซ่อนเมนู", "switchboard"],
  ["สต็อกไม่ตรง", "สต็อกเพี้ยน", "คำนวณยอดสต็อกใหม่"],
  ["พิมพ์ไม่ออก", "ปริ้นไม่ออก", "แบบฟอร์ม", "ตั้งค่าหน้ากระดาษ"],
  ["วิดีโอ", "คลิป", "คลิปสอน", "ยูทูป", "ยูทูบ", "youtube", "สอนใช้งาน"],
  ["ราคา", "แพ็กเกจ", "ค่าบริการ", "ใบเสนอราคา", "ทดลองใช้", "pricing"],
  ["สำนักงานบัญชี", "พาร์ตเนอร์", "partner"],
  ["ข้อเลือกพิเศษ", "ตั้งค่าพิเศษ", "erp_option", "1004"],
  ["ปรับราคา", "ศูนย์ราคา", "ตารางสูตรราคา", "สูตรราคา", "ic_inventory_price"],
  ["shopee", "lazada", "tiktok", "ช้อปปี้", "ลาซาด้า", "ติ๊กต็อก", "marketplace", "ใบกำกับอย่างย่อ", "abb", "ar_marketplace_settlement"],
  ["เงินเดือน", "ประกันสังคม", "สปส", "ภงด1", "payroll", "erp_payroll_run"],
  ["dbd", "efiling", "สบช3", "taxonomy", "ส่งงบ", "กรมพัฒนาธุรกิจ", "gl_dbd_taxonomy_map"],
  ["นักท่องเที่ยว", "ภพ10", "evrt", "vrt", "คืนภาษีนักท่องเที่ยว"],
  ["สองภาษา", "แปลภาษา", "ภาษาอังกฤษ", "bilingual", "i18n", "bc_language"],
  ["ประวัติการพิมพ์", "พิมพ์ซ้ำ", "ต้นฉบับ", "สำเนา", "erp_print_audit_log"],
  ["บัญชีย่อย", "กระทบยอดบัญชีย่อย", "subledger"],
  ["พักบิล", "ปิดกะ", "ลิ้นชัก", "จอลูกค้า", "เครื่องพิมพ์ใบเสร็จ", "objectbox"],
  ["ทุจริต", "เฝ้าระวัง", "จอพนักงาน", "fraud", "workmonitor"],
  ["ป้ายขนส่ง", "ป้ายชื่อขนส่ง", "สติกเกอร์บาร์โค้ด"],
  ["นิติบุคคล", "บุคคลธรรมดา", "คำนำหน้า", "ชื่อบุคคล", "ar_customer", "ap_supplier"],
  ["ขายติดลบ", "สต็อกติดลบ", "ห้ามติดลบ", "สินค้าติดลบ", "negative"],
  ["รูปแบบเอกสาร", "เลขที่เอกสาร", "เล่มเอกสาร", "erp_doc_format", "1014", "1015"],
  ["ออกแบบฟอร์ม", "พิมพ์เอกสาร", "ตัวอย่างก่อนพิมพ์", "print", "1096", "1097"],
  ["ข้อมูลเริ่มต้น", "preset", "starter", "ค่าเริ่มต้น"],
  ["ปรับปรุงภาษา", "language_manage", "พจนานุกรมภาษา", "1005"],
  ["คิวงาน", "ประมวลผลเบื้องหลัง", "procqueue", "ar_rebuild", "ap_rebuild", "jobs_enqueue"],
  ["พารามิเตอร์กลาง", "runtime_options", "options_runtime"],
  ["ปิดเครดิต", "วันปิดเครดิต", "close_credit_date"],
];

// Record every Thai word emitted by Intl.Segmenter("th") (pre-STOP filter, post-glue) into vocabFreq
const vocabFreq = new Map();
function recordVocab(w) {
  if (!w) return;
  if (THAI_OR_THAI_NUM.test(w)) {
    vocabFreq.set(w, (vocabFreq.get(w) ?? 0) + 1);
  }
}

function tokenizeNormalized(normText, collectVocab = false) {
  const words = [];
  let prevThai = false;

  const pushChunk = (raw) => {
    const thai = THAI_WORD.test(raw);
    if (thai && prevThai && words.length) {
      const prev = words[words.length - 1];
      if (!STOP.has(prev) && !STOP.has(raw) && STOP.has(prev + raw)) {
        words[words.length - 1] = prev + raw;
        prevThai = false;
        return;
      }
      if (!STOP.has(prev) && !STOP.has(raw) && (NEEDS_GLUE_PREV.test(prev) || NEEDS_GLUE_CUR.test(raw))) {
        words[words.length - 1] = prev + raw;
        prevThai = true;
        return;
      }
    }
    words.push(raw);
    if (raw.includes(".") && !/^\d+(?:\.\d+)+$/.test(raw)) {
      for (const dotPart of raw.split(".")) {
        if (!dotPart) continue;
        words.push(dotPart);
        if (dotPart.includes("_")) {
          for (const u of dotPart.split("_")) if (u) words.push(u);
        }
      }
    } else if (raw.includes("_")) {
      for (const u of raw.split("_")) if (u) words.push(u);
    }
    prevThai = thai && !STOP.has(raw);
  };

  for (const s of segmenter.segment(normText)) {
    if (!s.isWordLike) {
      prevThai = false;
      continue;
    }
    const seg = s.segment;
    if (MIXED_SCRIPT.test(seg)) {
      const subs = seg.match(/[\u0E00-\u0E7F]+\d*|[a-z0-9_]+/g);
      if (subs) {
        for (const sub of subs) pushChunk(sub);
        continue;
      }
    }
    pushChunk(seg);
  }
  if (collectVocab) {
    for (const w of words) recordVocab(w);
  }
  return words.filter((w) => w.length > 1 && !STOP.has(w));
}

// ---------- Per-note git recency (single fast git log on this repo's vault/) ----------
function collectGitNoteRecency() {
  const map = new Map(); // slug -> { updatedAt, lastCommit }
  // Use vaultMod.getWhatsNew if already implemented by retrieval branch
  if (typeof vaultMod.getWhatsNew === "function") {
    try {
      const list = vaultMod.getWhatsNew(3650, "all", 1000);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.slug && item?.updatedAt) {
            map.set(String(item.slug).toLowerCase(), {
              updatedAt: String(item.updatedAt),
              lastCommit: String(item.lastCommit ?? item.commit ?? "").slice(0, 12),
            });
          }
        }
      }
    } catch {
      // fall through to git log
    }
  }
  if (map.size > 0) return map;

  try {
    const out = execFileSync("git", ["--no-optional-locks", "log", "--format=@@@%h|%aI", "--name-only", "--", "vault"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let curHash = "";
    let curDate = "";
    for (const rawLine of out.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("@@@")) {
        const [h, d] = line.slice(3).split("|");
        curHash = (h ?? "").trim();
        curDate = (d ?? "").trim();
        continue;
      }
      if (line.startsWith("vault/") && line.endsWith(".md")) {
        const slug = path.basename(line, ".md").toLowerCase();
        if (!map.has(slug) && curDate) {
          map.set(slug, { updatedAt: curDate, lastCommit: curHash });
        }
      }
    }
  } catch {
    // git unavailable -> graceful fallback
  }
  return map;
}

// ---------- Structured facts extractor (uses lib/vault.ts getNoteFacts when present) ----------
const CODE_JARGON_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){1,}\b|\bSELECT\b|\bFROM\b|\bWHERE\b|\bCOALESCE\b/i;

function extractFallbackFacts(note) {
  const clean = note.cleanBody ?? stripSeeAlso(note.body);
  const facts = [];
  const seen = new Set();
  const isUser = note.audience === "user";

  const pushFact = (tag, text) => {
    if (facts.length >= 8) return;
    const flat = text
      .replace(/\[\[(?:[a-z_]+::)?([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, slug, lbl) => lbl ?? slug)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (flat.length < 12) return;
    if (isUser && CODE_JARGON_RE.test(flat)) return;
    const clipped = flat.length > 140 ? `${flat.slice(0, 137)}…` : flat;
    const key = `${tag}:${clipped.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    facts.push(`[${tag}] ${clipped}`);
  };

  let inCode = false;
  for (const rawLine of clean.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !line || line.startsWith("#") || line.startsWith("|---") || line.startsWith("| :---") || line.startsWith("![")) {
      continue;
    }
    const stripped = line.replace(/^[-*>\d.)\s]+/, "").trim();
    if (!stripped) continue;

    if (/\*\*"[^"\n]{6,140}"\*\*/.test(stripped)) {
      pushFact("error", stripped);
    } else if (/(?:รหัสเมนู|เมนู)\s*\*{0,2}`?[1-9]\d{3}`?\*{0,2}/.test(stripped) && !note.slug.startsWith("menu-cat-")) {
      pushFact("menu", stripped);
    } else if (/(?:เพดาน|ขั้นต่ำ|สูงสุด|ไม่เกิน|จำกัด|ฟรี\s*0|Concurrent|MB\b|บาท)/.test(stripped)) {
      pushFact("limit", stripped);
    } else if (/(?:สูตร|คำนวณ|×|÷|=\s*[^=])/.test(stripped) && stripped.length < 180) {
      pushFact("formula", stripped);
    } else if (/(?:ห้าม|ต้องกรอง|กฎเหล็ก|NUMERIC|COALESCE|last_status|ปิดงวด)/.test(stripped)) {
      pushFact("rule", stripped);
    }
    if (facts.length >= 8) break;
  }
  return facts;
}

// ---------- Direct Index Extraction (735 Menus + SQL Tables, exact parity with lib/vault.ts) ----------
const MENU_ROW_RE =
  /^\|\s*\*\*(\d{4})\*\*\s*\|\s*(?:\*\*)?([^|*\n]+?)(?:\*\*)?\s*\|\s*\*\*([^*\n]+)\*\*(?:<br>([^|\n]+))?\s*\|\s*([^|\n]+?)\s*\|$/gm;
const MENU_REF_RE = /(?:รหัสเมนู|เมนู|menu)\s*\*{0,2}`?([1-9]\d{3})`?\*{0,2}|\*\*([1-9]\d{3})\*\*/gi;
const TABLE_IDENT = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const BODY_IDENT = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

function extractMenusAndTables(notesMap) {
  const menuNoteRefs = new Map();
  for (const n of notesMap.values()) {
    if (n.slug.startsWith("menu-cat-") || n.slug === "menu-catalog-overview" || n.slug === "index") continue;
    for (const m of n.body.matchAll(MENU_REF_RE)) {
      const code = m[1] || m[2];
      if (!code) continue;
      const num = Number(code);
      if ((num >= 2015 && num <= 2035) || (num >= 2555 && num <= 2585)) continue;
      let s = menuNoteRefs.get(code);
      if (!s) {
        s = new Set();
        menuNoteRefs.set(code, s);
      }
      s.add(n.slug);
    }
  }

  const menuByCode = new Map();
  const menus = [];
  for (const n of notesMap.values()) {
    if (!n.slug.startsWith("menu-cat-")) continue;
    for (const m of n.body.matchAll(MENU_ROW_RE)) {
      const code = m[1].trim();
      if (menuByCode.has(code)) continue;
      const legacyCode = m[2].trim();
      const name = m[3].trim();
      const menuPath = (m[4] ?? "").trim() || name;
      const edition = m[5].trim();
      const refs = [...(menuNoteRefs.get(code) ?? [])].sort((a, z) => {
        const na = notesMap.get(a);
        const nz = notesMap.get(z);
        const pa = na?.folder === "howto" ? 0 : na?.folder === "start" ? 1 : na?.folder === "troubleshoot" ? 2 : 3;
        const pz = nz?.folder === "howto" ? 0 : nz?.folder === "start" ? 1 : nz?.folder === "troubleshoot" ? 2 : 3;
        return pa - pz || a.localeCompare(z);
      });
      const haystack = normalizeText(`${code} ${legacyCode} ${name} ${menuPath}`);
      tokenizeNormalized(haystack, true);
      const entry = {
        code,
        legacyCode,
        name,
        menuPath,
        edition,
        catalogSlug: n.slug,
        relatedSlugs: refs.slice(0, 6),
        haystack,
      };
      menuByCode.set(code, entry);
      menus.push(entry);
    }
  }
  menus.sort((a, z) => a.code.localeCompare(z.code));

  const tableByName = new Map();
  const tables = [];
  for (const n of notesMap.values()) {
    if (n.folder !== "schema") continue;
    const candidates = new Set();
    const fromSlug = n.slug.replace(/^tbl-/, "").replace(/-/g, "_");
    if (TABLE_IDENT.test(fromSlug)) candidates.add(fromSlug);
    for (const a of n.aliases) {
      const low = a.trim().toLowerCase();
      if (TABLE_IDENT.test(low)) candidates.add(low);
    }
    for (const m of n.title.matchAll(BODY_IDENT)) {
      candidates.add(m[0].toLowerCase());
    }
    const related = [
      ...new Set([
        ...n.inEdges.filter((e) => notesMap.get(e.slug)?.audience === "dev").map((e) => e.slug),
        ...n.outEdges.filter((e) => notesMap.get(e.slug)?.audience === "dev").map((e) => e.slug),
      ]),
    ].slice(0, 6);
    for (const tbl of candidates) {
      if (tableByName.has(tbl)) continue;
      const entry = {
        table: tbl,
        schemaSlug: n.slug,
        schemaTitle: n.title,
        relatedSlugs: related,
      };
      tableByName.set(tbl, entry);
      tables.push(entry);
    }
  }
  tables.sort((a, z) => a.table.localeCompare(z.table));
  return { menus, tables };
}

// ---------- Load compiled runtime Ground-Truth Index (public/grounding-index.json, safe fallback) ----------
const FORBIDDEN_GROUNDING_TABLE_RE =
  /^(?:bc_user_list|bc_mcp_access_tokens|bc_mcp_token_databases|bc_mcp_token_audit|bc_google_account|pg_shadow|pg_authid|pg_stats)/i;

function loadGroundingIndexForPack() {
  const indexPath = process.env.BC_GROUNDING_INDEX_FILE?.trim()
    ? path.resolve(process.env.BC_GROUNDING_INDEX_FILE.trim())
    : path.join(process.cwd(), "public", "grounding-index.json");
  const fallback = {
    builtAt: "",
    menuCount: 0,
    tableCount: 0,
    columnCount: 0,
    errorCount: 0,
    menus: {},
    tables: {},
  };
  if (!fs.existsSync(indexPath)) return fallback;
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const menus = {};
    if (raw.menus && typeof raw.menus === "object") {
      for (const [code, entry] of Object.entries(raw.menus)) {
        const cleanCode = String(code).trim();
        if (!/^[1-9]\d{3}$/.test(cleanCode) || !entry || typeof entry !== "object") continue;
        const label = String(entry.label ?? "").trim();
        if (!label) continue;
        const mod = typeof entry.module === "string" && entry.module.trim() ? entry.module.trim() : undefined;
        menus[cleanCode] = mod ? { code: cleanCode, label, module: mod } : { code: cleanCode, label };
      }
    }
    const tables = {};
    let columnCount = 0;
    if (raw.tables && typeof raw.tables === "object") {
      for (const [rawTbl, rawCols] of Object.entries(raw.tables)) {
        const tbl = String(rawTbl).toLowerCase().trim();
        if (!/^[a-z][a-z0-9_]*$/.test(tbl) || FORBIDDEN_GROUNDING_TABLE_RE.test(tbl) || !Array.isArray(rawCols)) continue;
        const cols = [...new Set(rawCols.map((c) => String(c).toLowerCase().trim()).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c)))].sort();
        tables[tbl] = cols;
        columnCount += cols.length;
      }
    }
    return {
      builtAt: typeof raw.builtAt === "string" ? raw.builtAt : "",
      menuCount: Object.keys(menus).length,
      tableCount: Object.keys(tables).length,
      columnCount,
      errorCount: typeof raw.errorCount === "number" && Number.isFinite(raw.errorCount) ? raw.errorCount : 0,
      menus,
      tables,
    };
  } catch {
    return fallback;
  }
}

// ---------- Build full export payload ----------
const notesMap = vault();
const gitRecency = collectGitNoteRecency();
const builtAtIso = new Date().toISOString();

const sortedNotes = [...notesMap.values()].sort((a, b) => a.slug.localeCompare(b.slug));
const exportedNotes = [];

for (const n of sortedNotes) {
  const titleToks = [...new Set(tokenizeNormalized(n.haystack.title, true))];
  const metaToks = [...new Set(tokenizeNormalized(n.haystack.meta, true))];
  const bodyFreq = {};
  for (const w of tokenizeNormalized(n.haystack.body, true)) {
    const prev = bodyFreq[w] ?? 0;
    if (prev < 16) bodyFreq[w] = prev + 1;
  }

  const cleanBody = n.cleanBody ?? stripSeeAlso(n.body);
  const rawSections =
    Array.isArray(n.sections) && n.sections.length > 0
      ? n.sections
      : cleanBody.split(/\n(?=## )/).map((raw) => ({
          heading: raw.split("\n")[0].replace(/^#+\s*/, "").trim(),
          raw,
          norm: normalizeText(raw),
        }));
  const exportedSections = rawSections.map((s) => {
    const heading = s.heading || n.title;
    tokenizeNormalized(normalizeText(heading), true);
    return {
      heading,
      raw: s.raw,
    };
  });

  const tldr = getNoteTldr(n);
  const facts = typeof getNoteFacts === "function" ? getNoteFacts(n) : extractFallbackFacts(n);
  const rec = gitRecency.get(n.slug);

  exportedNotes.push({
    slug: n.slug,
    folder: n.folder,
    audience: n.audience,
    title: n.title,
    tags: n.tags,
    aliases: n.aliases,
    sources: n.sources,
    body: n.body,
    tldr,
    sections: exportedSections,
    facts,
    links: n.links,
    backlinks: n.backlinks,
    outEdges: n.outEdges,
    inEdges: n.inEdges,
    media: n.media ?? { images: [], videos: [], webPages: [] },
    tokens: {
      title: titleToks,
      meta: metaToks,
      body: bodyFreq,
    },
    updatedAt: rec?.updatedAt ?? builtAtIso,
    lastCommit: rec?.lastCommit ?? (syncCommit || "local"),
  });
}

const { menus, tables } = extractMenusAndTables(notesMap);
const builtErrIdx = buildErrorIndex(sortedNotes, (s) => tokenizeNormalized(s, true), normalizeText);
const errors = builtErrIdx.entries.map((entry, idx) => ({
  errorText: entry.errorText,
  norm: builtErrIdx.normTexts[idx] ?? normalizeText(entry.errorText),
  stripped: builtErrIdx.strippedTexts[idx] ?? "",
  slug: entry.slug,
  title: entry.title,
  folder: entry.folder,
  audience: entry.audience,
  fixSnippet: entry.fixSnippet,
}));
const groundingIndex = loadGroundingIndexForPack();
const openApiSpec = getOpenApiSpec();

// Ensure STOP words and tokenized synonym pieces are present in Thai vocab dictionary
for (const sw of STOP_WORDS) {
  if (THAI_OR_THAI_NUM.test(sw)) {
    vocabFreq.set(sw, Math.max(vocabFreq.get(sw) ?? 0, 500));
  }
}
for (const grp of SYNONYM_GROUPS) {
  for (const raw of grp) {
    tokenizeNormalized(normalizeText(raw), true);
  }
}
// Common Thai query question/connector words so user prompts segment identically to Intl.Segmenter("th")
for (const extra of [
  "ยังไง", "อย่างไร", "ทำไม", "เท่าไร", "เท่าไหร่", "ไหน", "กี่", "อะไร", "มั้ย", "ไหม",
  "ไม่ได้", "ไม่ขึ้น", "ไม่เจอ", "ไม่พอ", "ไม่ตรง", "หายไป", "หาย", "เด้ง", "เพี้ยน",
  "อยาก", "ต้อง", "ควร", "สามารถ", "เปลี่ยน", "ตั้งค่า", "กำหนด", "สร้าง", "เพิ่ม", "แก้ไข", "ลบ", "ยกเลิก",
  "ภงด1", "ภงด3", "ภงด53", "ภพ30", "ภพ10", "สบช3",
]) {
  tokenizeNormalized(normalizeText(extra), true);
  if (THAI_OR_THAI_NUM.test(extra)) {
    vocabFreq.set(extra, Math.max(vocabFreq.get(extra) ?? 0, 200));
  }
}

const vocabObj = {};
const pinnedVocab = new Set([
  ...STOP_WORDS,
  "ภงด1", "ภงด3", "ภงด53", "ภพ30", "ภพ10", "สบช3",
]);
for (const grp of SYNONYM_GROUPS) {
  for (const raw of grp) {
    const nw = normalizeText(raw);
    if (THAI_OR_THAI_NUM.test(nw)) pinnedVocab.add(nw);
  }
}
for (const [w, c] of [...vocabFreq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  // Filter rare 1-2 occurrence glued noise fragments (e.g. "ยอดส:1") that poison longest-match segmentation
  if (c < 3 && !pinnedVocab.has(w)) continue;
  vocabObj[w] = c;
}

const bootUser = getBootstrapPack("user");
const bootDev = getBootstrapPack("dev");
const vpack = getVaultPackGzip();

const pack = {
  meta: {
    version: "3.0.0",
    syncCommit: syncCommit || "",
    updatedAt,
    noteCount: exportedNotes.length,
    builtAt: builtAtIso,
  },
  folders: vaultFolders("all"),
  notes: exportedNotes,
  menus,
  tables,
  errors,
  groundingIndex,
  openApiSpec,
  bootstrapPacks: {
    user: { text: bootUser.text, etag: bootUser.etag, chars: bootUser.chars },
    dev: { text: bootDev.text, etag: bootDev.etag, chars: bootDev.chars },
  },
  vaultPackGzipBase64: vpack.gz.toString("base64"),
  vaultPackEtag: vpack.etag,
  vaultPackNoteCount: vpack.noteCount,
  synonyms: SYNONYM_GROUPS,
  stopWords: STOP_WORDS,
  vocab: vocabObj,
};

const outPath = path.resolve(process.argv[2] || path.join(process.cwd(), "public", "go-brain-pack.json"));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const jsonStr = JSON.stringify(pack);
fs.writeFileSync(outPath, jsonStr, "utf8");

const elapsedMs = (performance.now() - t0).toFixed(1);
console.log(
  `export-go-pack ok: ${outPath} (${(Buffer.byteLength(jsonStr, "utf8") / 1024 / 1024).toFixed(2)} MB, notes=${exportedNotes.length}, menus=${menus.length}, tables=${tables.length}, errors=${errors.length}, grounding=${groundingIndex.menuCount}m/${groundingIndex.tableCount}t/${groundingIndex.columnCount}c, vocab=${vocabFreq.size}, ms=${elapsedMs})`,
);
