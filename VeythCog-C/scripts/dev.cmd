@echo off
setlocal
rem VeythCog dev launcher: prefer PowerShell 7 (pwsh), fall back to Windows PowerShell 5.1.
rem 全部用绝对路径，避免某些终端 PATH 精简导致找不到 pwsh / powershell。
set "PS1=%~dp0dev.ps1"
if not exist "%PS1%" (
  echo [dev] 找不到 dev.ps1: %PS1%
  exit /b 1
)
set "PWSH="
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PWSH=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined PWSH if exist "%ProgramFiles%\PowerShell\7-preview\pwsh.exe" set "PWSH=%ProgramFiles%\PowerShell\7-preview\pwsh.exe"
if not defined PWSH if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe" set "PWSH=%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe"
if defined PWSH (
  "%PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
  exit /b %errorlevel%
)
set "PS51=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS51%" set "PS51=powershell"
"%PS51%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
exit /b %errorlevel%