@echo off
chcp 65001 >nul
title Instalador e Atualizador - Hub Paratech Desktop v2.5.9
color 0B

echo ===============================================================================
echo          HUB PARATECH DESKTOP v2.5.9 - INSTALADOR E ATUALIZADOR PROTEGIDO
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

:: 2. Encerrar instâncias anteriores em execução para liberar o arquivo
echo [*] Fechando instâncias anteriores do Hub Paratech para substituição...
taskkill /F /IM HubParatechDesktop.exe >nul 2>&1
timeout /t 1 >nul

echo [*] Preparando diretório oficial do sistema: C:\Paratech\HubDesktop...

:: 3. Criação do Diretório Oficial
if not exist "C:\Paratech\HubDesktop" (
    mkdir "C:\Paratech\HubDesktop"
)

:: 4. Copiando Executável Autocontido e Recursos
echo [*] Instalando executável autocontido e ativos gráficos...
set "COPIED=0"
if exist "%~dp0HubParatechDesktop.exe" (
    copy /Y "%~dp0HubParatechDesktop.exe" "C:\Paratech\HubDesktop\HubParatechDesktop.exe" >nul 2>&1
    if not errorlevel 1 set "COPIED=1"
)
if exist "%~dp0publish\HubParatechDesktop.exe" (
    copy /Y "%~dp0publish\HubParatechDesktop.exe" "C:\Paratech\HubDesktop\HubParatechDesktop.exe" >nul 2>&1
    if not errorlevel 1 set "COPIED=1"
)

if not exist "C:\Paratech\HubDesktop\HubParatechDesktop.exe" (
    echo.
    echo [ERRO] Não foi possível copiar HubParatechDesktop.exe para C:\Paratech\HubDesktop!
    echo Certifique-se de descompactar todos os arquivos do ZIP antes de executar o instalador.
    pause
    exit /b
)

if exist "%~dp0icon.ico" copy /Y "%~dp0icon.ico" "C:\Paratech\HubDesktop\icon.ico" >nul 2>&1
if exist "%~dp0logo.png" copy /Y "%~dp0logo.png" "C:\Paratech\HubDesktop\logo.png" >nul 2>&1

:: 5. Registro no Agendador de Tarefas do Windows (Execução com Privilégios Máximos no Logon)
echo [*] Configurando Agendador de Tarefas do Windows (Proteção contra fechamento)...
schtasks /create /tn "HubParatechMonitor" /tr "\"C:\Paratech\HubDesktop\HubParatechDesktop.exe\"" /sc onlogon /rl highest /f >nul 2>&1

:: 6. Registro de Inicialização no Windows (HKLM e HKCU)
echo [*] Registrando inicialização automática no Registro do Windows...
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /t REG_SZ /d "\"C:\Paratech\HubDesktop\HubParatechDesktop.exe\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /t REG_SZ /d "\"C:\Paratech\HubDesktop\HubParatechDesktop.exe\"" /f >nul 2>&1

echo.
echo ===============================================================================
echo  [SUCESSO] Hub Paratech Desktop v2.5.9 Instalado / Atualizado com Sucesso!
echo ===============================================================================
echo.
echo  • Local de Instalação : C:\Paratech\HubDesktop\HubParatechDesktop.exe
echo  • Versão Atualizada  : v2.5.9 (Com persistência de histórico e portal direto)
echo  • Inicialização      : Automática no logon (Agendador de Tarefas + Registro)
echo.
echo Iniciando o Hub Paratech v2.5.9...
echo.

start "" "C:\Paratech\HubDesktop\HubParatechDesktop.exe"
timeout /t 3 >nul
exit /b
