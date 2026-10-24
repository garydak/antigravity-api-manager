@echo off
cd /d "%~dp0"
echo [Antigravity API Manager] 正在启动 Antigravity 并自动装载增强套件...
start "" wscript.exe //B //Nologo "%USERPROFILE%\.gemini\antigravity-suite\data\launch-antigravity.vbs"
