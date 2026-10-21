@echo off
node "%~dp0scripts\workspace.mjs" build
if errorlevel 1 pause
