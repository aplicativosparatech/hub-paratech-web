@echo off
setlocal EnableDelayedExpansion

title Desinstalador - Hub Paratech Desktop
color 0C

echo ===============================================================================
echo                HUB PARATECH DESKTOP - REMOCAO DO SERVICO
echo ===============================================================================
echo.

REM 1. Verificacao de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Solicitando permissao de Administrador do Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [*] Finalizando processos do Hub Paratech se estiverem em execucao...
taskkill /F /IM HubParatechDesktop.exe >nul 2>&1

echo [*] Removendo tarefa agendada do Windows...
schtasks /delete /tn "HubParatechMonitor" /f >nul 2>&1

echo [*] Removendo entradas de inicializacao do Registro do Windows...
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /f >nul 2>&1

echo [*] Limpando executaveis anteriores...
if exist "C:\Paratech\HubDesktop\HubParatechDesktop.exe" (
    del /F /Q "C:\Paratech\HubDesktop\HubParatechDesktop.exe" >nul 2>&1
)

echo.
echo ===============================================================================
echo  [SUCESSO] Inicializacao automatica e tarefas do Hub Paratech foram removidas!
echo ===============================================================================
echo.
pause
exit /b