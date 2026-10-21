@echo off
chcp 65001 >nul
title Desinstalador - Hub Paratech Desktop
color 0C

echo ===============================================================================
echo                HUB PARATECH DESKTOP - REMOÇÃO DO SERVIÇO
echo ===============================================================================
echo.

:: Verificação de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Solicitando permissão de Administrador do Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [*] Finalizando processos do Hub Paratech se estiverem em execução...
taskkill /F /IM HubParatechDesktop.exe >nul 2>&1

echo [*] Removendo tarefa agendada do Windows...
schtasks /delete /tn "HubParatechMonitor" /f >nul 2>&1

echo [*] Removendo entradas de inicialização do Registro do Windows...
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /f >nul 2>&1

echo [*] Limpando executáveis anteriores...
if exist "C:\Paratech\HubDesktop\HubParatechDesktop.exe" del /F /Q "C:\Paratech\HubDesktop\HubParatechDesktop.exe" >nul 2>&1

echo.
echo ===============================================================================
echo  [SUCESSO] Inicialização automática e tarefas do Hub Paratech foram removidas!
echo ===============================================================================
echo.
pause
exit /b
