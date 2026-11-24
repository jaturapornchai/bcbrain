// Windows/Cross-platform atomic deploy to brain.bcsmethai.com with live MCP eval & automatic rollback.
// Usage: node scripts/deploy.mjs [--skip-build] [--skip-eval]
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv, redactLogText } from "./load-env.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const HOST = process.env.BC_DEPLOY_HOST;
const APP = "/opt/bcbrain";
const PUBLIC_URL = (process.env.BC_PUBLIC_URL ?? "https://brain.bcsmethai.com").replace(/\/$/, "");
const skipBuild = process.argv.includes("--skip-build");
const skipEval = process.argv.includes("--skip-eval");

if (!HOST || HOST.includes("<")) {
  console.error("deploy: BC_DEPLOY_HOST not set. Add BC_DEPLOY_HOST=root@<server> to .env.local");
  process.exit(1);
}

function run(bin, args, opts = {}) {
  const res = spawnSync(bin, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: opts.shell ?? false,
    timeout: opts.timeout ?? 300_000,
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  if (res.status !== 0) {
    const out = redactLogText(`${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim());
    throw new Error(`${bin} ${args.slice(0, 3).join(" ")} failed (exit ${res.status}):\n${out.slice(-1500)}`);
  }
  return res.stdout ?? "";
}

function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true, force: true });
}

function runSsh(remoteCmd, timeout = 120_000) {
  return run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", HOST, remoteCmd], { timeout });
}

function rollbackServer() {
  console.error("deploy: attempting automatic server rollback to /opt/bcbrain.prev ...");
  try {
    const out = runSsh(
      `set -e
      if [ -d ${APP}.prev ]; then
        rm -rf ${APP}.bad
        if [ -d ${APP} ]; then mv ${APP} ${APP}.bad; fi
        mv ${APP}.prev ${APP}
        systemctl restart bcbrain
        if systemctl list-unit-files bcbrain-mcp.service | grep -q bcbrain-mcp; then systemctl restart bcbrain-mcp || true; fi
        for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS -o /dev/null http://127.0.0.1:3951/ && break; sleep 1; done
        curl -sS -o /dev/null -w 'rollback health web: %{http_code}\\n' http://127.0.0.1:3951/
      else
        echo "rollback skipped: no ${APP}.prev"
      fi`,
      60_000,
    );
    console.error(redactLogText(out.trim()));
  } catch (e) {
    console.error("deploy: rollback error:", redactLogText(e.message));
  }
}

const t0 = Date.now();
const deployDir = path.join(ROOT, ".deploy");
const tarPath = path.join(ROOT, "bcbrain.tar.gz");

try {
  if (!skipBuild) {
    console.log("deploy: refreshing runtime grounding index (preserves existing if source unavailable)...");
    run(process.execPath, ["scripts/export-grounding-index.mjs"], { timeout: 60_000 });

    console.log("deploy: running npm run build (includes secret scan)...");
    // Use npm.cmd on Windows via cmd.exe /c to avoid EINVAL on Node 24
    if (process.platform === "win32") {
      run("cmd.exe", ["/d", "/s", "/c", "npm run build"], { timeout: 300_000 });
    } else {
      run("npm", ["run", "build"], { timeout: 300_000 });
    }
  }

  console.log("deploy: packing standalone bundle + public + vault + Go MCP sidecar...");
  fs.rmSync(deployDir, { recursive: true, force: true });
  fs.mkdirSync(deployDir, { recursive: true });
  copyDir(path.join(ROOT, ".next", "standalone"), deployDir);
  copyDir(path.join(ROOT, ".next", "static"), path.join(deployDir, ".next", "static"));
  copyDir(path.join(ROOT, "public"), path.join(deployDir, "public"));
  copyDir(path.join(ROOT, "vault"), path.join(deployDir, "vault"));

  console.log("deploy: exporting pre-processed Go pack (.deploy/public/go-brain-pack.json)...");
  const packOut = run(
    process.execPath,
    ["scripts/export-go-pack.mjs", path.join(deployDir, "public", "go-brain-pack.json")],
    { timeout: 120_000 },
  );
  console.log(redactLogText(packOut.trim()));

  console.log("deploy: cross-compiling zero-CGO Linux amd64 Go sidecar (.deploy/bcbrain-mcp)...");
  run(
    "go",
    ["build", "-C", "cmd/bcbrain-mcp", "-ldflags=-s -w", "-o", "../../.deploy/bcbrain-mcp", "."],
    {
      timeout: 120_000,
      env: { CGO_ENABLED: "0", GOOS: "linux", GOARCH: "amd64" },
    },
  );
  const binSizeMB = (fs.statSync(path.join(deployDir, "bcbrain-mcp")).size / (1024 * 1024)).toFixed(2);
  console.log(`deploy: built .deploy/bcbrain-mcp (${binSizeMB} MB linux/amd64)`);

  if (fs.existsSync(tarPath)) fs.rmSync(tarPath, { force: true });
  run("tar", ["-czf", "bcbrain.tar.gz", "-C", ".deploy", "."], { timeout: 120_000 });

  console.log("deploy: uploading bundle and systemd units via scp...");
  run(
    "scp",
    [
      "-q",
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=15",
      "bcbrain.tar.gz",
      "deploy/bcbrain.service",
      "deploy/bcbrain-mcp.service",
      `${HOST}:/tmp/`,
    ],
    { timeout: 180_000 },
  );

  console.log("deploy: atomically swapping release and restarting bcbrain + bcbrain-mcp...");
  const remoteOut = runSsh(
    `set -e
    rm -rf ${APP}.new && mkdir -p ${APP}.new && tar -xzf /tmp/bcbrain.tar.gz -C ${APP}.new && rm -f /tmp/bcbrain.tar.gz
    chmod +x ${APP}.new/bcbrain-mcp
    rm -rf ${APP}.prev; if [ -d ${APP} ]; then mv ${APP} ${APP}.prev; fi; mv ${APP}.new ${APP}
    mv /tmp/bcbrain.service /etc/systemd/system/bcbrain.service
    mv /tmp/bcbrain-mcp.service /etc/systemd/system/bcbrain-mcp.service
    systemctl daemon-reload
    systemctl enable -q bcbrain bcbrain-mcp
    systemctl restart bcbrain bcbrain-mcp
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do curl -fsS -o /dev/null http://127.0.0.1:3951/ && curl -fsS -o /dev/null http://127.0.0.1:3961/healthz && break; sleep 1; done
    webCode=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3951/)
    mcpHealth=$(curl -sS http://127.0.0.1:3961/healthz)
    mcpCode=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3961/healthz)
    echo "local health: web=$webCode mcp=$mcpCode"
    echo "sidecar: $mcpHealth"
    test "$webCode" = "200" && test "$mcpCode" = "200"`,
    120_000,
  );
  console.log(redactLogText(remoteOut.trim()));

  if (!skipEval) {
    console.log(`deploy: running live production MCP eval against ${PUBLIC_URL}/mcp ...`);
    try {
      const evalOut = execFileSync(process.execPath, ["scripts/mcp-eval.mjs", `${PUBLIC_URL}/mcp`], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 120_000,
      });
      console.log(evalOut.trim());
    } catch (evalErr) {
      console.error("deploy: LIVE MCP EVAL FAILED — rolling back!");
      console.error(redactLogText(String(evalErr.stdout ?? "") + "\n" + String(evalErr.stderr ?? "")));
      rollbackServer();
      process.exit(1);
    }
  }

  console.log(`deploy: SUCCESS in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} finally {
  fs.rmSync(tarPath, { force: true });
  fs.rmSync(deployDir, { recursive: true, force: true });
}
