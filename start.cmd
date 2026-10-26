@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SafeLoop - Local Preview
echo [SafeLoop] Starting the ready-built web app...
echo [SafeLoop] This window must remain open.
set "SAFELOOP_NODE="
for %%I in (node.exe) do set "SAFELOOP_NODE=%%~$PATH:I"
if not defined SAFELOOP_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "SAFELOOP_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined SAFELOOP_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "SAFELOOP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined SAFELOOP_NODE goto no_node
"%SAFELOOP_NODE%" "%~dp0scripts\start-local.mjs" %*
if errorlevel 1 echo [ERROR] Startup failed. Check start.log in this folder.
goto end
:no_node
echo [ERROR] Node.js was not found. Install Node.js 22 or newer, then retry.
echo [INFO] You can also open the hosted SafeLoop web link.
:end
echo.
pause
endlocal
