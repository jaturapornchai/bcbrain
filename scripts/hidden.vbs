' Launch hourly-sync.cmd silently with zero console popup window (same pattern as memory-hub)
Set sh = CreateObject("WScript.Shell")
If WScript.Arguments.Count > 0 Then
  cmd = """" & WScript.Arguments(0) & """"
  sh.Run cmd, 0, True
End If
