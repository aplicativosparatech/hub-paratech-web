@echo off
chcp 65001 >nul
title Instalador e Protetor - Hub Paratech Desktop v2.5.0
color 0B

echo ===============================================================================
echo          HUB PARATECH DESKTOP v2.5.0 - INSTALADOR E ATIVAÇÃO PROTEGIDA
echo ===============================================================================
echo.

:: 1. Verificação de Privilégios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Solicitando permissão de Administrador do Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [*] Privilégios de Administrador confirmados.
echo [*] Preparando diretório oficial do sistema: C:\Paratech\HubDesktop...

:: 2. Criação do Diretório Oficial
if not exist "C:\Paratech\HubDesktop" (
    mkdir "C:\Paratech\HubDesktop"
)

:: 3. Copiando Executável Autocontido e Recursos
echo [*] Instalando executável autocontido e ativos gráficos...
copy /Y "%~dp0publish\HubParatechDesktop.exe" "C:\Paratech\HubDesktop\HubParatechDesktop.exe" >nul 2>&1
if not exist "C:\Paratech\HubDesktop\HubParatechDesktop.exe" (
    copy /Y "%~dp0HubParatechDesktop.exe" "C:\Paratech\HubDesktop\HubParatechDesktop.exe" >nul 2>&1
)
if exist "%~dp0icon.ico" copy /Y "%~dp0icon.ico" "C:\Paratech\HubDesktop\icon.ico" >nul 2>&1
if exist "%~dp0logo.png" copy /Y "%~dp0logo.png" "C:\Paratech\HubDesktop\logo.png" >nul 2>&1

:: 4. Registro no Agendador de Tarefas do Windows (Execução com Privilégios Máximos no Logon)
echo [*] Configurando Agendador de Tarefas do Windows (Proteção contra fechamento)...
schtasks /create /tn "HubParatechMonitor" /tr "\"C:\Paratech\HubDesktop\HubParatechDesktop.exe\"" /sc onlogon /rl highest /f >nul 2>&1

:: 5. Registro de Inicialização no Windows (HKLM e HKCU)
echo [*] Registrando inicialização automática no Registro do Windows...
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /t REG_SZ /d "\"C:\Paratech\HubDesktop\HubParatechDesktop.exe\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /t REG_SZ /d "\"C:\Paratech\HubDesktop\HubParatechDesktop.exe\"" /f >nul 2>&1

echo.
echo ===============================================================================
echo  [SUCESSO] Hub Paratech Desktop v2.5.0 Instalado com Proteção Anti-Burla!
echo ===============================================================================
echo.
echo  • Local de Instalação : C:\Paratech\HubDesktop\HubParatechDesktop.exe
echo  • Inicialização      : Automática no logon (Agendador de Tarefas + Registro)
echo  • Nível de Segurança : Execução protegida (Usuário comum não encerra)
echo.
echo Abrindo a tela de configuração para você informar o Token do cliente...
echo.

start "" "C:\Paratech\HubDesktop\HubParatechDesktop.exe" --setup
timeout /t 5 >nul
exit /b
