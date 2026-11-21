// Shared local env loader + secret/IP redactor for bcbrain automation scripts.
import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv(rootDir = process.cwd()) {
  const envFile = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envFile)) return;
  const raw = fs.readFileSync(envFile, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function redactLogText(text) {
  return String(text ?? "")
    .replace(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g, (ip) =>
      /^(?:127\.|10\.|0\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip) ? ip : "<REDACTED_IP>",
    )
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, "<REDACTED_SECRET>");
}

// Compute canonical 4-digit menu codes (1001..9xxx) directly from D:/bcaiaccount bcMenu.json
// Mirrors frontend/src/config/bcMenu.ts (removeByVersion "&13&" -> filterVisibleMenuBar(false) -> assignMenuCodes) — strictly READ-ONLY.
export function loadBcMenuTruth(srcDir) {
  const candidates = [
    path.join(srcDir, "frontend/src/config/bcMenu.json"),
    path.join(srcDir, "backend/internal/application/process/bcMenu.json"),
  ];
  const map = new Map();
  const versionTag = "&13&";
  function removeByVersion(nodes) {
    const out = [];
    for (const n of nodes ?? []) {
      if (n.name === "menu_singha_warehouse" || n.name === "menu_so_pos") continue;
      const tag = n.tag ?? "";
      if (tag.length > 0 && !tag.includes(versionTag) && tag !== "&hide&") continue;
      out.push({ ...n, children: n.children?.length ? removeByVersion(n.children) : undefined });
    }
    return out;
  }
  function filterVisible(nodes) {
    const out = [];
    for (const n of nodes ?? []) {
      if (n.name === "menu_singha_warehouse" || n.name === "menu_so_pos") continue;
      const tag = n.tag ?? "";
      if (tag.includes("&hide&")) continue;
      if (n.children) {
        const visChildren = filterVisible(n.children);
        if (!visChildren.length) continue;
        out.push({ ...n, children: visChildren });
      } else {
        out.push({ ...n });
      }
    }
    return out;
  }
  function collectFromFile(menuFile) {
    if (!fs.existsSync(menuFile)) return;
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(menuFile, "utf8"));
    } catch {
      return;
    }
    const visible = filterVisible(removeByVersion(raw));
    visible.forEach((top, topIdx) => {
      const catNum = topIdx + 1;
      let leafCounter = 0;
      function walk(nodes, trail) {
        for (const node of nodes ?? []) {
          const nextTrail = [...trail, node.text || node.name];
          if (!node.children || node.children.length === 0) {
            leafCounter += 1;
            const code = `${catNum}${String(leafCounter).padStart(3, "0")}`;
            if (!map.has(code)) {
              map.set(code, { code, name: node.name, text: node.text, path: nextTrail.join(" > ") });
            }
          } else {
            walk(node.children, nextTrail);
          }
        }
      }
      walk(top.children, [top.text || top.name]);
    });
  }
  // Primary frontend bcMenu.json first; merge backend extras only if not colliding
  collectFromFile(candidates[0]);
  return map;
}

export const MENU_CAT_FILES = {
  "1": "vault/start/menu-cat-1-setup.md",
  "2": "vault/start/menu-cat-2-stock.md",
  "3": "vault/start/menu-cat-3-purchase.md",
  "4": "vault/start/menu-cat-4-sales.md",
  "5": "vault/start/menu-cat-5-ap.md",
  "6": "vault/start/menu-cat-6-ar.md",
  "7": "vault/start/menu-cat-7-cash-bank.md",
  "8": "vault/start/menu-cat-8-fixed-assets.md",
  "9": "vault/start/menu-cat-9-gl.md",
};

// Verify 1:1 (code, text) parity between live bcMenu.json and vault/start/menu-cat-1..9-*.md
export function auditMenuCatalogParity(rootDir, srcDir, onlyRelSet = null) {
  const truth = loadBcMenuTruth(srcDir);
  if (!truth.size) return { checkedRows: 0, mismatchedFiles: [] };
  const mismatchedFiles = [];
  let checkedRows = 0;

  for (const [cat, rel] of Object.entries(MENU_CAT_FILES)) {
    if (onlyRelSet && !onlyRelSet.has(rel)) continue;
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue;
    const txt = fs.readFileSync(abs, "utf8");
    const docMap = new Map();
    for (const m of txt.matchAll(/\|\s*\*\*(\d{4})\*\*\s*\|\s*[^|]*\|\s*\*\*([^*\n]+)\*\*/g)) {
      docMap.set(m[1], m[2].trim());
    }
    const issues = [];
    const truthCat = [...truth.values()].filter((v) => v.code.startsWith(cat));
    checkedRows += truthCat.length;
    for (const t of truthCat) {
      const docText = docMap.get(t.code);
      if (!docText) issues.push(`missing menu ${t.code} (${t.text})`);
      else if (docText !== t.text) issues.push(`code ${t.code} mismatch: doc="${docText}" != live="${t.text}"`);
    }
    for (const code of docMap.keys()) {
      if (!truth.has(code)) issues.push(`extra stale menu ${code} (${docMap.get(code)}) not in live bcMenu.json`);
    }
    if (issues.length) mismatchedFiles.push({ note: rel, cat, issues });
  }
  return { checkedRows, mismatchedFiles };
}

