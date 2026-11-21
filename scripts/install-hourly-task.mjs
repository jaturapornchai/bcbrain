// Registers permanent Windows Scheduled Task "\bcbrain\hourly-sync" running every 1 hour silently.
// Usage: node scripts/install-hourly-task.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const VBS = path.join(ROOT, "scripts", "hidden.vbs");
const CMD = path.join(ROOT, "scripts", "hourly-sync.cmd");

for (const f of [VBS, CMD]) {
  if (!fs.existsSync(f)) {
    console.error(`Missing required script: ${f}`);
    process.exit(1);
  }
}

const ps = `
$ErrorActionPreference = 'Stop'
$taskFolder = '\\bcbrain\\'
$taskName = 'hourly-sync'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + '${VBS.replace(/'/g, "''")}' + '" "' + '${CMD.replace(/'/g, "''")}' + '"') -WorkingDirectory '${ROOT.replace(/'/g, "''")}'
$start = (Get-Date).Date.AddHours((Get-Date).Hour).AddMinutes(30)
if ($start -le (Get-Date)) { $start = $start.AddHours(1) }
$trigger = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 40)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskPath $taskFolder -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'BC Brain hourly read-only sync from D:\\bcaiaccount + 7-gate verify + auto-deploy' -Force | Out-Null
Get-ScheduledTask -TaskPath $taskFolder -TaskName $taskName | Select-Object TaskPath,TaskName,State | Format-Table -AutoSize
(Get-ScheduledTaskInfo -TaskPath $taskFolder -TaskName $taskName) | Select-Object NextRunTime,LastRunTime,LastTaskResult | Format-Table -AutoSize
`;

const out = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
  encoding: "utf8",
  timeout: 30_000,
});
console.log(out.trim());
