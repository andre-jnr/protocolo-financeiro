@echo off
setlocal enabledelayedexpansion
title Protocolo para Financeiro
cd /d "%~dp0"

echo ============================================
echo   Protocolo para Financeiro
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O Node.js nao foi encontrado neste computador.
    echo.
    echo Instale o Node.js em https://nodejs.org/ ^(versao LTS^) e tente novamente.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERRO] Arquivo .env nao encontrado.
    echo Copie o arquivo .env.example para .env e preencha as credenciais do banco.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Primeira execucao detectada: instalando componentes necessarios.
    echo Isso pode levar alguns minutos. Aguarde...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERRO] Falha ao instalar as dependencias do sistema.
        echo Verifique sua conexao com a internet e tente novamente.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Instalacao concluida com sucesso.
    echo.
)

netstat -ano | findstr "LISTENING" | findstr ":3000 " >nul 2>nul
if errorlevel 1 (
    echo Iniciando o servidor local...
    start "Protocolo para Financeiro - Servidor (NAO FECHE)" "%~dp0server\iniciar-servidor.bat"
    call :aguardar_servidor
) else (
    echo O servidor ja estava em execucao.
)

echo Abrindo o sistema no navegador...
start "" "http://localhost:3000"

echo.
echo Pronto! Se o navegador nao abrir sozinho, acesse: http://localhost:3000
echo Para ENCERRAR o sistema, feche a janela "Protocolo para Financeiro - Servidor".
echo.
timeout /t 4 >nul
exit /b 0

:aguardar_servidor
echo Aguardando o servidor iniciar...
where curl >nul 2>nul
if errorlevel 1 (
    timeout /t 4 /nobreak >nul
    exit /b 0
)
for /l %%i in (1,1,30) do (
    curl -s -o nul http://localhost:3000
    if not errorlevel 1 exit /b 0
    timeout /t 1 /nobreak >nul
)
exit /b 0
