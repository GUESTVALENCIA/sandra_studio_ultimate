' Sandra Studio Ultimate - Lanzador Silencioso
' Este script inicia la aplicación sin mostrar la ventana de terminal
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Sandra-IA-8.0-Pro\app-desktop-opus"
WshShell.Run "cmd /c set ELECTRON_RUN_AS_NODE=&& npm start", 0, False
