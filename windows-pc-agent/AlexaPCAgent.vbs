Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """" & WshShell.CurrentDirectory & "\AlexaPCAgent.exe""", 0, False
