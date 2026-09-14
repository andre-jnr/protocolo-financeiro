@echo off
title Protocolo para Financeiro - Servidor (NAO FECHE esta janela)
cd /d "%~dp0\.."

echo ============================================
echo   Protocolo para Financeiro - Servidor
echo ============================================
echo.
echo NAO FECHE esta janela enquanto estiver usando o sistema.
echo Para ENCERRAR o sistema, feche esta janela.
echo.

node server\server.js

echo.
echo O servidor foi encerrado.
pause