// Parse full mounted HTTP route patterns declared in backend/internal/adapter/inbound/http/router.go
export function loadRouterTruth(srcDir) {
  const routerPath = path.join(srcDir, "backend/internal/adapter/inbound/http/router.go");
  const routes = new Set();
  if (!fs.existsSync(routerPath)) return routes;
  const lines = fs.readFileSync(routerPath, "utf8").split(/\r?\n/);

  const joinRoute = (prefix, sub) => {
    const p = prefix === "/" ? "" : prefix.replace(/\/+$/, "");
    const s = sub.startsWith("/") ? sub : `/${sub}`;
    if (s === "/" && p) return [p, `${p}/`];
    return [`${p}${s}`.replace(/\/+/g, "/")];
  };

  // Pass 1: collect helper route blocks (mountProcessRoutes, mountAI)
  const helperBlocks = { mountProcessRoutes: [], mountAI: [] };
  let activeHelper = null;
  let helperDepth = 0;
  for (const line of lines) {
    const clean = line.replace(/\/\/.*$/, "").replace(/"(?:\\.|[^"\\])*"/g, '""');
    if (!activeHelper) {
      if (/func\s+mountProcessRoutes\s*\(/.test(line)) {
        activeHelper = "mountProcessRoutes";
        helperDepth = 0;
      } else if (/mountAI\s*:=\s*func\s*\(/.test(line)) {
        activeHelper = "mountAI";
        helperDepth = 0;
      }
    }
    if (activeHelper) {
      for (const m of line.matchAll(/r\.(?:With\([^)]*\)\.)?(?:Get|Post|Put|Delete|Patch|HandleFunc)\("([^"]+)"/g)) {
        helperBlocks[activeHelper].push(m[1]);
      }
      for (const ch of clean) {
        if (ch === "{") helperDepth += 1;
        else if (ch === "}") helperDepth -= 1;
      }
      if (helperDepth <= 0 && clean.includes("}")) activeHelper = null;
    }
  }

  // Pass 2: track r.Route("<prefix>", ...) nesting inside NewRouter
  let inNewRouter = false;
  let depth = 0;
  const routeStack = []; // { prefix, exitDepth }
  for (const line of lines) {
    if (!inNewRouter) {
      if (/func\s+NewRouter\s*\(/.test(line)) inNewRouter = true;
      else continue;
    }
    const clean = line.replace(/\/\/.*$/, "").replace(/"(?:\\.|[^"\\])*"/g, '""');
    const currentPrefix = routeStack.map((x) => x.prefix).join("");

    const routeOpen = line.match(/r\.Route\("([^"]+)",\s*([A-Za-z0-9_]+|func\s*\()/);
    const openCount = (clean.match(/\{/g) || []).length;
    const closeCount = (clean.match(/\}/g) || []).length;

    if (routeOpen && !routeOpen[2].startsWith("func")) {
      const mountPrefix = `${currentPrefix}${routeOpen[1]}`;
      for (const sub of helperBlocks[routeOpen[2]] ?? []) {
        for (const full of joinRoute(mountPrefix, sub)) routes.add(full);
      }
    } else if (/mountProcessRoutes\s*\(/.test(line)) {
      for (const sub of helperBlocks.mountProcessRoutes) {
        for (const full of joinRoute(currentPrefix, sub)) routes.add(full);
      }
    } else {
      for (const m of line.matchAll(/r\.(?:With\([^)]*\)\.)?(?:Get|Post|Put|Delete|Patch|HandleFunc)\("([^"]+)"/g)) {
        for (const full of joinRoute(currentPrefix, m[1])) routes.add(full);
      }
    }

    if (routeOpen && routeOpen[2].startsWith("func")) {
      routeStack.push({ prefix: routeOpen[1], enterDepth: depth });
    }
    depth += openCount - closeCount;
    while (routeStack.length && depth <= routeStack[routeStack.length - 1].enterDepth) {
      routeStack.pop();
    }
    if (depth <= 0 && routeStack.length === 0 && clean.includes("}") && !/func\s+NewRouter/.test(line)) {
      break;
    }
  }
  return routes;
}

export function matchRouterPath(docRoute, validRoutes) {
  if (!validRoutes || validRoutes.size === 0) return true;
  const norm = docRoute.split("?")[0].replace(/\/+$/, "") || "/";
  if (validRoutes.has(norm) || validRoutes.has(`${norm}/`)) return true;
  // Wildcard / template forms e.g. /api/v1/pos/*, /language*, /process/...
  if (/[*<]|\.\.\.|\{[^}]*,[^}]*\}/.test(norm)) {
    const starPrefix = norm.split(/[*<{]|\.\.\./)[0].replace(/\/+$/, "");
    if (!starPrefix) return true;
    for (const r of validRoutes) {
      if (r === starPrefix || r.startsWith(`${starPrefix}/`) || r.startsWith(starPrefix)) return true;
    }
    return false;
  }
  // Exact segment comparison allowing {param} wildcards
  const dSegs = norm.split("/");
  for (const r of validRoutes) {
    const rSegs = (r.replace(/\/+$/, "") || "/").split("/");
    if (dSegs.length !== rSegs.length) continue;
    let ok = true;
    for (let i = 0; i < dSegs.length; i++) {
      if (dSegs[i] === rSegs[i]) continue;
      if (/^\{[^}]+\}$/.test(rSegs[i]) || /^\{[^}]+\}$/.test(dSegs[i])) continue;
      ok = false;
      break;
    }
    if (ok) return true;
  }
  return false;
}
