@echo off
title Compilando Hub Paratech Desktop - 32 Bits (x86)
cd /d "%~dp0"

echo ========================================================
echo   PUBLICANDO HUB PARATECH DESKTOP 32 BITS (x86)
echo ========================================================
echo.

dotnet publish HubParatechDesktop.csproj -c Release -r win-x86 -p:PublishSingleFile=true -p:SelfContained=true -o publish-x86

if %ERRORLEVEL% equ 0 (
    copy /Y "Instalar_HubParatech.bat" "publish-x86\Instalar_HubParatech.bat" >nul 2>&1
    copy /Y "Desinstalar_HubParatech.bat" "publish-x86\Desinstalar_HubParatech.bat" >nul 2>&1
    copy /Y "icon.ico" "publish-x86\icon.ico" >nul 2>&1
    echo.
    echo ========================================================
    echo  EXECUTAVEL 32 BITS GERADO COM SUCESSO EM:
    echo  %~dp0publish-x86\HubParatechDesktop.exe
    echo ========================================================
) else (
    echo.
    echo [ERRO] Falha na compilacao x86.
)
pause
