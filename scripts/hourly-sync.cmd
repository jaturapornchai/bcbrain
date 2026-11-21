@echo off
setlocal
cd /d "D:\bcbrain"
if not exist ".sync-logs" mkdir ".sync-logs"
"C:\Program Files\nodejs\node.exe" "D:\bcbrain\scripts\hourly-sync.mjs" > "D:\bcbrain\.sync-logs\last-run.log" 2>&1
exit /b %ERRORLEVEL%
