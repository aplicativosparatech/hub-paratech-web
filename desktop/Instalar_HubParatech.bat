@echo off
setlocal EnableDelayedExpansion

title Instalador e Atualizador - Hub Paratech Desktop v2.6.0
color 0B

echo ===============================================================================
echo          HUB PARATECH DESKTOP v2.6.0 - INSTALADOR E ATUALIZADOR PROTEGIDO
echo ===============================================================================
echo.

REM 1. Verificacao de Privilegios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Solicitando permissao de Administrador do Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [*] Privilegios de Administrador confirmados.

REM 2. Encerrar instancias anteriores para liberar arquivo travado
echo [*] Fechando instancias anteriores do Hub Paratech se estiverem em execucao...
taskkill /F /IM HubParatechDesktop.exe >nul 2>&1
timeout /t 1 /nobreak >nul

REM 3. Preparando diretorio oficial
set "TARGET_DIR=C:\Paratech\HubDesktop"
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%" >nul 2>&1
)

REM 4. Copiando Executavel e Recursos
echo [*] Instalando executavel autocontido e ativos graficos...
set "COPIED=0"

if exist "%~dp0HubParatechDesktop.exe" (
    copy /Y "%~dp0HubParatechDesktop.exe" "%TARGET_DIR%\HubParatechDesktop.exe" >nul 2>&1
    if not errorlevel 1 set "COPIED=1"
)

if "!COPIED!"=="0" (
    if exist "%~dp0publish\HubParatechDesktop.exe" (
        copy /Y "%~dp0publish\HubParatechDesktop.exe" "%TARGET_DIR%\HubParatechDesktop.exe" >nul 2>&1
        if not errorlevel 1 set "COPIED=1"
    )
)

if not exist "%TARGET_DIR%\HubParatechDesktop.exe" (
    echo.
    echo [ERRO] Falha ao copiar HubParatechDesktop.exe para %TARGET_DIR%!
    echo Verifique se descompactou todos os arquivos do arquivo ZIP.
    pause
    exit /b
)

if exist "%~dp0icon.ico" copy /Y "%~dp0icon.ico" "%TARGET_DIR%\icon.ico" >nul 2>&1
if exist "%~dp0logo.png" copy /Y "%~dp0logo.png" "%TARGET_DIR%\logo.png" >nul 2>&1

REM 5. Registro no Agendador de Tarefas do Windows
echo [*] Configurando Agendador de Tarefas do Windows...
schtasks /create /tn "HubParatechMonitor" /tr "\"%TARGET_DIR%\HubParatechDesktop.exe\"" /sc onlogon /rl highest /f >nul 2>&1

REM 6. Registro de Inicializacao no Windows (HKLM e HKCU)
echo [*] Registrando inicializacao automatica no Registro do Windows...
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /t REG_SZ /d "\"%TARGET_DIR%\HubParatechDesktop.exe\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "HubParatech" /t REG_SZ /d "\"%TARGET_DIR%\HubParatechDesktop.exe\"" /f >nul 2>&1

echo.
echo ===============================================================================
echo  [SUCESSO] Hub Paratech Desktop v2.6.0 Instalado e Atualizado com Sucesso!
echo ===============================================================================
echo.
echo  - Local de Instalacao : %TARGET_DIR%\HubParatechDesktop.exe
echo  - Versao              : v2.6.0 Standalone
echo  - Inicializacao       : Automatica no logon (Agendador de Tarefas + Registro)
echo.
echo Iniciando o Hub Paratech v2.6.0...
echo.

start "" "%TARGET_DIR%\HubParatechDesktop.exe"
timeout /t 3 /nobreak >nul
exit /b